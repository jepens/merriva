import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendTransactionalEmail, type SendEmailResult } from "@/lib/email/send";
import {
  renderExpiryReminderEmail,
  renderMomenReceiptEmail,
  renderPurgeWarningEmail,
  renderReceiptEmail,
  renderUpgradeReceiptEmail,
} from "@/lib/email/templates";
import { appUrl } from "@/lib/env";
import { reportHandledError } from "@/lib/observability";
import { daysUntilPurge, purgeDueMs } from "@/server/cron/retention";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Tanggal Indonesia (Asia/Jakarta). `null` bila input tak valid. */
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

/** Tanggal + jam WIB. `null` bila tak valid. */
function fmtDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(d) + " WIB"
  );
}

/**
 * Kirim kuitansi + link aktif setelah order → paid (M3.5). Dipanggil dari jalur
 * aktivasi (webhook/poll/cron) HANYA saat RPC mengembalikan `activated` (transisi
 * sekali). BEST-EFFORT: kegagalan (data hilang / Resend error) TIDAK melempar —
 * aktivasi tak boleh gagal karena email. `idempotencyKey=receipt/{orderCode}`
 * = jaring pengaman kirim-ganda 24 jam.
 */
export async function notifyOrderPaid(
  admin: Admin,
  orderCode: string,
): Promise<void> {
  try {
    // SETIAP bacaan di bawah mengambil `error`-nya — untuk DIAGNOSIS, bukan
    // untuk DETEKSI. supabase-js tak pernah mengembalikan baris berbarengan
    // dengan galat, jadi `data === null` sudah menangkap kedua keadaan;
    // `error`-nya yang menentukan laporannya bisa didiagnosis atau tidak
    // (`reportHandledError` menyusun nama isu Sentry dari `code` Postgres).
    // Memeriksa `error` lagi di kondisinya hanya menambah cabang yang tak
    // pernah dieksekusi. `.maybeSingle()`
    // mengembalikan `data: null, error: null` untuk 0 baris — bentuk yang
    // IDENTIK dengan `data: null, error: <gangguan DB>`. Membuang `error`
    // berarti "kuitansi tak terkirim" dan "Postgres sedang bermasalah" terlihat
    // sama persis, yaitu tidak terlihat sama sekali.
    //
    // Yang dilaporkan hanya `orderCode` + `step`. TIDAK PERNAH: alamat email,
    // nama pembeli, atau isi kuitansinya.
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select(
        "order_code, amount_idr, paid_at, user_id, invitation_id, package_id, purpose",
      )
      .eq("order_code", orderCode)
      .maybeSingle();
    if (!order) {
      // Order ini BARU SAJA diaktifkan oleh pemanggil — ketiadaannya anomali.
      reportHandledError(
        orderErr ?? new Error("order hilang pasca-aktivasi"),
        "email.receipt.lookup",
        { orderCode, step: "order" },
      );
      return;
    }
    // Pemilik order bisa TAK ADA: akun yang dihapus meninggalkan baris `orders`
    // ber-`user_id` NULL demi kewajiban pembukuan (A6). Tak ada alamat tujuan —
    // dan itu bukan galat, jadi sengaja TANPA laporan. Sebelum tipe DB-nya
    // dibetulkan, cabang ini tak terpikirkan dan `getUserById(null)` yang jalan.
    if (!order.user_id) return;

    const { data: userRes, error: authErr } =
      await admin.auth.admin.getUserById(order.user_id);
    const email = userRes?.user?.email;
    if (!email) {
      reportHandledError(
        authErr ?? new Error("pemilik order tanpa alamat email"),
        "email.receipt.lookup",
        { orderCode, step: "auth" },
      );
      return;
    }

    const [
      { data: profile },
      { data: pkg, error: pkgErr },
      { data: inv, error: invErr },
    ] = await Promise.all([
      // `profiles` sengaja tanpa penanganan galat: `full_name` memang nullable
      // dan kegagalannya kosmetik (sapaan jatuh ke "Halo,").
      admin
        .from("profiles")
        .select("full_name")
        .eq("id", order.user_id)
        .maybeSingle(),
      admin
        .from("packages")
        .select("name, kind")
        .eq("id", order.package_id)
        .maybeSingle(),
      admin
        .from("invitations")
        .select("slug, active_until")
        .eq("id", order.invitation_id)
        .maybeSingle(),
    ]);
    if (!inv) {
      reportHandledError(
        invErr ?? new Error("undangan hilang pasca-aktivasi"),
        "email.receipt.lookup",
        { orderCode, step: "invitation" },
      );
      return;
    }
    // `pkg` BUKAN hiasan: ia yang memilih template di bawah. Bila bacaannya
    // gagal, order add-on Album Momen akan diam-diam dikirimi kuitansi aktivasi
    // undangan — "undangan Anda kini aktif", lengkap dengan masa aktif dan link
    // undangan. Kuitansi yang SALAH, terkirim, tanpa jejak.
    //
    // Tetap LANJUT mengirim (bukan `return`): kehilangan kuitansi sepenuhnya
    // lebih buruk daripada nama paket yang kosong, dan `package_id` NOT NULL +
    // FK membuat kasus ini hanya mungkin saat DB benar-benar bermasalah.
    if (!pkg) {
      reportHandledError(
        pkgErr ?? new Error("paket hilang pasca-aktivasi"),
        "email.receipt.lookup",
        { orderCode, step: "package" },
      );
    }

    // Tiga bentuk kuitansi, dipilih dari jenis ORDER — bukan dari nominalnya.
    //  * upgrade  → paket naik, masa aktif TIDAK berubah (B3). Paketnya paket
    //    undangan biasa, jadi `kind` saja akan salah memilih kuitansi aktivasi
    //    yang mengaku "undangan Anda kini aktif" dan menyiratkan periode baru.
    //  * addon_momen → album ikut retensi undangan (bukan durasi paket) & CTA
    //    menuju halaman kelola album, bukan link undangan.
    //  * sisanya → aktivasi/perpanjangan.
    const rendered =
      order.purpose === "upgrade"
        ? renderUpgradeReceiptEmail({
            name: profile?.full_name ?? null,
            packageName: pkg?.name ?? "",
            amountIdr: order.amount_idr,
            orderCode: order.order_code,
            paidAtLabel: fmtDateTime(order.paid_at),
            activeUntilLabel: fmtDate(inv.active_until),
            invitationUrl: `${appUrl}/${inv.slug}`,
          })
        : pkg?.kind === "addon_momen"
          ? renderMomenReceiptEmail({
              name: profile?.full_name ?? null,
              packageName: pkg?.name ?? "",
              amountIdr: order.amount_idr,
              orderCode: order.order_code,
              paidAtLabel: fmtDateTime(order.paid_at),
              manageUrl: `${appUrl}/dashboard/undangan/${order.invitation_id}/momen`,
            })
          : renderReceiptEmail({
              name: profile?.full_name ?? null,
              packageName: pkg?.name ?? "",
              amountIdr: order.amount_idr,
              orderCode: order.order_code,
              paidAtLabel: fmtDateTime(order.paid_at),
              activeUntilLabel: fmtDate(inv.active_until),
              invitationUrl: `${appUrl}/${inv.slug}`,
            });
    const result = await sendTransactionalEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: `receipt/${orderCode}`,
    });
    // Kuitansi dikirim SEKALI (transisi `activated`) TANPA retry → kegagalan =
    // kuitansi hilang permanen bagi pelanggan yang SUDAH membayar.
    //
    // DUA tujuan, sengaja: `reportHandledError` adalah jejak yang bertahan
    // (Sentry) begitu `NEXT_PUBLIC_SENTRY_DSN` diisi, dan `console` adalah
    // satu-satunya yang berfungsi SEBELUM itu — Sentry kini masih no-op (DSN
    // kosong + `enabled: NODE_ENV === "production"`). Komentar lama di sini
    // mengklaim "Sentry menangkap console"; itu TIDAK benar, tak ada
    // `captureConsoleIntegration` di ketiga `Sentry.init`, dan klaim itulah yang
    // membuat celah ini terlihat sudah tertutup selama ini.
    //
    // Yang dilaporkan hanya kode galat + `orderCode`. TIDAK PERNAH: alamat
    // email, nama pembeli, isi `rendered`, atau pesan mentah Resend.
    if (result.status === "error") {
      reportHandledError(new Error(`resend:${result.code}`), "email.receipt", {
        orderCode,
        statusCode: result.statusCode,
      });
      console.warn(`[receipt] Resend gagal untuk order ${orderCode}`);
    }
  } catch (err) {
    // Best-effort: email TAK boleh menggagalkan aktivasi; tetap laporkan.
    reportHandledError(err, "email.receipt", { orderCode });
    console.error(`[receipt] gagal untuk order ${orderCode}`, err);
  }
}

export interface ReminderTarget {
  id: string;
  slug: string;
  user_id: string;
  active_until: string;
}

/**
 * Kirim pengingat masa aktif (cron H-14). Mengembalikan status kirim agar cron
 * menandai `reminder_sent_at` HANYA pada `sent` (skip/error/nodata → coba lagi
 * jalankan berikutnya). Best-effort di dalam try/catch. `now` disuntik agar
 * `daysLeft` deterministik saat diuji.
 */
export async function sendExpiryReminder(
  admin: Admin,
  target: ReminderTarget,
  now: number = Date.now(),
): Promise<SendEmailResult["status"] | "nodata"> {
  try {
    const { data: userRes } = await admin.auth.admin.getUserById(
      target.user_id,
    );
    const email = userRes?.user?.email;
    if (!email) return "nodata";

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", target.user_id)
      .maybeSingle();

    const until = new Date(target.active_until).getTime();
    const daysLeft = Math.max(1, Math.ceil((until - now) / DAY_MS));

    const rendered = renderExpiryReminderEmail({
      name: profile?.full_name ?? null,
      daysLeft,
      activeUntilLabel: fmtDate(target.active_until) ?? target.active_until,
      invitationUrl: `${appUrl}/${target.slug}`,
      renewUrl: `${appUrl}/dashboard/undangan/${target.id}/aktifkan`,
    });
    const res = await sendTransactionalEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: `expiry-reminder/${target.id}`,
    });
    // Pengingat H-14 adalah kewajiban kontraktual: pemilik yang tak diingatkan
    // kehilangan undangannya tanpa peringatan. Kegagalannya sebelumnya hanya
    // menjadi satu angka `failed` di `cron_runs.stats`, bersama DUA sebab lain
    // (pemilik tanpa alamat email, dan UPDATE `reminder_sent_at` yang gagal) —
    // tak mungkin dibedakan. `target.id` = id undangan, bukan PII; `target.slug`
    // dan alamat emailnya sengaja TIDAK disertakan.
    if (res.status === "error") {
      reportHandledError(
        new Error(`resend:${res.code}`),
        "email.expiry-reminder",
        { invitationId: target.id, statusCode: res.statusCode },
      );
    }
    return res.status;
  } catch (err) {
    // Sebelumnya `catch { return "error"; }` — objek galatnya hilang total,
    // lebih buta daripada cabang di atas.
    reportHandledError(err, "email.expiry-reminder", {
      invitationId: target.id,
    });
    return "error";
  }
}

export interface PurgeWarningTarget {
  id: string;
  slug: string;
  user_id: string;
  active_until: string;
  /** Tahap terakhir (~H-7). */
  final: boolean;
}

/**
 * Kirim peringatan pra-purge (AUDIT-2026-10-01 B7).
 *
 * Mengembalikan status kirim agar cron menandai kolom tahapnya HANYA pada
 * `sent` — pola yang sama dengan `sendExpiryReminder`, dan alasannya sama: baris
 * yang gagal kirim harus terpilih lagi, bukan dianggap sudah diperingatkan.
 * Gerbang purge menolak menghapus tanpa penanda itu, jadi menandai terlalu dini
 * berarti menghapus data yang pemiliknya tak pernah diberi tahu.
 *
 * `now` disuntik agar `daysLeft` deterministik saat diuji.
 */
export async function sendPurgeWarning(
  admin: Admin,
  target: PurgeWarningTarget,
  now: number = Date.now(),
): Promise<SendEmailResult["status"] | "nodata"> {
  try {
    const { data: userRes, error: authErr } =
      await admin.auth.admin.getUserById(target.user_id);
    const email = userRes?.user?.email;
    if (authErr || !email) {
      if (authErr) {
        reportHandledError(authErr, "email.purge-warning", {
          invitationId: target.id,
        });
      }
      return "nodata";
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", target.user_id)
      .maybeSingle();

    const due = purgeDueMs(target.active_until);
    const rendered = renderPurgeWarningEmail({
      name: profile?.full_name ?? null,
      slug: target.slug,
      purgeDateLabel:
        (due === null ? null : fmtDate(new Date(due).toISOString())) ??
        target.active_until,
      daysLeft: daysUntilPurge(target.active_until, now),
      final: target.final,
      renewUrl: `${appUrl}/dashboard/undangan/${target.id}/aktifkan`,
      dashboardUrl: `${appUrl}/dashboard/undangan/${target.id}/tamu`,
    });
    const res = await sendTransactionalEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      // Per TAHAP, bukan per undangan: H-30 dan H-7 adalah dua kiriman berbeda,
      // dan kunci yang sama akan membuat Resend menelan yang kedua.
      idempotencyKey: `purge-warning/${target.final ? "final" : "first"}/${target.id}`,
    });
    if (res.status === "error") {
      reportHandledError(
        new Error(`resend:${res.code}`),
        "email.purge-warning",
        { invitationId: target.id, statusCode: res.statusCode },
      );
    }
    return res.status;
  } catch (err) {
    reportHandledError(err, "email.purge-warning", { invitationId: target.id });
    return "error";
  }
}
