import type { SupabaseClient } from "@supabase/supabase-js";

import { toDbJson } from "@/lib/json";
import { reportHandledError } from "@/lib/observability";
import { getPaymentGateway } from "@/lib/payment";
import { PakasirError } from "@/lib/payment/pakasir";
import type { Database, Json } from "@/types/database";

/**
 * Order `pending` yang siap direkonsiliasi (dari lookup DB oleh pemanggil).
 */
export interface PendingOrder {
  order_code: string;
  amount_idr: number;
  /**
   * Rujukan transaksi gateway (Pakasir v2 `txn_id`). WAJIB diisi pemanggil sejak
   * v2: status transaksi berkunci `txn_id`, bukan `order_code`. `null` berarti
   * transaksi belum pernah berhasil dibuat → verifikasi melempar, dan itu
   * disengaja (lihat `verifyTransaction`).
   */
  txn_id?: string | null;
}

/**
 * Hasil rekonsiliasi order. `ok` membawa `result` mentah dari RPC
 * `activate_paid_order`; sisanya adalah kondisi verifikasi/transien yang
 * dipetakan berbeda oleh tiap pemanggil (webhook → kode HTTP retry; halaman cek
 * status → state UI poll).
 */
export type ReconcileOutcome =
  | {
      kind: "ok";
      result: "activated" | "already_paid" | "held" | "invalid" | "not_found";
      slug: string | null;
    }
  | { kind: "not_confirmed" } // API OTORITATIF: belum lunas → jangan aktifkan
  | { kind: "mismatch" } // API OTORITATIF: amount tak cocok → jangan aktifkan
  | { kind: "verify_error" } // TRANSIEN: jaringan / 429 / 5xx → coba lagi
  /**
   * Verifikasi gagal dengan cara yang TIDAK akan membaik bila diulang: 401
   * (api_key salah), 400, 404, bentuk respons tak dikenal, atau `txn_id` yang
   * tak tersimpan.
   *
   * Dipisah dari `verify_error` karena keduanya menuntut tindakan yang berbeda,
   * dan menyatukannya membuat yang parah tak terlihat: "jaringan kedip" memang
   * sembuh sendiri, sedangkan "kontrak API putus" akan diam-diam dicoba ulang
   * selamanya. Itu risiko nyata di sini — `transaction-status` v2 TIDAK
   * TERDOKUMENTASI, jadi bila Pakasir mengubah atau menghapusnya, inilah satu-
   * satunya sinyal yang akan memberi tahu kita.
   */
  | { kind: "verify_broken" }
  | { kind: "rpc_error" }; // transien: RPC gagal

/**
 * INTI verifikasi→aktivasi terverifikasi (dipakai webhook M3.2 & cek-status
 * M3.3 — SATU tempat untuk invarian keamanan "verifikasi dulu, baru aktivasi").
 *
 * Webhook Pakasir TANPA signature → payload = sinyal, bukan bukti. Langkah:
 *   1. Verifikasi OTORITATIF ke `transactiondetail` (`verifyTransaction`).
 *   2. HANYA bila API konfirmasi `paid` DAN amount cocok → aktivasi ATOMIK via
 *      RPC service_role `activate_paid_order` (idempoten: kunci baris order).
 *
 * FAIL-CLOSED: kegagalan verifikasi/RPC → outcome transien (`verify_error` /
 * `rpc_error`); pemanggil retry/poll lagi, TIDAK mengaktifkan. `api_key` hanya
 * di dalam `verifyTransaction` — tak pernah menyentuh outcome/log.
 *
 * `rawOverride`: payload yang disimpan ke `orders.raw_notification` untuk
 * rekonsiliasi admin. Webhook memberi payload webhook; bila tak diberi (jalur
 * cek-status), disimpan respons OTORITATIF `transactiondetail`.
 */
export async function verifyAndActivate(
  admin: SupabaseClient<Database>,
  order: PendingOrder,
  rawOverride?: Json,
): Promise<ReconcileOutcome> {
  let verification;
  try {
    // getPaymentGateway() di dalam try: config env tak lengkap → transien, bukan crash.
    verification = await getPaymentGateway().verifyTransaction(
      order.order_code,
      order.amount_idr,
      order.txn_id ?? null,
    );
  } catch (err) {
    // JALUR UANG: kegagalan verifikasi tak boleh senyap — tanpa sinyal ini,
    // Pakasir/jaringan bermasalah di hari-H hanya tampak sebagai order pending.
    //
    // `transient` dipakai untuk MEMBEDAKAN, bukan untuk memutuskan apakah
    // melaporkan: keduanya tetap dilaporkan, tetapi dengan area berbeda supaya
    // "kontrak putus" tidak tenggelam di antara gangguan jaringan biasa. Galat
    // yang bukan `PakasirError` (mis. DNS, abort timeout) diperlakukan transien.
    const putus = err instanceof PakasirError && !err.transient;
    reportHandledError(
      err,
      putus ? "payment.verify.broken" : "payment.verify",
      {
        orderCode: order.order_code,
      },
    );
    return { kind: putus ? "verify_broken" : "verify_error" };
  }

  if (verification.status !== "paid") return { kind: "not_confirmed" };
  if (verification.amountIdr !== order.amount_idr) {
    // Garis pertahanan terakhir terhadap jebakan `find-or-create` Pakasir v2
    // (berkunci `order_id` saja, mengabaikan amount baru). Aktivasi ditolak —
    // tetapi penolakan itu DULU senyap di ketiga pemanggil, padahal artinya
    // pelanggan kemungkinan SUDAH membayar nominal yang salah dan tak akan
    // pernah menerima layanannya. Satu-satunya jalan keluarnya manual
    // (refund atau aktivasi manual admin), jadi harus ada yang memberi tahu.
    reportHandledError(
      new Error(
        `nominal transaksi (${verification.amountIdr}) tak cocok dengan order (${order.amount_idr})`,
      ),
      "payment.mismatch",
      { orderCode: order.order_code },
    );
    return { kind: "mismatch" };
  }

  const { data, error } = await admin.rpc("activate_paid_order", {
    p_order_code: order.order_code,
    p_amount: verification.amountIdr,
    // Metode & waktu bayar HANYA dari sumber OTORITATIF (transactiondetail).
    p_payment_method: verification.paymentMethod,
    p_paid_at: verification.paidAt,
    p_raw:
      rawOverride ??
      toDbJson({ source: "status_poll", transaction: verification }),
  });
  if (error) {
    // Pembayaran SUDAH terverifikasi lunas tetapi aktivasi gagal → paling parah:
    // pelanggan membayar dan tak menerima apa pun sampai poll/cron berikutnya.
    reportHandledError(error, "payment.activate", {
      orderCode: order.order_code,
    });
    return { kind: "rpc_error" };
  }

  const row = data?.[0];
  const result = row?.result;
  if (
    result === "activated" ||
    result === "already_paid" ||
    result === "held" ||
    result === "invalid" ||
    result === "not_found"
  ) {
    return { kind: "ok", result, slug: row?.slug ?? null };
  }
  // Bentuk hasil RPC tak dikenal (mustahil pada skema saat ini) → transien.
  return { kind: "rpc_error" };
}
