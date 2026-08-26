/**
 * Skema Zod (v4) Album Momen — validasi server (MOMEN-SPEC §4–§6).
 * Pola sama dengan settings-custom-schema customizer: strictObject (tolak key
 * liar, jangan "dibersihkan diam-diam") + enum dari sumber kebenaran preset.
 */

import { z } from "zod";

import { FILM_PRESET_IDS } from "./film-presets";

/** Batas ukuran varian (selaras pipeline kompres klien 1600px/400px). */
export const MOMEN_LIMITS = {
  maxDim: 2400,
  displayBytesMax: 1_500_000,
  thumbBytesMax: 200_000,
  guestNameMax: 40,
  quotaPerGuestMin: 1,
  quotaPerGuestMax: 20,
} as const;

const filterEnum = z.enum(FILM_PRESET_IDS);

/**
 * Nama tamu: 1–40 char setelah trim, tanpa karakter kontrol dan tanpa `<`/`>`
 * (defense-in-depth; rendering tetap wajib escape). Unicode bebas (nama Jawa,
 * Tionghoa, emoji ringan tetap sah).
 */
const guestName = z
  .string()
  .trim()
  .min(1, "nama wajib diisi")
  .max(MOMEN_LIMITS.guestNameMax)
  .refine((v) => !/[\p{Cc}\p{Cf}<>]/u.test(v), "karakter tidak diizinkan");

/** Pengaturan album oleh host — payload server action `updateMomenSettings`. */
export const momenSettingsSchema = z.strictObject({
  quotaPerGuest: z
    .number()
    .int()
    .min(MOMEN_LIMITS.quotaPerGuestMin)
    .max(MOMEN_LIMITS.quotaPerGuestMax),
  /** ISO datetime dengan offset (timestamptz) atau null = instan. */
  revealAt: z.iso.datetime({ offset: true }).nullable(),
  defaultFilter: filterEnum,
  allowLibraryUpload: z.boolean(),
});

export type MomenSettings = z.infer<typeof momenSettingsSchema>;

/**
 * Metadata upload satu foto — divalidasi RPC/route SEBELUM izin upload
 * diberikan. Ukuran & dimensi dibatasi keras; `deviceId` = UUID localStorage.
 */
export const momenUploadMetaSchema = z.strictObject({
  guestName,
  deviceId: z.uuid(),
  filterId: filterEnum,
  /**
   * Format hasil encode klien. WebP = jalur utama; JPEG = fallback WAJIB untuk
   * Safari/iOS (toBlob('image/webp') tidak didukung di sana — caniuse, verif.
   * 26 Agu 2026). PNG sengaja TIDAK ada di enum: fallback PNG diam-diam browser
   * menghasilkan file raksasa tanpa kompresi lossy → harus ditolak server.
   */
  format: z.enum(["webp", "jpeg"]),
  width: z.number().int().min(1).max(MOMEN_LIMITS.maxDim),
  height: z.number().int().min(1).max(MOMEN_LIMITS.maxDim),
  displayBytes: z.number().int().min(1).max(MOMEN_LIMITS.displayBytesMax),
  thumbBytes: z.number().int().min(1).max(MOMEN_LIMITS.thumbBytesMax),
});

export type MomenUploadMeta = z.infer<typeof momenUploadMetaSchema>;

/** Aksi moderasi host terhadap satu foto. */
export const momenModerationSchema = z.strictObject({
  photoId: z.uuid(),
  action: z.enum(["hide", "show", "delete"]),
});

export type MomenModeration = z.infer<typeof momenModerationSchema>;
