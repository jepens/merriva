import { revalidatePath } from "next/cache";

import { toDbJson } from "@/lib/json";
import { getPaymentGateway } from "@/lib/payment";
import { pakasirWebhookSchema } from "@/lib/payment/webhook";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook pembayaran Pakasir (SPEC §4.8 / M3.2). Webhook Pakasir **TANPA
 * signature** → payload adalah SINYAL, bukan bukti. Verifikasi WAJIB berlapis:
 *   0. `project` payload = `PAKASIR_PROJECT_SLUG` kita.
 *   1. Cocokkan `order_id`+`amount` dengan order `pending` di DB.
 *   2. Panggil OTORITATIF `transactiondetail` → hanya lanjut bila API konfirmasi lunas.
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
  // Rate limit endpoint publik (backstop flood; jalur mahal `transactiondetail`
  // sudah tergerbang oleh kecocokan order di DB).
  const rl = checkRateLimit(
    await clientRateKey("pakasir-webhook"),
    WEBHOOK_LIMIT,
  );
  if (!rl.ok) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "30" },
    });
  }

  // Batasi ukuran body (payload webhook hanya ratusan byte). Content-Length bisa
  // absen/dipalsukan → guard murah saja; proxy (Cloudflare/Traefik) membatasi hulu.
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 8192) return json({ ok: false }, 413);

  // Parse + validasi bentuk payload.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false }, 400);
  }
  const parsed = pakasirWebhookSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false }, 400);
  const p = parsed.data;

  // Lapisan 0: project harus milik kita.
  const projectSlug = process.env.PAKASIR_PROJECT_SLUG;
  if (!projectSlug || p.project !== projectSlug)
    return json({ ok: false }, 400);

  const admin = createSupabaseAdminClient();

  // Lapisan 1: cocokkan order (order_code) + amount. Order tak dikenal / amount
  // tak cocok → ack 200 tanpa aktivasi (payload = sinyal, bukan bukti).
  const { data: order, error: lookupError } = await admin
    .from("orders")
    .select("id, order_code, amount_idr, status")
    .eq("order_code", p.order_id)
    .maybeSingle();
  // Error DB TRANSIEN (supabase-js tak throw → kembalikan {error}) → 503 agar
  // Pakasir retry; JANGAN 200-ack (itu final → aktivasi pembayaran nyata bisa hilang).
  if (lookupError) return json({ ok: false }, 503);
  if (!order || order.amount_idr !== p.amount) {
    return json({ ok: true, activated: false }, 200);
  }
  // Idempoten cepat: sudah paid / bukan pending → tak ada aktivasi baru.
  if (order.status !== "pending") {
    return json({ ok: true, activated: false }, 200);
  }

  // Lapisan 2: verifikasi OTORITATIF ke transactiondetail. Error jaringan/HTTP
  // → 503 agar Pakasir retry nanti (jangan aktifkan atas kegagalan verifikasi).
  let verification;
  try {
    verification = await getPaymentGateway().verifyTransaction(
      order.order_code,
      order.amount_idr,
    );
  } catch {
    return json({ ok: false }, 503);
  }
  // API tak mengonfirmasi lunas / amount tak cocok → JANGAN aktifkan (ack 200).
  if (
    verification.status !== "paid" ||
    verification.amountIdr !== order.amount_idr
  ) {
    return json({ ok: true, activated: false }, 200);
  }

  // Aktivasi ATOMIK + idempoten (RPC service_role).
  const { data: rpc, error } = await admin.rpc("activate_paid_order", {
    p_order_code: order.order_code,
    p_amount: verification.amountIdr,
    // Metode & waktu bayar dari sumber OTORITATIF (transactiondetail), bukan
    // payload webhook tak-terverifikasi. `raw_notification` tetap menyimpan payload.
    p_payment_method: verification.paymentMethod,
    p_paid_at: verification.paidAt,
    p_raw: toDbJson(p),
  });
  if (error) return json({ ok: false }, 500);

  const row = rpc?.[0];
  // Segarkan cache ISR halaman publik saat baru aktif (DECISIONS #25) — juga saat
  // already_paid (idempoten, aman) agar cache konsisten pasca-aktivasi.
  if (
    row?.slug &&
    (row.result === "activated" || row.result === "already_paid")
  ) {
    revalidatePath(`/${row.slug}`);
  }
  return json({ ok: true, activated: row?.result === "activated" }, 200);
}
