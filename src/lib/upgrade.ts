import type { PackageLimits } from "@/lib/limits";

/**
 * Hitungan upgrade paket di tengah masa aktif (AUDIT-2026-10-01 B3).
 *
 * Fungsi MURNI — tak menyentuh DB, mudah diuji, dan dipakai BERSAMA oleh halaman
 * upgrade (tampilan) dan `createUpgradeCheckoutAction` (nominal otoritatif).
 * Satu sumber hitungan: angka yang dilihat pelanggan harus angka yang ditagih.
 *
 * Uang = integer IDR, tanpa float (SPEC §gaya kode).
 */

/** Satu paket kandidat dari katalog (`packages` ber-`kind='invitation'`). */
export interface UpgradeCandidate {
  code: string;
  name: string;
  priceIdr: number;
  durationMonths: number;
  limits: PackageLimits;
}

/** Kandidat yang LEBIH MAHAL dari paket sekarang, beserta selisih bayarnya. */
export interface UpgradeOption extends UpgradeCandidate {
  /** Selisih yang dibayar pelanggan. Selalu > 0. */
  differenceIdr: number;
}

/**
 * Selisih yang harus dibayar untuk pindah dari `currentPriceIdr` ke
 * `targetPriceIdr`, atau `null` bila itu BUKAN upgrade yang sah.
 *
 * `null` (bukan 0, bukan negatif) adalah inti gerbangnya. Selisih ≤ 0 berarti
 * paket yang sama atau penurunan — keduanya tak boleh menghasilkan order:
 * Rp0 di payment link Pakasir tak berarti apa-apa, dan nominal negatif akan
 * ditolak `amount_idr >= 0` jauh di hilir, setelah pelanggan dialihkan.
 * Nilai non-integer ditolak karena uang di produk ini tak pernah pecahan.
 */
export function upgradeDifference(
  currentPriceIdr: number,
  targetPriceIdr: number,
): number | null {
  if (!Number.isInteger(currentPriceIdr) || !Number.isInteger(targetPriceIdr)) {
    return null;
  }
  if (currentPriceIdr < 0 || targetPriceIdr < 0) return null;
  const difference = targetPriceIdr - currentPriceIdr;
  return difference > 0 ? difference : null;
}

/**
 * Pilihan upgrade dari katalog: hanya paket yang selisihnya sah, termurah dulu.
 *
 * Paket yang sedang dipakai tersaring dengan sendirinya (selisihnya 0 → `null`),
 * jadi tak perlu membandingkan kode — yang juga berarti dua paket berharga sama
 * tak akan pernah ditawarkan sebagai "upgrade" satu terhadap yang lain.
 */
export function upgradeOptions(
  currentPriceIdr: number,
  candidates: readonly UpgradeCandidate[],
): UpgradeOption[] {
  const options: UpgradeOption[] = [];
  for (const candidate of candidates) {
    const differenceIdr = upgradeDifference(
      currentPriceIdr,
      candidate.priceIdr,
    );
    if (differenceIdr === null) continue;
    options.push({ ...candidate, differenceIdr });
  }
  return options.sort((a, b) => a.differenceIdr - b.differenceIdr);
}

/**
 * Sisa hari masa aktif, dibulatkan ke atas. `null` bila tak ada/tak terbaca.
 *
 * Ditampilkan MENYOLOK di halaman upgrade: yang dibeli adalah peningkatan untuk
 * sisa masa aktif ini, bukan periode baru. Pelanggan dengan sisa tiga hari harus
 * melihat angka tiga sebelum membayar, bukan sesudah.
 */
export function daysUntil(
  activeUntilIso: string | null,
  nowMs: number,
): number | null {
  if (!activeUntilIso) return null;
  const until = Date.parse(activeUntilIso);
  if (Number.isNaN(until)) return null;
  return Math.max(0, Math.ceil((until - nowMs) / 86_400_000));
}
