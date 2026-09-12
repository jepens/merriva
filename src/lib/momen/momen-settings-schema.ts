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
export const momenSettingsSchema = z
  .strictObject({
    quotaPerGuest: z
      .number()
      .int()
      .min(MOMEN_LIMITS.quotaPerGuestMin)
      .max(MOMEN_LIMITS.quotaPerGuestMax),
    /**
     * Niat host dikirim EKSPLISIT. Tanpa ini server tak bisa membedakan
     * "Langsung tampil" dari "Jadwal sendiri yang tanggalnya lupa diisi" —
     * keduanya mengirim `revealAt: null`, sehingga salah-isi diam-diam menjadi
     * "semua foto tamu langsung publik": kebalikan niat host, pada fitur privasi,
     * dan TAK BISA dibatalkan setelah foto terlihat.
     */
    revealMode: z.enum(["instant", "schedule"]),
    /** ISO datetime dengan offset (timestamptz) atau null = instan. */
    revealAt: z.iso.datetime({ offset: true }).nullable(),
    defaultFilter: filterEnum,
    allowLibraryUpload: z.boolean(),
  })
  .refine((v) => v.revealMode === "instant" || v.revealAt !== null, {
    message: "waktu reveal wajib diisi pada mode jadwal",
    path: ["revealAt"],
  });

export type MomenSettings = z.infer<typeof momenSettingsSchema>;

/**
 * Payload memulai sesi tamu (`startMomenSessionAction`): nama + deviceId. Nama &
 * deviceId lalu diikat ke cookie sesi ber-tanda-tangan (lib/momen/session) →
 * saat unggah, keduanya diambil dari cookie, bukan dari form (cegah impersonasi).
 */
export const momenSessionStartSchema = z.strictObject({
  guestName,
  deviceId: z.uuid(),
});

export type MomenSessionStart = z.infer<typeof momenSessionStartSchema>;

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
  /**
   * Asal foto yang DIDEKLARASIKAN klien, untuk menegakkan setting host
   * `allow_library_upload` di server (sebelumnya hanya dicek di UI). Ini
   * penegakan KEBIJAKAN, bukan batas keamanan: setelah di-bake di kanvas, foto
   * kamera dan galeri adalah byte yang identik sehingga provenance tak bisa
   * dibuktikan server. Yang ditutup: jalur bypass diam-diam di UI.
   */
  source: z.enum(["camera", "library"]),
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
