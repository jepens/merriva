import { z } from "zod";

import { FIELD_LIMITS as L } from "./field-limits";

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

/**
 * True bila string TIDAK diawali skema URL berbahaya (`javascript:`/`data:`/
 * `vbscript:`/`file:`). Semua karakter kontrol/spasi (code ≤ 0x20) dibuang dulu
 * agar obfuscasi seperti "java script:" / "java\tscript:" tetap terdeteksi.
 * Dipakai di jalur DRAFT (longgar) supaya autosave tak pernah MENYIMPAN skema
 * berbahaya meski format URL penuh belum divalidasi (validasi ketat di aktivasi).
 */
export function noDangerousUrlScheme(v: string): boolean {
  const s = Array.from(v)
    .filter((c) => c.charCodeAt(0) > 0x20)
    .join("")
    .toLowerCase();
  return !/^(javascript|data|vbscript|file):/.test(s);
}

/** Wajib URL absolut ber-skema https (tolak http/`javascript:`/`data:`/dst). */
export function httpsUrlSchema(max: number, message = "Tautan harus https") {
  return z
    .string()
    .trim()
    .max(max)
    .refine((u) => {
      try {
        return new URL(u).protocol === "https:";
      } catch {
        return false;
      }
    }, message);
}

/** Host YouTube resmi (dicocokkan EKSAK atas hostname, bukan substring). */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

/**
 * Tautan YouTube (fitur Premium; penegakan tier di server). WAJIB https + host
 * YouTube resmi via `new URL().hostname` (BUKAN substring — cegah bypass seperti
 * `javascript:...//youtu.be` atau `https://evil/?x=youtube.com`).
 */
export const youtubeUrlSchema = z
  .string()
  .trim()
  .max(L.common.youtubeUrl)
  .refine((u) => {
    try {
      const url = new URL(u);
      return (
        url.protocol === "https:" &&
        YOUTUBE_HOSTS.has(url.hostname.toLowerCase())
      );
    } catch {
      return false;
    }
  }, "Harus tautan YouTube resmi (https)");

/**
 * Optional berformat (email/URL) yang menerima "" — nilai default input kosong
 * dari react-hook-form — sebagai "tidak diisi" (→ undefined). Tanpa ini
 * `z.email()/z.url()` menolak string kosong, sehingga autosave/aktivasi GAGAL
 * begitu field opsional dibiarkan kosong (mis. email PIC corporate). Key tetap
 * opsional (`.optional()` terluar) → aman untuk data lama tanpa field ini.
 * (Temuan review editor multi-kategori.)
 */
export function optionalFormat<T extends z.ZodType>(schema: T) {
  return schema.or(z.literal("").transform(() => undefined)).optional();
}

/** Kutipan / ayat pembuka. */
export const quoteSchema = z.object({
  text: z.string().trim().max(L.quote.text),
  source: z.string().trim().max(L.quote.source).optional(),
});

/** Pihak (mempelai / tokoh): nama, panggilan, orang tua, urutan anak, foto. */
export const personSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(L.person.name),
  nickname: z.string().trim().max(L.person.nickname).optional(),
  fatherName: z.string().trim().max(L.person.fatherName).optional(),
  motherName: z.string().trim().max(L.person.motherName).optional(),
  childOrder: z.string().trim().max(L.person.childOrder).optional(),
  photo: storagePathSchema.optional(),
});

/** Rekening bank untuk amplop digital. */
export const bankAccountSchema = z.object({
  bank: z.string().trim().min(1, "Nama bank wajib diisi").max(L.bank.bank),
  number: z
    .string()
    .trim()
    .min(1, "Nomor rekening wajib diisi")
    .max(L.bank.number),
  holder: z.string().trim().min(1, "Atas nama wajib diisi").max(L.bank.holder),
});

/** E-wallet (GoPay/OVO/Dana/ShopeePay, dll). */
export const ewalletSchema = z.object({
  provider: z
    .string()
    .trim()
    .min(1, "Nama e-wallet wajib diisi")
    .max(L.ewallet.provider),
  number: z.string().trim().min(1, "Nomor wajib diisi").max(L.ewallet.number),
  holder: z.string().trim().max(L.ewallet.holder).optional(),
});

/** Amplop digital (SPEC §4.6): multi-rekening + e-wallet + alamat kado, toggle. */
export const envelopeSchema = z.object({
  enabled: z.boolean().default(false),
  banks: z.array(bankAccountSchema).max(L.envelope.banks).default([]),
  ewallets: z.array(ewalletSchema).max(L.envelope.ewallets).default([]),
  giftAddress: z.string().trim().max(L.envelope.giftAddress).optional(),
});

/** Default amplop (nonaktif, tanpa entri). */
export const EMPTY_ENVELOPE: z.infer<typeof envelopeSchema> = {
  enabled: false,
  banks: [],
  ewallets: [],
};

/** Entri cerita/timeline (love story / agenda / doa) — judul, tanggal, narasi. */
export const storyEntrySchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi").max(L.storyEntry.title),
  date: z.string().trim().max(L.storyEntry.date).optional(),
  narrative: z
    .string()
    .trim()
    .min(1, "Narasi wajib diisi")
    .max(L.storyEntry.narrative),
});

/**
 * Field display yang sama di semua kategori. Di UI muncul di step "Pengaturan"
 * (SPEC §4.4 step 7) tetapi secara data adalah KONTEN (ditampilkan di undangan),
 * bukan `settings` (perilaku/tampilan).
 */
export const commonContentFields = {
  coverPhoto: storagePathSchema.optional(),
  greetingOpen: z.string().trim().max(L.common.greeting).optional(),
  greetingClose: z.string().trim().max(L.common.greeting).optional(),
  quote: quoteSchema.optional(),
  /** Embed YouTube (fitur Premium; tier ditegakkan di server). */
  youtubeUrl: optionalFormat(youtubeUrlSchema),
  /** Tautan live streaming (fitur Premium — SPEC §2). WAJIB https. */
  livestreamUrl: optionalFormat(
    httpsUrlSchema(
      L.common.livestreamUrl,
      "Tautan live harus URL https yang valid",
    ),
  ),
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
