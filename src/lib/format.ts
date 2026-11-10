/**
 * Formatter tampilan (SPEC §10 "formatter rupiah"). MURNI/teruji. Uang selalu
 * integer IDR (CLAUDE.md) → tanpa desimal, ribuan dengan titik gaya Indonesia.
 */

/** `99000` → `"Rp99.000"`. Non-integer dibulatkan ke bawah (integer IDR). */
export function formatIdr(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.trunc(amount) : 0;
  return `Rp${new Intl.NumberFormat("id-ID").format(safe)}`;
}

/**
 * Nilai MENTAH `orders.payment_method` (dari Pakasir) → label tampilan.
 *
 * `labels` disuntik pemanggil (`copy.dashboard.orders.methodLabel`) agar modul
 * ini tetap murni tanpa impor. Dua sifat yang disengaja:
 *  - Kolomnya BOLEH null pada order LUNAS (`parseTransactionStatus`,
 *    `src/lib/payment/pakasir.ts`) → `null` dikembalikan, bukan string "null".
 *  - Channel yang belum pernah kita lihat DITERUSKAN apa adanya. Pada dokumen
 *    bukti pembayaran, menampilkan kode vendor lebih jujur daripada mengarang
 *    label yang belum tentu benar.
 */
export function formatPaymentMethod(
  raw: string | null | undefined,
  labels: Readonly<Record<string, string>>,
): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return labels[v.toLowerCase()] ?? v;
}
