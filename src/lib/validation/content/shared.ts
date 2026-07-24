import { z } from "zod";

/**
 * Sub-skema bersama untuk `invitations.content` (SPEC §4.4). Dipakai lintas
 * kategori (wedding/corporate/family). Semua teks di-`trim`; batas panjang
 * konservatif agar payload JSONB tetap ramping untuk ISR.
 *
 * Catatan: JADWAL disimpan ternormalisasi di `invitation_events` (lihat
 * `event.ts`), MEDIA galeri di tabel `media` — keduanya BUKAN bagian dari
 * `content`. Content hanya menyimpan `storage_path` untuk foto bernama
 * (cover/mempelai/logo) sebagai referensi relatif, tanpa URL vendor.
 */

/**
 * Path relatif objek storage (immutable hash) — bukan URL vendor.
 * Bentuk positif: mulai alfanumerik lalu `[a-z0-9/_.-]`. Ini menolak `://`,
 * leading `//` (protocol-relative), backslash, dan traversal `..` (SPEC §6.4:
 * "URL vendor tidak pernah masuk DB"). Contoh sah: `inv/abc123/1600.webp`.
 */
export const storagePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(
    /^[a-z0-9][a-z0-9/_.-]*$/i,
    "Harus path relatif storage, bukan URL vendor",
  )
  .refine((p) => !p.includes(".."), "Path tidak boleh mengandung '..'");

/** Tautan YouTube (fitur Premium; penegakan tier di server, bukan di sini). */
export const youtubeUrlSchema = z
  .url("URL tidak valid")
  .max(200)
  .refine(
    (u) => /(?:youtube\.com|youtu\.be)/i.test(u),
    "Harus tautan YouTube yang valid",
  );

/** Kutipan / ayat pembuka. */
export const quoteSchema = z.object({
  text: z.string().trim().max(500),
  source: z.string().trim().max(120).optional(),
});

/** Pihak (mempelai / tokoh): nama, panggilan, orang tua, urutan anak, foto. */
export const personSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(120),
  nickname: z.string().trim().max(60).optional(),
  fatherName: z.string().trim().max(120).optional(),
  motherName: z.string().trim().max(120).optional(),
  childOrder: z.string().trim().max(160).optional(),
  photo: storagePathSchema.optional(),
});

/** Rekening bank untuk amplop digital. */
export const bankAccountSchema = z.object({
  bank: z.string().trim().min(1, "Nama bank wajib diisi").max(60),
  number: z.string().trim().min(1, "Nomor rekening wajib diisi").max(40),
  holder: z.string().trim().min(1, "Atas nama wajib diisi").max(120),
});

/** E-wallet (GoPay/OVO/Dana/ShopeePay, dll). */
export const ewalletSchema = z.object({
  provider: z.string().trim().min(1, "Nama e-wallet wajib diisi").max(40),
  number: z.string().trim().min(1, "Nomor wajib diisi").max(40),
  holder: z.string().trim().max(120).optional(),
});

/** Amplop digital (SPEC §4.6): multi-rekening + e-wallet + alamat kado, toggle. */
export const envelopeSchema = z.object({
  enabled: z.boolean().default(false),
  banks: z.array(bankAccountSchema).max(6).default([]),
  ewallets: z.array(ewalletSchema).max(6).default([]),
  giftAddress: z.string().trim().max(300).optional(),
});

/** Default amplop (nonaktif, tanpa entri). */
export const EMPTY_ENVELOPE: z.infer<typeof envelopeSchema> = {
  enabled: false,
  banks: [],
  ewallets: [],
};

/** Entri cerita/timeline (love story / agenda / doa) — judul, tanggal, narasi. */
export const storyEntrySchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi").max(120),
  date: z.string().trim().max(60).optional(),
  narrative: z.string().trim().min(1, "Narasi wajib diisi").max(2000),
});

/**
 * Field display yang sama di semua kategori. Di UI muncul di step "Pengaturan"
 * (SPEC §4.4 step 7) tetapi secara data adalah KONTEN (ditampilkan di undangan),
 * bukan `settings` (perilaku/tampilan).
 */
export const commonContentFields = {
  coverPhoto: storagePathSchema.optional(),
  greetingOpen: z.string().trim().max(1000).optional(),
  greetingClose: z.string().trim().max(1000).optional(),
  quote: quoteSchema.optional(),
  /** Embed YouTube (fitur Premium; tier ditegakkan di server). */
  youtubeUrl: youtubeUrlSchema.optional(),
  /** Tautan live streaming (fitur Premium — SPEC §2). */
  livestreamUrl: z.url("Tautan tidak valid").max(500).optional(),
  // Factory default: setiap parse dapat array `banks`/`ewallets` SEGAR.
  // `.default(objek)` akan meng-alias referensi array antar-parse (Zod v4
  // shallowClone) → mutasi in-place bocor lintas undangan. (Temuan review M1.2.)
  envelope: envelopeSchema.default(() => ({
    enabled: false,
    banks: [],
    ewallets: [],
  })),
};

export type Person = z.infer<typeof personSchema>;
export type BankAccount = z.infer<typeof bankAccountSchema>;
export type Ewallet = z.infer<typeof ewalletSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export type StoryEntry = z.infer<typeof storyEntrySchema>;
export type Quote = z.infer<typeof quoteSchema>;
