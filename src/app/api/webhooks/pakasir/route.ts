import { revalidatePath } from "next/cache";

import { toDbJson } from "@/lib/json";
import { pakasirWebhookSchema } from "@/lib/payment/webhook";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyOrderPaid } from "@/server/email/notify";
import { verifyAndActivate } from "@/server/payment/reconcile";

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

/**
 * Baca body sebagai teks dengan CAP BYTE KERAS — batalkan stream begitu melewati
 * `maxBytes`, jadi TIDAK bergantung pada Content-Length (yang bisa absen pada
 * body chunked / dipalsukan). Return null bila melebihi batas.
 */
async function readBodyCapped(
  req: Request,
  maxBytes: number,
): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) {
    const t = await req.text();
    return new TextEncoder().encode(t).length > maxBytes ? null : t;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf);
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

  // Lapisan 2 + aktivasi: verifikasi OTORITATIF ke transactiondetail lalu
  // aktivasi ATOMIK (RPC service_role) — inti bersama `verifyAndActivate`
  // (dipakai juga halaman cek-status M3.3). `raw_notification` menyimpan payload
  // webhook mentah (untuk rekonsiliasi admin). Kode HTTP dipetakan ke perilaku
  // retry Pakasir: transien → 5xx (retry), keputusan final → 200.
  const outcome = await verifyAndActivate(
    admin,
    { order_code: order.order_code, amount_idr: order.amount_idr },
    toDbJson(p),
  );
  switch (outcome.kind) {
    // Error jaringan/HTTP/bentuk saat verifikasi → 503 agar Pakasir retry nanti.
    case "verify_error":
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
