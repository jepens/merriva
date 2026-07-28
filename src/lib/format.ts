/**
 * Formatter tampilan (SPEC §10 "formatter rupiah"). MURNI/teruji. Uang selalu
 * integer IDR (CLAUDE.md) → tanpa desimal, ribuan dengan titik gaya Indonesia.
 */

/** `99000` → `"Rp99.000"`. Non-integer dibulatkan ke bawah (integer IDR). */
export function formatIdr(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.trunc(amount) : 0;
  return `Rp${new Intl.NumberFormat("id-ID").format(safe)}`;
}
