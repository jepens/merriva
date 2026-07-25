/**
 * Batas paket — SATU sumber kebenaran di sisi TypeScript (SPEC §2, §4.4).
 *
 * Bentuk mentah di DB: `packages.limits` JSONB
 * `{max_photos, max_guests, youtube, all_themes, watermark}` (DATA-MODEL §1).
 * Undangan `draft` belum punya paket → jatuh ke lantai **Basic**. Penegakan
 * OTORITATIF ada di DB (fungsi `invitation_effective_limits` + RPC atomik
 * `insert_gallery_media` / `insert_guest`); modul ini dipakai untuk RESOLUSI &
 * TAMPILAN sisi server (mis. watermark, penghitung "x/8 foto"). Fungsi murni →
 * mudah diuji. `maxGuests: null` = tanpa batas (Premium).
 */

export interface PackageLimits {
  maxPhotos: number;
  /** null = tanpa batas (Premium). */
  maxGuests: number | null;
  youtube: boolean;
  allThemes: boolean;
  watermark: boolean;
}

/** Lantai Basic — dipakai untuk draft tanpa paket & sebagai fallback aman. */
export const BASIC_LIMITS: PackageLimits = {
  maxPhotos: 8,
  maxGuests: 150,
  youtube: false,
  allThemes: false,
  watermark: true,
};

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Resolusi `packages.limits` (JSONB tak berbentuk / null) → `PackageLimits`
 * bertipe dengan lantai Basic per-kunci. Aturan `max_guests`:
 *  - kunci **tak ada** (draft / paket lawas) → lantai Basic (150),
 *  - JSON **null** eksplisit → `null` = tanpa batas (Premium),
 *  - angka > 0 → nilai itu,
 *  - selain itu (0, negatif, tipe lain) → lantai Basic (fail-safe, BUKAN unlimited).
 */
export function resolveLimits(raw: unknown): PackageLimits {
  if (raw === null || typeof raw !== "object") return BASIC_LIMITS;
  const o = raw as Record<string, unknown>;

  let maxGuests: number | null;
  if ("max_guests" in o) {
    const v = o.max_guests;
    if (v === null)
      maxGuests = null; // eksplisit tanpa batas (Premium)
    else if (typeof v === "number" && Number.isFinite(v) && v > 0)
      maxGuests = Math.trunc(v);
    else maxGuests = BASIC_LIMITS.maxGuests; // malformed → lantai aman
  } else {
    maxGuests = BASIC_LIMITS.maxGuests;
  }

  return {
    maxPhotos: positiveInt(o.max_photos, BASIC_LIMITS.maxPhotos),
    maxGuests,
    youtube: bool(o.youtube, BASIC_LIMITS.youtube),
    allThemes: bool(o.all_themes, BASIC_LIMITS.allThemes),
    watermark: bool(o.watermark, BASIC_LIMITS.watermark),
  };
}

/** true bila kuota tamu masih ada (jumlah sekarang < batas). null = tanpa batas. */
export function guestQuotaAvailable(
  limits: PackageLimits,
  currentCount: number,
): boolean {
  return limits.maxGuests === null || currentCount < limits.maxGuests;
}

/** true bila kuota foto masih ada (jumlah sekarang < batas). */
export function photoQuotaAvailable(
  limits: PackageLimits,
  currentCount: number,
): boolean {
  return currentCount < limits.maxPhotos;
}
