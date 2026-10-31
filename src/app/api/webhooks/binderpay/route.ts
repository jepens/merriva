import { revalidatePath } from "next/cache";

import { toDbJson } from "@/lib/json";
import { reportHandledError } from "@/lib/observability";
import {
  binderPayCallbackSchema,
  cekCallbackBinderPay,
  readBodyCapped,
} from "@/lib/payment/webhook";
import { checkClientRateLimit } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyOrderPaid } from "@/server/email/notify";
import { verifyAndActivate } from "@/server/payment/reconcile";

/**
 * Callback QRIS BinderPay (DECISIONS #99). Padanan route Pakasir, dengan
 * tanda tangan RSA menggantikan `X-Secret`. Payload tetap SINYAL, bukan bukti:
 *   0. Tanda tangan + stempel waktu (`cekCallbackBinderPay`); Partner ID yang
 *      lain hanya dilaporkan.
 *   1. Cocokkan nomor order dengan order `pending` di DB.
 *   2. Verifikasi OTORITATIF lewat `qr-mpm-query` memakai pasangan nomor order +
 *      `txn_id` dari BARIS ORDER KITA — query BinderPay menggemakan nomor apa
 *      pun yang dikirim, jadi isi callback tak pernah ikut menentukan apa yang
 *      diverifikasi.
 *
 * BinderPay mengulang callback sampai menerima HTTP 200: 200 = diterima
 * (aktif / sengaja tak aktif), 5xx = transien (coba lagi), 401 = tanda tangan
 * tak sah.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_LIMIT = { max: 300, windowMs: 60_000 };

/**
 * Jawaban sukses callback QRIS, persis `successResponse("qris")` SDK resmi.
 * Yang menghentikan pengulangan adalah HTTP 200-nya; bodi ini formalitas SNAP.
 */
const DITERIMA = { responseCode: "2005200", responseMessage: "Successful" };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  // BinderPay belum menjadi gateway di environment ini (Pakasir masih jalur
  // bayarnya), jadi tak ada order yang bisa dimilikinya. 200 agar BinderPay
  // berhenti mengulang — mis. proyek sandbox yang callback-nya diarahkan ke
  // produksi sebelum peralihan.
  if (!process.env.BINDERPAY_PARTNER_ID) return json(DITERIMA, 200);

  const rl = await checkClientRateLimit("binderpay-webhook", WEBHOOK_LIMIT);
  if (!rl.ok) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "30" },
    });
  }

  // Bodi MENTAH dengan cap byte keras — tanda tangan dihitung atas byte ini.
  const raw = await readBodyCapped(req, 8192);
  if (raw === null) return json({ ok: false }, 413);

  const cek = cekCallbackBinderPay(
    raw,
    {
      signature: req.headers.get("x-signature"),
      timestamp: req.headers.get("x-timestamp"),
      partnerId: req.headers.get("x-partner-id"),
    },
    Date.now(),
  );
  // Ditolak SEBELUM menyentuh DB — tak ada lookup untuk pemanggil tak sah.
  if (cek === "mismatch") return json({ ok: false }, 401);
  if (cek === "partner_lain") {
    // Dilaporkan, TIDAK dibuang: header ini belum terukur, dan bila callback
    // produksi ternyata membawa nilai lain, membuangnya mematikan SETIAP
    // callback sah. Penjaganya tetap query di bawah — callback proyek lain
    // (mis. sandbox) tak bisa terkonfirmasi lewat order & kredensial kita.
    reportHandledError(
      new Error("BinderPay callback ber-X-PARTNER-ID lain"),
      "payment.webhook.partner-lain",
      { partnerId: req.headers.get("x-partner-id") },
    );
  }
  if (cek === "unset") {
    // Sengaja tidak menolak (lihat `cekCallbackBinderPay`): aktivasi tetap
    // menunggu query otoritatif. Dilaporkan agar tak menjadi permanen.
    reportHandledError(
      new Error(
        "BINDERPAY_PUBLIC_KEY_B64 belum di-set — callback tak terautentikasi",
      ),
      "payment.webhook.binderpay-key-unset",
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false }, 400);
  }
  const parsed = binderPayCallbackSchema.safeParse(body);
  if (!parsed.success) {
    // 503, bukan 400: bentuk yang tak kita kenali adalah kegagalan KITA, dan
    // jawaban non-200 membuat BinderPay mengulang — tak ada yang hilang.
    reportHandledError(
      new Error("BinderPay callback: bentuk payload tak dikenal"),
      "payment.webhook.shape",
    );
    return json({ ok: false }, 503);
  }

  const admin = createSupabaseAdminClient();
  const { data: order, error: lookupError } = await admin
    .from("orders")
    .select("order_code, amount_idr, status, txn_id")
    .eq("order_code", parsed.data.originalPartnerReferenceNo)
    .maybeSingle();
  // Galat DB transien → 503 agar BinderPay mengulang; 200 bersifat final.
  if (lookupError) return json({ ok: false }, 503);
  // Order tak dikenal / sudah diproses → tak ada aktivasi baru.
  if (!order || order.status !== "pending") return json(DITERIMA, 200);

  const outcome = await verifyAndActivate(
    admin,
    {
      order_code: order.order_code,
      amount_idr: order.amount_idr,
      txn_id: order.txn_id,
    },
    // Hasil parse (daftar putih), bukan `body` — lihat binderPayCallbackSchema.
    toDbJson(parsed.data),
  );
  switch (outcome.kind) {
    // Transien, ATAU kontrak putus: keduanya 503. 200 bersifat final, dan
    // pembayaran nyata yang di-ack tanpa aktivasi akan HILANG — laporan
    // `payment.verify.broken` dari `verifyAndActivate` yang menyelesaikannya.
    case "verify_error":
    case "verify_broken":
      return json({ ok: false }, 503);
    case "rpc_error":
      return json({ ok: false }, 500);
    case "not_confirmed":
      // Callback bertanda tangan sah berkata LUNAS, query belum: jeda status
      // antar-sistem. 503 agar BinderPay mengulang (hanya ±3 kali) — 200 di
      // sini mengakhiri pengulangan dan aktivasi menunggu poller atau cron.
      // Dilaporkan: bila menetap, query dan callback berselisih paham.
      if (parsed.data.latestTransactionStatus === "00") {
        reportHandledError(
          new Error("callback BinderPay lunas, query belum mengonfirmasi"),
          "payment.webhook.unconfirmed",
          { orderCode: order.order_code },
        );
        return json({ ok: false }, 503);
      }
      return json(DITERIMA, 200);
    // Nominal tak cocok → JANGAN aktifkan (dilaporkan `verifyAndActivate`).
    case "mismatch":
      return json(DITERIMA, 200);
    case "ok": {
      if (outcome.result === "activated") {
        await notifyOrderPaid(admin, order.order_code);
      }
      if (
        outcome.slug &&
        (outcome.result === "activated" || outcome.result === "already_paid")
      ) {
        revalidatePath(`/${outcome.slug}`);
      }
      return json(DITERIMA, 200);
    }
  }
}
