import { z } from "zod";

import { VIDEO_MAX_SECONDS } from "@/lib/video";

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

/** Perbesaran maksimum foto bernama. Lebih dari ini, varian display jatuh di
 * bawah lebar wadah tema pada layar 3x dan wajahnya terlihat pecah. */
export const PHOTO_MAX_ZOOM = 4;

/**
 * Foto bernama + penyesuaian tampilannya (THEME-CONTRACT §3).
 *
 * Berkasnya disimpan UTUH; yang disimpan di sini hanyalah ANGKA — titik fokus
 * (0..1) dan perbesaran. Rasio pangkas karena itu milik TEMA, bukan milik
 * berkas: tiap tema memangkas sendiri lewat `object-fit: cover` di wadahnya,
 * dan pemilik yang berganti tema tak kehilangan apa pun.
 *
 * String telanjang tetap diterima dan dinormalkan ke titik tengah — foto yang
 * terlanjur tersimpan sebelum ini tetap sah TANPA migrasi.
 */
export const photoSchema = z.preprocess(
  (v) => (typeof v === "string" ? { path: v } : v),
  z.object({
    path: storagePathSchema,
    // `.catch()` bukan kelonggaran: angka rusak dari data lama tak boleh
    // menjatuhkan SELURUH draft undangan hanya karena satu titik fokus.
    x: z.number().min(0).max(1).default(0.5).catch(0.5),
    y: z.number().min(0).max(1).default(0.5).catch(0.5),
    zoom: z.number().min(1).max(PHOTO_MAX_ZOOM).default(1).catch(1),
  }),
);

export type Photo = z.output<typeof photoSchema>;

/**
 * Video undangan (FASE J) — path OBJEK PENUH berkas video + poster (bukan
 * prefix, lihat `lib/media.ts`), plus metadata yang dibaca klien saat unggah.
 * Dimensi dipakai tema untuk rasio bingkai; durasi dicatat sebagai bukti
 * batas ≤60 dtk yang ditegakkan klien (server tak mentranskode, jadi tak bisa
 * membacanya sendiri). Tak ada `.catch()` seperti foto: satu-satunya penulis
 * nilai ini adalah editor kita, sesaat setelah unggah.
 */
export const videoSchema = z.object({
  path: storagePathSchema,
  poster: storagePathSchema.optional(),
  width: z.number().int().positive().max(8000),
  height: z.number().int().positive().max(8000),
  durationSec: z.number().positive().max(VIDEO_MAX_SECONDS),
});

export type Video = z.output<typeof videoSchema>;

/**
 * Musik unggahan klien (DECISIONS #121) — rujukan ke objek
 * `audio/{undangan}/{uuid}.mp3` yang dikembalikan route unggah, plus nama
 * berkas asli untuk ditampilkan di editor (tak pernah dirender ke tamu).
 *
 * Sengaja TANPA durasi/pernyataan hak: nilai di `content` ditulis klien (dan
 * bisa ditulis langsung lewat PostgREST), jadi catatan yang bisa dipercaya
 * tinggal di tabel `music_uploads` yang hanya ditulis server. `.catch()` hanya
 * pada `name` (pola `photoSchema`): nama rusak tak boleh menjatuhkan SELURUH
 * draft. `path` tetap ketat seperti video — satu-satunya penulisnya editor kita,
 * dan perakit render tetap mengikatnya ke undangan lewat `isCustomMusicPath`.
 */
export const customMusicSchema = z.object({
  path: storagePathSchema,
  name: z
    .string()
    .trim()
    .max(L.common.customMusicName)
    .optional()
    .catch(undefined),
});

export type CustomMusic = z.output<typeof customMusicSchema>;

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
  photo: photoSchema.optional(),
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
 * Entri LOVE STORY (wedding) = entri cerita + satu foto opsional (DECISIONS
 * #127). Hanya love story: agenda (korporat) & doa/harapan (keluarga) berbagi
 * `storyEntrySchema` dan sengaja tanpa foto.
 *
 * Bentuk foto = foto bernama (`photoSchema`, jalur `inv/<id>/foto/<uuid>`).
 * `.catch(undefined)`: path di `content` ditulis klien, dan satu foto rusak dari
 * 20 entri tak boleh menggagalkan parse SELURUH konten (tema lalu jatuh ke
 * kerangka kosong) — fotonya saja yang gugur.
 */
export const loveStoryEntrySchema = storyEntrySchema.extend({
  // Narasi love story OPSIONAL (#132): halaman cerita boleh hanya judul +
  // foto + keterangan ("Lamaran" di acuan Warta). Keluarannya tetap string
  // ("" bila kosong) supaya kontrak `StoryEntry` di tema tak berubah.
  narrative: z.string().trim().max(L.storyEntry.narrative).default(""),
  photo: photoSchema.optional().catch(undefined),
});

/**
 * Field display yang sama di semua kategori. Di UI muncul di step "Pengaturan"
 * (SPEC §4.4 step 7) tetapi secara data adalah KONTEN (ditampilkan di undangan),
 * bukan `settings` (perilaku/tampilan).
 */
/** Kunci foto khas tema = id slot `x-…` di `media.slots` tema (THEME-CONTRACT §2). */
export const THEME_PHOTO_KEY_RE = /^x-[a-z0-9-]{1,30}$/;
/** Jauh di atas kebutuhan tema mana pun (warta: 1) — pagar JSONB liar saja. */
const MAX_THEME_PHOTOS = 8;

/**
 * Foto khas tema (DECISIONS #131), mis. `{ "x-berita": { path, x, y, zoom } }`
 * — foto bernama milik SATU tema yang tak punya kunci tetap di `content`.
 * Kunci & nilai disaring satu per satu, bukan ditolak sekaligus: kunci di luar
 * pola (termasuk `__proto__`) atau foto rusak hanya GUGUR, supaya satu nilai
 * liar tak menjatuhkan parse SELURUH konten (pola `customMusic`). Kosong →
 * `undefined`.
 */
export const themePhotosSchema = z.preprocess(
  (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, p] of Object.entries(v)) {
      if (n >= MAX_THEME_PHOTOS || !THEME_PHOTO_KEY_RE.test(k)) continue;
      const r = photoSchema.safeParse(p);
      if (!r.success) continue;
      out[k] = r.data;
      n += 1;
    }
    return n > 0 ? out : undefined;
  },
  z.record(z.string().regex(THEME_PHOTO_KEY_RE), photoSchema).optional(),
);

export const commonContentFields = {
  coverPhoto: photoSchema.optional(),
  /** Foto khas tema (`x-…`) — lihat `themePhotosSchema`. */
  themePhotos: themePhotosSchema,
  greetingOpen: z.string().trim().max(L.common.greeting).optional(),
  greetingClose: z.string().trim().max(L.common.greeting).optional(),
  quote: quoteSchema.optional(),
  /** Embed YouTube (fitur Premium; tier ditegakkan di server). */
  youtubeUrl: optionalFormat(youtubeUrlSchema),
  /** Video unggahan (fitur paket yang sama dengan YouTube — `limits.youtube`;
   * ditegakkan saat unggah DAN saat render). Menang atas `youtubeUrl`. */
  video: videoSchema.optional(),
  /** Lagu MP3 unggahan pemilik (Premium; ditegakkan saat unggah DAN saat
   * render). Menang atas lagu pustaka `settings.songId` saat diputar.
   * `.catch()` di sini (bukan hanya di `name`): rujukan rusak — mis. ditulis
   * langsung lewat PostgREST — cukup berarti "tanpa lagu sendiri", bukan
   * menjatuhkan skema strict & draft sekaligus sehingga undangan, judul
   * metadata, dan gambar OG jatuh ke kerangka kosong. Satu-satunya penulis
   * sahnya editor kita, yang selalu menulis bentuk yang dikembalikan route. */
  customMusic: customMusicSchema.optional().catch(undefined),
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
export type LoveStoryEntry = z.infer<typeof loveStoryEntrySchema>;
export type Quote = z.infer<typeof quoteSchema>;
