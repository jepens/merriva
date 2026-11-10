import { revalidatePath } from "next/cache";

import { toDbJson } from "@/lib/json";
import { reportHandledError } from "@/lib/observability";
import {
  checkWebhookSecret,
  pakasirWebhookSchema,
  readBodyCapped,
} from "@/lib/payment/webhook";
import { checkClientRateLimit } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyOrderPaid } from "@/server/email/notify";
import { verifyAndActivate } from "@/server/payment/reconcile";

/**
 * Webhook pembayaran Pakasir (SPEC §4.8 / M3.2). Payload tetap SINYAL, bukan
 * bukti — tetapi sejak API v2 ia BISA diautentikasi lewat header `X-Secret`
 * (AUDIT-2026-10-13). Verifikasi WAJIB berlapis:
 *   0. Header `X-Secret` = `PAKASIR_WEBHOOK_SECRET` (bila env terisi).
 *      Pemeriksaan `project` LAMA DIBUANG: payload v2 tak lagi mengirim field itu.
 *   1. Cocokkan `order_id`+`amount` dengan order `pending` di DB.
 *   2. Panggil OTORITATIF status transaksi → hanya lanjut bila API konfirmasi lunas.
 * Aktivasi lewat RPC `activate_paid_order` (ATOMIK + idempoten, service_role):
 * order→paid + undangan→active (active_until, published_at) dalam satu transaksi.
 * Notifikasi duplikat tak menggandakan aktivasi.
 *
 * Kode HTTP dipilih untuk perilaku retry Pakasir: 200 = diterima (aktif / sengaja
 * tak aktif), 400 = payload/aset salah (permanen), 503/500 = transien (retry).
 * `api_key` hanya di server (di dalam `verifyTransaction`), tak pernah di-log.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_LIMIT = { max: 300, windowMs: 60_000 };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  // Rate limit endpoint publik (backstop flood; jalur mahal `transaction-status`
  // sudah tergerbang oleh kecocokan order di DB).
  const rl = await checkClientRateLimit("pakasir-webhook", WEBHOOK_LIMIT);
  if (!rl.ok) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "30" },
    });
  }

  // Batasi ukuran body dengan CAP BYTE KERAS (payload webhook hanya ratusan
  // byte) — dibatasi saat MEMBACA stream, bukan sekadar percaya Content-Length.
  const raw = await readBodyCapped(req, 8192);
  if (raw === null) return json({ ok: false }, 413);

  // Parse + validasi bentuk payload.
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false }, 400);
  }
  const parsed = pakasirWebhookSchema.safeParse(body);
  if (!parsed.success) {
    // 503, BUKAN 400. Bentuk payload yang tak kita kenali adalah kegagalan KITA
    // (skema belum mengikuti perubahan Pakasir), bukan payload cacat dari mereka
    // — dan 400 diperlakukan Pakasir sebagai final sehingga membuang satu-satunya
    // percobaan ulang gratis yang kita punya. Persis itu yang akan terjadi saat
    // Pakasir beralih ke v2: v2 tak lagi mengirim `project`.
    reportHandledError(
      new Error("Pakasir webhook: bentuk payload tak dikenal"),
      "payment.webhook.shape",
    );
    return json({ ok: false }, 503);
  }
  const p = parsed.data;

  // Lapisan 0: autentikasi pemanggil lewat `X-Secret` (v2). Menggantikan cek
  // `project` lama, yang mustahil dilakukan pada payload v2.
  const secret = checkWebhookSecret(req.headers.get("x-secret"));
  if (secret === "mismatch") {
    // Ditolak SEBELUM menyentuh DB — tak ada lookup untuk pemanggil tak sah.
    return json({ ok: false }, 401);
  }
  if (secret === "unset") {
    // Sengaja TIDAK menolak: menolak akan mematikan seluruh aktivasi pembayaran
    // bila pemilik belum menyalin secret-nya saat deploy pertama. Dilaporkan agar
    // "belum diisi" tak menjadi keadaan permanen.
    reportHandledError(
      new Error(
        "PAKASIR_WEBHOOK_SECRET belum di-set — webhook tak terautentikasi",
      ),
      "payment.webhook.secret-unset",
    );
  }

  // Sesudah peralihan ke BinderPay (DECISIONS #102), saklar `getPaymentGateway`
  // berlaku GLOBAL: verifikasi di bawah akan bertanya ke BinderPay, yang tak
  // mengenal transaksi Pakasir — pembayaran Pakasir yang SAH tak mungkin
  // terkonfirmasi di sini. Dilaporkan agar ditangani manual (cek dashboard
  // Pakasir), bukan di-ack senyap sebagai "belum lunas".
  if (process.env.BINDERPAY_PARTNER_ID) {
    reportHandledError(
      new Error("webhook Pakasir sesudah peralihan — tak bisa diverifikasi"),
      "payment.webhook.pakasir-pasca-peralihan",
      { orderCode: p.order_id },
    );
    return json({ ok: true, activated: false }, 200);
  }

  // Webhook SANDBOX yang tiba di produksi = salah konfigurasi project, dan
  // mengaktifkannya berarti memberi layanan atas pembayaran yang tak pernah ada.
  // Ack 200 (tak ada gunanya Pakasir mencoba ulang) tetapi LAPORKAN.
  if (p.is_sandbox === true && process.env.NODE_ENV === "production") {
    reportHandledError(
      new Error("Pakasir webhook SANDBOX diterima di produksi — diabaikan"),
      "payment.webhook.sandbox-in-prod",
      { orderCode: p.order_id },
    );
    return json({ ok: true, activated: false }, 200);
  }

  const admin = createSupabaseAdminClient();

  // Lapisan 1: cocokkan order (order_code) + amount. Order tak dikenal / amount
  // tak cocok → ack 200 tanpa aktivasi (payload = sinyal, bukan bukti).
  const { data: order, error: lookupError } = await admin
    .from("orders")
    .select("id, order_code, amount_idr, status, txn_id")
    .eq("order_code", p.order_id)
    .maybeSingle();
  // Error DB TRANSIEN (supabase-js tak throw → kembalikan {error}) → 503 agar
  // Pakasir retry; JANGAN 200-ack (itu final → aktivasi pembayaran nyata bisa hilang).
  if (lookupError) return json({ ok: false }, 503);
  if (!order || order.amount_idr !== p.amount) {
    return json({ ok: true, activated: false }, 200);
  }
  // Bila KEDUANYA punya `txn_id`, keduanya harus cocok. Webhook yang membawa
  // txn_id milik transaksi lain untuk order_code kita adalah sinyal yang tak
  // boleh dipercaya — dan karena find-or-create Pakasir berkunci `order_id`
  // saja, ketidakcocokan di sini berarti ada transaksi kedua untuk satu order.
  if (p.txn_id && order.txn_id && p.txn_id !== order.txn_id) {
    reportHandledError(
      new Error("Pakasir webhook: txn_id tak cocok dengan order"),
      "payment.webhook.txn-mismatch",
      { orderCode: order.order_code },
    );
    return json({ ok: true, activated: false }, 200);
  }
  // Idempoten cepat: sudah paid / bukan pending → tak ada aktivasi baru.
  if (order.status !== "pending") {
    return json({ ok: true, activated: false }, 200);
  }

  // Lapisan 2 + aktivasi: verifikasi OTORITATIF ke `transaction-status` (v2) lalu
  // aktivasi ATOMIK (RPC service_role) — inti bersama `verifyAndActivate`
  // (dipakai juga halaman cek-status M3.3). `raw_notification` menyimpan payload
  // webhook mentah (untuk rekonsiliasi admin). Kode HTTP dipetakan ke perilaku
  // retry Pakasir: transien → 5xx (retry), keputusan final → 200.
  const outcome = await verifyAndActivate(
    admin,
    {
      order_code: order.order_code,
      amount_idr: order.amount_idr,
      // HANYA dari baris order, tak pernah dari payload: rujukan pilihan
      // pemanggil membuka jalan bagi transaksi lunas milik order LAIN untuk
      // "membuktikan" order ini. Order tanpa `txn_id` tak pernah sampai ke
      // pelanggan (`terbitkanLink`), jadi tak ada pembayaran sah yang hilang.
      txn_id: order.txn_id,
    },
    toDbJson(p),
  );
  switch (outcome.kind) {
    // Transien saat verifikasi → 503 agar Pakasir retry nanti.
    case "verify_error":
      return json({ ok: false }, 503);
    // Kontrak verifikasi PUTUS (401/400/404/bentuk tak dikenal). Retry tak akan
    // menolong, TETAPI jawabannya tetap 503 dan bukan 200: 200 bersifat final,
    // dan pembayaran nyata yang di-ack tanpa aktivasi akan HILANG. Lebih baik
    // Pakasir mengulang dengan sia-sia daripada kita kehilangan satu pembayaran;
    // yang menyelesaikannya adalah laporan `payment.verify.broken` yang sudah
    // dipancarkan `verifyAndActivate`, bukan kode HTTP ini.
    case "verify_broken":
      return json({ ok: false }, 503);
    // RPC gagal (transien) → 500 agar Pakasir retry.
    case "rpc_error":
      return json({ ok: false }, 500);
    // API tak konfirmasi lunas / amount tak cocok → JANGAN aktifkan (ack 200).
    case "not_confirmed":
    case "mismatch":
      return json({ ok: true, activated: false }, 200);
    case "ok": {
      // Kuitansi + link aktif HANYA pada transisi `activated` (sekali; RPC
      // terkunci baris → pemenang saja). Best-effort (tak menggagalkan webhook).
      if (outcome.result === "activated") {
        await notifyOrderPaid(admin, order.order_code);
      }
      // Segarkan cache ISR halaman publik saat baru aktif (DECISIONS #25) — juga
      // saat already_paid (idempoten, aman) agar cache konsisten pasca-aktivasi.
      if (
        outcome.slug &&
        (outcome.result === "activated" || outcome.result === "already_paid")
      ) {
        revalidatePath(`/${outcome.slug}`);
      }
      return json({ ok: true, activated: outcome.result === "activated" }, 200);
    }
  }
}
