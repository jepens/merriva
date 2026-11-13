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

/**
 * Pengaturan album oleh host — payload server action `updateMomenSettings`.
 * Tanpa waktu reveal sejak DECISIONS #137 (tamu langsung melihat fotonya
 * sendiri); `strictObject` menolak `revealMode`/`revealAt` dari klien lama.
 */
export const momenSettingsSchema = z.strictObject({
  quotaPerGuest: z
    .number()
    .int()
    .min(MOMEN_LIMITS.quotaPerGuestMin)
    .max(MOMEN_LIMITS.quotaPerGuestMax),
  defaultFilter: filterEnum,
  allowLibraryUpload: z.boolean(),
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
  /**
   * Id jepretan yang dibuat KLIEN sekali per foto dan dipakai ulang di setiap
   * percobaan kirim (DECISIONS #46 — koreksi review). Tanpa ini, unggah yang
   * MELEMPAR setelah server sempat menyimpan akan digandakan oleh tombol
   * "Kirim ulang": `momen_claim_upload` membuat id baru tiap panggilan,
   * sehingga fotonya masuk dua kali dan jatah tamu terpakai dua slot.
   * Dipakai sebagai primary key `momen_photos.id`, jadi percobaan kedua
   * menabrak PK dan diperlakukan sebagai "sudah tersimpan".
   */
  shotId: z.uuid(),
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
