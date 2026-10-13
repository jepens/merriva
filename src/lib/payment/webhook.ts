import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

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
