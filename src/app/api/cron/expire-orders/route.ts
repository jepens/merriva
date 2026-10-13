import { revalidatePath } from "next/cache";

import { getPaymentGateway } from "@/lib/payment";
import { reportHandledError } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordCronRun } from "@/server/cron/record";
import { isAuthorizedCron } from "@/server/cron/auth";
import { notifyOrderPaid } from "@/server/email/notify";
import { verifyAndActivate } from "@/server/payment/reconcile";

/**
 * Cron: kedaluwarsakan order `pending` > 24 jam (SPEC §4.8, ARCHITECTURE §7).
 * REKONSILIASI DULU, baru batalkan (menutup celah "webhook hilang" M3.3): tiap
 * order diverifikasi OTORITATIF via `transactiondetail` (`verifyAndActivate`) —
 * bila ternyata LUNAS, diaktifkan (atau `held` utk suspended, pembayaran tetap
 * tercatat), BUKAN dibatalkan. Hanya order yang API pastikan BELUM lunas yang
 * dibatalkan ke Pakasir (`transactioncancel`, best-effort) lalu di-`expired`.
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>`. Mutasi → service_role.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Batasi kerja per-jalankan (tiap order = 1 panggilan `transactiondetail`).
// Sisa diambil jalankan berikutnya. Order pending >24 jam seharusnya jarang.
const BATCH = 100;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) return json({ ok: false }, 401);

  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - PENDING_MAX_AGE_MS).toISOString();

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

  // Pakasir v2 berplafon 2 PERMINTAAN/DETIK, dan itu bukan teori: 429 benar-benar
  // terjadi saat tiga panggilan dikirim berurutan saat integrasi ini diuji.
  //
  // Satu iterasi loop ini bisa memakai DUA panggilan Pakasir (verifikasi, lalu
  // pembatalan), jadi batas atasnya 2 x BATCH = 200 panggilan. Tanpa jeda,
  // hampir semuanya akan dijawab 429 → dipetakan transien → `skipped` → order
  // tak pernah benar-benar dibatalkan, dan jalan berikutnya mengulang kegagalan
  // yang sama. Itu livelock, dan panel admin tetap hijau karena job-nya
  // "berhasil".
  //
  // Jeda dipasang per PANGGILAN, bukan per iterasi — menaruhnya per iterasi akan
  // melewatkan panggilan kedua dan tetap melampaui plafon.
  const JEDA_MS = 600;
  let panggilanKe = 0;
  const jedaPakasir = async () => {
    panggilanKe += 1;
    if (panggilanKe > 1) {
      await new Promise((r) => setTimeout(r, JEDA_MS));
    }
  };

  for (const o of stale ?? []) {
    // Tanpa `txn_id`, status v2 tak bisa dibaca (ia berkunci txn_id). Order
    // seperti ini lahir dari penerbitan link yang gagal — artinya pelanggan tak
    // pernah menerima link, jadi tak ada pembayaran yang hilang. DIHITUNG, bukan
    // dilewati diam-diam: angka yang tumbuh berarti penerbitan link sering gagal.
    if (!o.txn_id) {
      tanpaTxn += 1;
      continue;
    }
    await jedaPakasir();
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
      await jedaPakasir();
      await getPaymentGateway().cancelTransaction(
        o.order_code,
        o.amount_idr,
        o.txn_id,
      );
    } catch (err) {
      cancelFailed += 1;
      // `cancel-transaction` v2 TIDAK TERDOKUMENTASI — ditemukan dengan menebak
      // URL. Kegagalannya karena itu wajib terlihat, bukan hanya jadi angka:
      // bila Pakasir mengubah atau menghapus route itu, inilah satu-satunya
      // tempat yang akan memberi tahu kita.
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
    },
    200,
  );
}
