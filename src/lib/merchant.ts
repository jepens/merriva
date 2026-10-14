import { copy } from "@/lib/copy";

/**
 * Kesiapan identitas pelaku usaha (PP 80/2019, Permendag 31/2020 PMSE).
 *
 * Identitas WAJIB tampil sebelum pembayaran. Hari ini `copy.marketing.legal
 * .merchant` masih kosong, dan halaman legal menangani itu dengan ANGGUN: field
 * kosong tak dirender, jadi `/syarat` dan `/refund` tetap terbaca benar —
 * hanya saja tanpa identitas siapa pun.
 *
 * Keanggunan itulah bahayanya. Tak ada galat, tak ada bagian yang rusak, tak
 * ada tanda apa pun bahwa sesuatu yang diwajibkan hukum sedang hilang. Satu-
 * satunya yang akan memberi tahu adalah aggregator pembayaran — saat menangguhkan
 * akun merchant, biasanya setelah uang pelanggan sudah masuk.
 *
 * `name` + `address` adalah minimumnya; `owner` dan NPWP/NIB menyusul bila ada.
 */
export function merchantIdentityReady(): boolean {
  // Field yang masih kosong bertipe literal `""`, jadi TypeScript menganggap
  // pengecekan di bawah selalu-salah. Cast ini membuat kodenya tetap sama
  // setelah pemilik mengisinya (pola yang sudah dipakai `LegalPage`).
  const m = copy.marketing.legal.merchant as Record<string, string>;
  return Boolean(m.name.trim() && m.address.trim());
}
