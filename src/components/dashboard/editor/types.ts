import type {
  DraftContent,
  EventDraft,
  InvitationSettings,
} from "@/lib/validation/content";

/**
 * Nilai form editor undangan (tipe draft: field boleh belum lengkap). SATU tipe
 * lintas kategori — `content` adalah union terdiskriminasi (wedding/corporate/
 * family) sehingga `Path<EditorValues>` mencakup gabungan path semua anggota;
 * tiap step me-`register` path kategorinya sendiri. Kategori runtime ditentukan
 * `content.category` (dari draft awal). Server memvalidasi ulang dgn skema draft.
 */
export type EditorValues = {
  eventDate: string;
  content: DraftContent;
  settings: InvitationSettings;
  events: EventDraft[];
};

/**
 * Opsi lagu untuk picker musik (langkah Pengaturan). Dirakit di server dari
 * `songs` aktif; `url` sudah domain sendiri (via `getStorage().getPublicUrl`)
 * agar `<audio>` pratinjau & halaman publik tak pernah menyentuh URL vendor.
 */
export type SongOption = {
  id: string;
  title: string;
  artist: string | null;
  url: string;
};

/**
 * Satu slot foto yang AKTIF untuk undangan ini: rasio wadah milik TEMA yang
 * sedang dipakai, plus URL foto tersimpan (null bila belum ada).
 *
 * Dirakit di server — klien tak pernah merakit URL media sendiri, dan tak
 * pernah menebak rasio. Slot yang tak ada di sini berarti tema aktif memang tak
 * merendernya, jadi editor tak menampilkan bidangnya (THEME-CONTRACT §2).
 */
export type PhotoSlotView = {
  aspect: number;
  url: string | null;
  /**
   * Slot dideklarasikan TEMA (bukan bawaan editor). Hanya bermakna untuk
   * `cover`: sampul bawaan hanya dirender `/api/og`, sampul tema juga tampil
   * di halaman undangan — label & petunjuk bidangnya berbeda.
   */
  inTheme?: boolean;
};

export type PhotoSlots = Readonly<Partial<Record<string, PhotoSlotView>>>;

/**
 * Foto per entri cerita (DECISIONS #127) — hanya ada bila TEMA AKTIF
 * mendeklarasikan `media.story` (THEME-CONTRACT §2); `null` = bidang unggahnya
 * tak ditampilkan. Dirakit di server seperti slot foto: rasio wadah milik tema,
 * dan URL foto TERSIMPAN per path (klien tak merakit URL media sendiri).
 * Per path, bukan per indeks: entri bisa dihapus dari tengah daftar.
 */
export type StoryPhotoSlot = {
  /** Rasio wadah; array = bergiliran per indeks entri (`storyPhotoAspect`). */
  aspect: number | readonly number[];
  urls: Readonly<Record<string, string>>;
  /** Tema memakai galeri berurutan selama tak ada foto cerita (catatan editor). */
  galleryFallback?: boolean;
};

/**
 * Bidang video (FASE J): `allowed` = `limits.youtube` paket undangan ini, plus
 * URL video & poster tersimpan. Dirakit di server — sama seperti slot foto,
 * klien tak pernah merakit URL media sendiri.
 */
export type VideoSlotView = {
  allowed: boolean;
  url: string | null;
  posterUrl: string | null;
};

/**
 * Bidang lagu sendiri (DECISIONS #121), dirakit di server seperti slot video:
 * - `allowed` = undangan Premium (`!limits.watermark`, konvensi gerbang
 *   Premium yang sama dengan live streaming);
 * - `lockedAt` = `invitations.music_locked_at` — kunci unggah sesudah takedown
 *   admin (ISO, null = tidak dikunci);
 * - `path` + `url` = lagu tersimpan (`content.customMusic.path`) dan URL-nya,
 *   KEDUANYA null bila belum ada, path-nya bukan objek musik milik undangan
 *   ini (`isCustomMusicPath`), atau objeknya sudah tak hidup menurut
 *   `music_uploads` (disapu cron / takedown). `path` memberi tahu editor untuk
 *   rujukan MANA `url` ini berlaku — sesudah unggah ulang, rujukan di form
 *   berbeda dan `url` tersimpan tak boleh diputar di bawah nama baru.
 */
export type MusicSlotView = {
  allowed: boolean;
  lockedAt: string | null;
  path: string | null;
  url: string | null;
};
