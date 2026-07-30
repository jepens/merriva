import { copy } from "@/lib/copy";
import type { PackageLimits } from "@/lib/limits";

/**
 * Daftar fitur (teks centang) sebuah paket dari batasnya — SATU sumber, dipakai
 * pemilih paket checkout (dashboard) DAN kartu harga marketing agar tak divergen.
 * Teks dari `copy.checkout.feat` (terpusat, bahasa Indonesia).
 */
export function packageFeatures(
  limits: PackageLimits,
  durationMonths: number,
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
    copy.checkout.perDuration(durationMonths),
  ];
}
