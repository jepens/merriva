import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  verifikasiTandaTangan,
  waktuMasukToleransi,
} from "./binderpay-signature";

/**
 * Baca body sebagai teks dengan CAP BYTE KERAS — batalkan stream begitu melewati
 * `maxBytes`, jadi TIDAK bergantung pada Content-Length (yang bisa absen pada
 * body chunked / dipalsukan). Return null bila melebihi batas.
 *
 * Teks MENTAH, bukan hasil `req.json()`: tanda tangan BinderPay dihitung atas
 * byte yang dikirim, dan parse-lalu-stringify mengubah urutan kunci & spasi.
 */
export async function readBodyCapped(
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

/**
 * Payload webhook Pakasir — menerima bentuk v1 DAN v2 (AUDIT-2026-10-13).
 *
 * v1: `{amount, order_id, project, status, payment_method, completed_at}`
 * v2: `{txn_id, order_id, amount, is_sandbox, status, completed_at}`
 *
 * Perhatikan v2 **tidak lagi mengirim `project`** — dan skema lama MEWAJIBKANNYA.
 * Handler menjawab 400 untuk bentuk tak dikenal, dan 400 membuat Pakasir
 * memperlakukannya sebagai kegagalan PERMANEN lalu berhenti mencoba ulang. Jadi
 * skema lama bukan sekadar ketat: begitu Pakasir beralih ke v2, SETIAP webhook
 * pembayaran ditolak final dan tak ada satu pun undangan teraktivasi lewat jalur
 * itu. Itu sebabnya skema ini hanya MEWAJIBKAN dua field yang benar-benar
 * dipakai handler untuk mencocokkan order, dan sisanya opsional.
 *
 * Prinsipnya: dokumen Pakasir sudah terbukti salah dua kali dalam satu hari
 * (`expires_at` ditulis `expired_at`; `va_number` yang katanya `""` ternyata tak
 * ada), jadi parser ini tidak mewajibkan apa pun yang hanya dijamin dokumen.
 */
export const pakasirWebhookSchema = z.object({
  /** Kunci utama pencocokan order. Ada di v1 maupun v2. */
  order_id: z.string().min(1),
  amount: z.number().int().nonnegative(),
  /** v2. Dipakai sebagai kunci cadangan + dicocokkan dgn `orders.txn_id`. */
  txn_id: z.string().min(1).nullish(),
  /** v1 saja — v2 tak mengirimnya, jadi TIDAK boleh wajib. */
  project: z.string().min(1).nullish(),
  /** v2 mengirimnya; dipakai menolak webhook sandbox yang tiba di produksi. */
  is_sandbox: z.boolean().nullish(),
  status: z.string().nullish(),
  payment_method: z.string().nullish(),
  completed_at: z.string().nullish(),
});

export type PakasirWebhookPayload = z.infer<typeof pakasirWebhookSchema>;

/**
 * Callback QRIS BinderPay (`qr-mpm-notify`). Seperti skema Pakasir, hanya
 * MEWAJIBKAN field yang dipakai mencocokkan order: nominal di callback TIDAK
 * dipakai (contoh dokumen mereka 35490 tak cocok dengan apa pun) — bukti lunas
 * dan nominalnya diambil dari `qr-mpm-query`.
 *
 * Hasil parse-nya pula yang disimpan ke `orders.raw_notification`, jadi field
 * opsional di bawah adalah DAFTAR PUTIH rekonsiliasi: zod membuang kunci yang
 * tak tercantum — termasuk `additionalInfo.buyerRef`, NAMA pembayar dari
 * penerbit e-wallet. Data pribadi yang tak kita perlukan tak ikut tersimpan.
 */
export const binderPayCallbackSchema = z.object({
  originalPartnerReferenceNo: z.string().min(1),
  latestTransactionStatus: z.string().nullish(),
  originalReferenceNo: z.unknown().optional(),
  amount: z.unknown().optional(),
  feeAmount: z.unknown().optional(),
  additionalInfo: z
    .object({
      channel: z.unknown().optional(),
      contractId: z.unknown().optional(),
      brandName: z.unknown().optional(),
      rrn: z.unknown().optional(),
    })
    .optional()
    .catch(undefined),
});

/**
 * Path SNAP TETAP yang ditandatangani BinderPay untuk callback QRIS — BUKAN path
 * URL callback kita (dokumentasi "Signature Callback Validation" dan
 * `verifyCallbackSignature` di kedua SDK resmi). Memverifikasi dengan
 * `new URL(req.url).pathname` akan menolak SETIAP callback yang sah.
 */
export const PATH_CALLBACK_QRIS = "/v1.0/qr/qr-mpm-notify";

export type CallbackBinderPayCheck =
  "ok" | "unset" | "mismatch" | "partner_lain";

/**
 * Autentikasi callback BinderPay: tanda tangan RSA atas bodi MENTAH, stempel
 * waktu dalam toleransi (tanda tangannya tanpa nonce — gerbang waktu adalah
 * satu-satunya pertahanan replay), lalu Partner ID.
 *
 * Seperti `X-Secret` Pakasir, ini ADITIF: bukti lunas tetap dari query. `unset`
 * (kunci publik belum diisi) karena itu tidak menolak — pemanggil melaporkannya.
 *
 * `partner_lain` = tanda tangan SAH dengan `X-PARTNER-ID` yang bukan milik kita
 * (mis. proyek SANDBOX yang callback-nya diarahkan ke produksi). Pemanggil
 * melaporkannya; aktivasi tetap hanya lewat query. Hanya bila header-nya ADA:
 * dokumentasi tak menjanjikan `X-PARTNER-ID` di callback, dan SDK resmi
 * memverifikasi tanpa membacanya.
 */
export function cekCallbackBinderPay(
  raw: string,
  header: {
    signature: string | null;
    timestamp: string | null;
    partnerId: string | null;
  },
  sekarangMs: number,
): CallbackBinderPayCheck {
  const kunciB64 = process.env.BINDERPAY_PUBLIC_KEY_B64;
  if (!kunciB64) return "unset";
  if (!header.signature || !header.timestamp) return "mismatch";
  if (!waktuMasukToleransi(header.timestamp, sekarangMs)) return "mismatch";
  const sah = verifikasiTandaTangan(
    {
      metode: "POST",
      path: PATH_CALLBACK_QRIS,
      bodi: raw,
      waktu: header.timestamp,
    },
    header.signature,
    Buffer.from(kunciB64, "base64").toString("utf8"),
  );
  if (!sah) return "mismatch";
  if (
    header.partnerId &&
    header.partnerId !== process.env.BINDERPAY_PARTNER_ID
  ) {
    return "partner_lain";
  }
  return "ok";
}

export type WebhookSecretCheck = "ok" | "mismatch" | "unset";

/**
 * Verifikasi header `X-Secret` webhook v2.
 *
 * SEJAK v2 WEBHOOK PAKASIR BISA DIAUTENTIKASI. Dokumen v2 (`pakasir.com/p/webhook`)
 * mendokumentasikan satu header, `X-Secret`, yang nilainya dilihat/di-reset di
 * halaman detail project. Premis lama proyek ini — "webhook Pakasir TANPA
 * signature" (SPEC §4.8, CLAUDE.md) — karena itu sudah kedaluwarsa.
 *
 * Yang TIDAK berubah adalah KESIMPULANNYA: verifikasi otoritatif tetap wajib
 * sebelum aktivasi. Header ini ADITIF — ia menyaring pemanggil palsu lebih awal
 * dan lebih murah, bukan menggantikan bukti lunas.
 *
 * `unset` (env belum diisi) SENGAJA tidak menolak. Menolak akan berarti: saat
 * deploy produksi pertama, bila pemilik belum menyalin secret-nya, SELURUH
 * aktivasi pembayaran mati — kegagalan yang jauh lebih mahal daripada webhook
 * tak tersaring, terutama karena lapisan otoritatif tetap berjalan di belakangnya.
 * Pemanggil melaporkannya ke Sentry supaya "belum diisi" tidak menjadi permanen.
 */
export function checkWebhookSecret(header: string | null): WebhookSecretCheck {
  const expected = process.env.PAKASIR_WEBHOOK_SECRET;
  if (!expected) return "unset";
  if (!header) return "mismatch";
  // Panjang dibandingkan lebih dulu: `timingSafeEqual` MELEMPAR bila panjang
  // buffer berbeda, dan perbandingan panjang sendiri tak membocorkan isi.
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return "mismatch";
  return timingSafeEqual(a, b) ? "ok" : "mismatch";
}
