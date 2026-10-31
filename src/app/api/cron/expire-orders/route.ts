import { revalidatePath } from "next/cache";

import { getPaymentGateway } from "@/lib/payment";
import { UMUR_MAKS_ORDER_PENDING_MS as PENDING_MAX_AGE_MS } from "@/lib/payment/types";
import { reportHandledError } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordCronRun } from "@/server/cron/record";
import { isAuthorizedCron } from "@/server/cron/auth";
import { notifyOrderPaid } from "@/server/email/notify";
import { verifyAndActivate } from "@/server/payment/reconcile";

/**
 * Cron: DUA pass atas order `pending` (SPEC §4.8, ARCHITECTURE §7).
 *
 * **Pass 1 — rekonsiliasi MUDA (10 menit … 24 jam).** Ditambahkan 2026-10-13
 * (DECISIONS #73) karena sebelumnya TIDAK ADA backstop di bawah 24 jam: bila
 * webhook hilang DAN pelanggan menutup tab sebelum poller selesai, order yang
 * sudah dibayar menggantung sehari penuh tanpa satu pun sinyal. Risiko itu naik
 * tajam di API v2 — bentuk payload webhook berubah, dan `?redirect=` yang
 * membawa pelanggan kembali ke halaman poll tak bisa diverifikasi dari luar
 * browser. Pass ini HANYA memverifikasi & mengaktifkan; ia tak pernah
 * membatalkan apa pun.
 *
 * **Pass 2 — kedaluwarsakan yang > 24 jam.**
 * REKONSILIASI DULU, baru batalkan (menutup celah "webhook hilang" M3.3): tiap
 * order diverifikasi OTORITATIF via `transactiondetail` (`verifyAndActivate`) —
 * bila ternyata LUNAS, diaktifkan (atau `held` utk suspended, pembayaran tetap
 * tercatat), BUKAN dibatalkan. Hanya order yang API pastikan BELUM lunas yang
 * di-`expired` lalu dibatalkan ke gateway (best-effort; BinderPay:
 * `qr-mpm-cancel`, karena QR yang lewat tenggat tak pernah berubah status
 * sendiri — DECISIONS #102).
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>`. Mutasi → service_role.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Batasi kerja per-jalankan. Sisa diambil jalankan berikutnya.
const BATCH = 100;

/**
 * Umur minimum order sebelum ikut REKONSILIASI MUDA.
 *
 * Di bawah ini, jalur normal belum selesai bekerja: webhook biasanya tiba dalam
 * hitungan detik, dan poller halaman bayar berjalan sampai ±6 menit. Menyentuh
 * order yang lebih muda hanya menambah panggilan Pakasir yang bersaing dengan
 * poller pelanggan atas plafon 2 permintaan/detik yang sama.
 */
const RECONCILE_MIN_AGE_MS = 10 * 60 * 1000;

/**
 * Anggaran panggilan Pakasir untuk SATU jalan cron.
 *
 * Plafonnya 2 permintaan/detik, jadi tanpa anggaran satu jalan bisa menuntut
 * ratusan panggilan: pass kedaluwarsa saja bisa memakai 2 panggilan per order
 * (verifikasi lalu pembatalan) untuk sampai 100 order. Hampir semuanya akan
 * dijawab 429 → transien → `skipped` → tak ada yang benar-benar beres, dan
 * jalan berikutnya mengulang kegagalan yang sama. Itu livelock, dan panel admin
 * tetap hijau karena job-nya "berhasil".
 *
 * Yang kehabisan anggaran DILAPORKAN sebagai `budgetHabis`, bukan dipotong
 * diam-diam.
 */
const PAKASIR_BUDGET = 60;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) return json({ ok: false }, 401);

  const admin = createSupabaseAdminClient();
  const sekarang = Date.now();
  const cutoff = new Date(sekarang - PENDING_MAX_AGE_MS).toISOString();

  // Satu anggaran panggilan Pakasir untuk SELURUH jalan, dengan jeda per
  // panggilan. Pass muda memakainya LEBIH DULU: di sanalah ada pelanggan yang
  // mungkin sudah membayar dan sedang menunggu, sedangkan pass kedaluwarsa
  // adalah pembersihan yang boleh menunggu jalan berikutnya.
  const JEDA_MS = 600;
  let anggaran = PAKASIR_BUDGET;
  const pakaiAnggaran = async (): Promise<boolean> => {
    if (anggaran <= 0) return false;
    if (anggaran < PAKASIR_BUDGET) {
      await new Promise((r) => setTimeout(r, JEDA_MS));
    }
    anggaran -= 1;
    return true;
  };

  // === PASS 1 — REKONSILIASI MUDA ===========================================
  let mudaScanned = 0;
  let mudaActivated = 0;
  let mudaPending = 0;
  let budgetHabis = 0;

  const { data: muda, error: mudaErr } = await admin
    .from("orders")
    .select("order_code, amount_idr, txn_id")
    .eq("status", "pending")
    .not("txn_id", "is", null) // tanpa txn_id tak bisa diverifikasi (v2)
    .lt("created_at", new Date(sekarang - RECONCILE_MIN_AGE_MS).toISOString())
    .gte("created_at", cutoff) // yang lebih tua ditangani pass 2
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (mudaErr) {
    reportHandledError(mudaErr, "cron.expire-orders.reconcile");
    await recordCronRun("expire-orders", false, {}, mudaErr);
    return json({ ok: false }, 503);
  }

  for (const o of muda ?? []) {
    mudaScanned += 1;
    if (!(await pakaiAnggaran())) {
      budgetHabis += 1;
      continue;
    }
    const outcome = await verifyAndActivate(admin, {
      order_code: o.order_code,
      amount_idr: o.amount_idr,
      txn_id: o.txn_id,
    });
    if (outcome.kind === "ok") {
      if (outcome.result === "activated") {
        mudaActivated += 1;
        // Webhook hilang → cron yang mengaktifkan tetap mengirim kuitansi.
        await notifyOrderPaid(admin, o.order_code);
        if (outcome.slug) revalidatePath(`/${outcome.slug}`);
      } else if (outcome.result === "already_paid") {
        mudaActivated += 1;
        if (outcome.slug) revalidatePath(`/${outcome.slug}`);
      }
      continue;
    }
    // Belum lunas / transien / kontrak putus → biarkan `pending`. JANGAN
    // batalkan apa pun di pass ini: order ini belum tentu ditinggalkan, dan
    // pelanggannya mungkin sedang di halaman bayar Pakasir saat ini.
    mudaPending += 1;
  }

  // === PASS 2 — KEDALUWARSAKAN > 24 JAM =====================================
  const { data: stale, error } = await admin
    .from("orders")
    .select("order_code, amount_idr, txn_id")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    reportHandledError(error, "cron.expire-orders");
    await recordCronRun("expire-orders", false, {}, error);
    return json({ ok: false }, 503);
  }

  let activated = 0; // rekonsiliasi menemukan lunas → diaktifkan
  let keptPaid = 0; // lunas tetapi tak dipublikasi (held) / anomali → JANGAN expire
  let expired = 0; // dipastikan belum lunas → dibatalkan + expired
  let skipped = 0; // transien/ambigu → coba lagi jalankan berikutnya
  let cancelFailed = 0; // Pakasir cancel gagal (tetap di-expire; residual link)
  let tanpaTxn = 0; // order tanpa txn_id → tak bisa diverifikasi v2

  for (const o of stale ?? []) {
    // Tanpa `txn_id`, status v2 tak bisa dibaca (ia berkunci txn_id). Order
    // seperti ini lahir dari penerbitan link yang gagal — artinya pelanggan tak
    // pernah menerima link, jadi tak ada pembayaran yang hilang. DIHITUNG, bukan
    // dilewati diam-diam: angka yang tumbuh berarti penerbitan link sering gagal.
    //
    // DI-EXPIRE, bukan ditinggalkan `pending` selamanya. `terbitkanLink`
    // (server/payment/link.ts) TIDAK PERNAH mengarahkan pelanggan bila `txn_id`
    // gagal tersimpan, jadi baris ini pasti tak pernah sampai ke tangan siapa
    // pun — sementara statusnya yang abadi itu mengunci pembelian berikutnya:
    // `findPendingMomenOrder` dan penahan serupa di jalur upgrade menolak order
    // baru selama ada yang `pending`, tanpa batas umur dan tanpa jalan keluar
    // dari UI mana pun. Pemilik yang sekali kena galat jaringan Pakasir tak akan
    // pernah bisa membeli add-on untuk undangan itu lagi.
    //
    // Tanpa panggilan Pakasir: tak ada transaksi yang bisa dinamai untuk
    // dibatalkan, dan RPC-nya mengunci baris + memeriksa ulang `status =
    // 'pending'`, jadi order yang keburu lunas tetap menang.
    if (!o.txn_id) {
      tanpaTxn += 1;
      const { data: lepas } = await admin.rpc("expire_pending_order", {
        p_order_code: o.order_code,
      });
      if (lepas?.[0]?.result === "expired") expired += 1;
      continue;
    }
    if (!(await pakaiAnggaran())) {
      budgetHabis += 1;
      continue;
    }
    const outcome = await verifyAndActivate(admin, {
      order_code: o.order_code,
      amount_idr: o.amount_idr,
      txn_id: o.txn_id,
    });

    if (outcome.kind === "ok") {
      if (outcome.result === "activated" || outcome.result === "already_paid") {
        activated += 1;
        // Kuitansi HANYA pada transisi `activated` (webhook hilang → cron yang
        // mengaktifkan tetap mengirim). Best-effort.
        if (outcome.result === "activated") {
          await notifyOrderPaid(admin, o.order_code);
        }
        if (outcome.slug) revalidatePath(`/${outcome.slug}`);
      } else {
        // held / invalid / not_found → order kini paid atau anomali; jangan expire.
        keptPaid += 1;
      }
      continue;
    }
    // Hanya `not_confirmed` (API pastikan BELUM lunas) yang boleh dibatalkan.
    // Transien (verify_error/rpc_error) & `mismatch` → tunda ke jalankan berikutnya.
    if (outcome.kind !== "not_confirmed") {
      skipped += 1;
      continue;
    }

    // EXPIRE DULU (atomik, kunci baris), BARU batalkan link. Urutan ini mencegah
    // membatalkan order yang lunas di detik terakhir: bila webhook/poll
    // mengaktifkan tepat setelah rekonsiliasi kita, RPC (kunci baris + cek ulang
    // `status='pending'`) melihat status bukan `pending` → `not_pending` → kita
    // TAK meng-expire & TAK membatalkan (aktivasi menang). Bila RPC berhasil
    // meng-`expired`, order PASTI belum lunas saat lock → aman dibatalkan; dan
    // webhook yang tiba setelahnya melihat `expired` → `invalid` (tak mengaktifkan).
    const { data: rpc } = await admin.rpc("expire_pending_order", {
      p_order_code: o.order_code,
    });
    if (rpc?.[0]?.result !== "expired") {
      skipped += 1; // not_pending (keburu lunas) / not_found → jangan batalkan
      continue;
    }
    expired += 1;
    // Batalkan link Pakasir (best-effort). Gagal → order tetap `expired` lokal;
    // residual: link mungkin masih hidup (dicatat cancelFailed).
    try {
      // Anggaran habis di sini berarti order sudah di-`expired` tetapi link-nya
      // belum dibatalkan — residual yang sama dengan `cancelFailed`, dan dihitung
      // di sana supaya tak ada kegagalan yang tak terwakili angka.
      if (!(await pakaiAnggaran())) throw new Error("anggaran Pakasir habis");
      await getPaymentGateway().cancelTransaction(
        o.order_code,
        o.amount_idr,
        o.txn_id,
      );
    } catch (err) {
      cancelFailed += 1;
      // Wajib terlihat, bukan hanya jadi angka: `cancel-transaction` Pakasir v2
      // TIDAK TERDOKUMENTASI (ditemukan dengan menebak URL), dan BinderPay
      // menjawab 409 "already been paid" bila pelanggan membayar di antara
      // verifikasi dan pembatalan — order yang kini `expired` itu SUDAH dibayar
      // dan perlu ditangani manual.
      reportHandledError(err, "payment.cancel", { orderCode: o.order_code });
    }
  }

  const scanned = stale?.length ?? 0;
  await recordCronRun("expire-orders", true, {
    scanned,
    activated,
    keptPaid,
    expired,
    skipped,
    cancelFailed,
    tanpaTxn,
    mudaScanned,
    mudaActivated,
    mudaPending,
    budgetHabis,
  });
  return json(
    {
      ok: true,
      scanned,
      // Batch penuh → mungkin masih ada sisa; observabilitas backlog (bukan
      // truncation senyap). Sisa diproses jalankan berikutnya.
      truncated: scanned === BATCH,
      activated,
      keptPaid,
      expired,
      skipped,
      cancelFailed,
      tanpaTxn,
      mudaScanned,
      mudaActivated,
      mudaPending,
      budgetHabis,
    },
    200,
  );
}
