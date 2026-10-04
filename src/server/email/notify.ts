import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendTransactionalEmail, type SendEmailResult } from "@/lib/email/send";
import {
  renderExpiryReminderEmail,
  renderMomenReceiptEmail,
  renderReceiptEmail,
  renderUpgradeReceiptEmail,
} from "@/lib/email/templates";
import { appUrl } from "@/lib/env";
import { reportHandledError } from "@/lib/observability";
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
    const { data: order } = await admin
      .from("orders")
      .select(
        "order_code, amount_idr, paid_at, user_id, invitation_id, package_id, purpose",
      )
      .eq("order_code", orderCode)
      .maybeSingle();
    if (!order) return;
    // Pemilik order bisa TAK ADA: akun yang dihapus meninggalkan baris `orders`
    // ber-`user_id` NULL demi kewajiban pembukuan (A6). Tak ada alamat tujuan —
    // dan itu bukan galat. Sebelum tipe DB-nya dibetulkan, cabang ini tak
    // terpikirkan dan `getUserById(null)` yang jalan.
    if (!order.user_id) return;

    const { data: userRes } = await admin.auth.admin.getUserById(order.user_id);
    const email = userRes?.user?.email;
    if (!email) return;

    const [{ data: profile }, { data: pkg }, { data: inv }] = await Promise.all(
      [
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
      ],
    );
    if (!inv) return;

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
