import { copy } from "@/lib/copy";
import type { PackageLimits } from "@/lib/limits";

/**
 * Daftar fitur (teks centang) sebuah paket dari batasnya — SATU sumber, dipakai
 * pemilih paket checkout (dashboard) DAN kartu harga marketing agar tak divergen.
 * Teks dari `copy.checkout.feat` (terpusat, bahasa Indonesia).
 */
/**
 * `durationMonths = null` → baris "Masa aktif N bulan" DIHILANGKAN. Dipakai
 * panel upgrade (B3): upgrade tidak membeli masa aktif, dan mencantumkan durasi
 * nominal paket tujuan di sana adalah janji yang tak akan dipenuhi — paket
 * Premium biasanya berdurasi lebih panjang daripada Basic, tetapi upgrade hanya
 * menaikkan paket untuk SISA masa aktif yang sedang berjalan.
 */
export function packageFeatures(
  limits: PackageLimits,
  durationMonths: number | null,
): string[] {
  const c = copy.checkout.feat;
  return [
    c.rsvp,
    c.photos(limits.maxPhotos),
    limits.maxGuests === null
      ? c.guestsUnlimited
      : c.guestsLimited(limits.maxGuests),
    limits.allThemes ? c.allThemes : c.standardThemes,
    ...(limits.youtube ? [c.youtube] : []),
    limits.watermark ? c.watermark : c.noWatermark,
    ...(durationMonths === null
      ? []
      : [copy.checkout.perDuration(durationMonths)]),
  ];
}
