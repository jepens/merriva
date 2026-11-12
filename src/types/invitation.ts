import type {
  InvitationContent,
  InvitationSettings,
} from "@/lib/validation/content";
import type { InvitationCategory } from "@/types";
import type { VideoView } from "@/themes/_shared/video";

/** Satu sesi acara siap-render (dari `invitation_events`; waktu UTC ISO string). */
export interface InvitationEventView {
  id: string;
  name: string;
  startAt: string;
  endAt: string | null;
  venueName: string | null;
  address: string | null;
  mapsUrl: string | null;
}

/** Satu foto galeri siap-render — URL domain sendiri, 2 varian (thumb + display). */
export interface InvitationMediaView {
  id: string;
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
}

/**
 * Foto bernama siap render. `x`/`y` adalah titik fokus ternormalisasi (0..1)
 * yang dipetakan ke `object-position` DAN `transform-origin`, sehingga
 * memperbesar terjadi di titik yang dipilih pemilik — bukan di tengah wadah.
 */
export interface PhotoView {
  url: string;
  x: number;
  y: number;
  zoom: number;
}

/**
 * Props komponen tema (SPEC §7.1 / ARCHITECTURE §5) — KONTRAK INTI.
 * Tema DILARANG mengambil data sendiri; semua sudah ter-parse & siap render.
 * Personalisasi tamu (nama dari `?g=token`) disuntik terpisah di client (M2)
 * agar tidak membatalkan cache ISR halaman.
 *
 * Mengubah bentuk ini = keputusan "tanya dulu" (berdampak semua tema).
 */
export interface InvitationData {
  slug: string;
  category: InvitationCategory;
  eventDate: string | null;
  content: InvitationContent;
  settings: InvitationSettings;
  events: InvitationEventView[];
  media: InvitationMediaView[];
  /**
   * Foto bernama sudah di-resolve di server (dari `content.coverPhoto` /
   * `groom.photo` / `bride.photo`), atau `null` bila tak ada. Tema TIDAK
   * menerima `storage_path` mentah (boundary: tanpa URL vendor) — render foto
   * bila ada, jika tidak pakai fallback monogram.
   *
   * Penyesuaian pemilik ikut di sini sebagai ANGKA, bukan dipanggang ke
   * berkasnya: rasio pangkas milik TEMA (THEME-CONTRACT §3). Terapkan dengan
   * `fotoStyle()` dari `@/themes/_shared/foto` — satu baris, sama di semua tema.
   */
  coverPhoto?: PhotoView | null;
  groomPhoto?: PhotoView | null;
  bridePhoto?: PhotoView | null;
  /**
   * Foto per entri love story (DECISIONS #127), sejajar INDEKS dengan
   * `content.story` (hasil parse — entri yang gugur saat parse tak punya slot
   * di sini). `null` = entri itu tanpa foto. Hanya kategori wedding; hanya foto
   * milik undangan ini sendiri. Tema yang merendernya wajib mendeklarasikan
   * `media.story` di `options.ts` (THEME-CONTRACT §2) — tanpa itu bidang
   * unggahnya tak pernah muncul di editor. Opsional supaya demo-data tema tak
   * perlu menyebutnya.
   */
  storyPhotos?: (PhotoView | null)[];
  /**
   * Foto khas tema (DECISIONS #131) per id slot `x-…` yang dideklarasikan tema
   * di `media.slots` (mis. warta `x-berita`), sudah di-resolve di server —
   * hanya foto milik undangan ini. Kunci tak ada = belum diunggah. Opsional
   * supaya demo-data tema tak perlu menyebutnya.
   */
  themePhotos?: Readonly<Record<string, PhotoView>>;
  /**
   * Video unggahan (FASE J) sudah di-resolve ke URL domain sendiri, atau `null`.
   * Bersama `content.youtubeUrl` ia sudah DISARING paket di server
   * (`limits.youtube`): paket tanpa fitur video menerima `null` DAN
   * `youtubeUrl` kosong, jadi tema cukup memeriksa `hasThemeVideo()`.
   * Opsional supaya demo-data tema tak perlu menyebutnya.
   */
  video?: VideoView | null;
  /**
   * Info live streaming berupa TULISAN BIASA (mis. nama kanal), DECISIONS #135
   * — sudah digerbang Premium di server. Isian berupa tautan https tidak
   * pernah ada di sini: ia menjadi `content.livestreamUrl` (tombol). Paling
   * banyak satu dari keduanya terisi. Saat ini hanya Warta yang merendernya.
   */
  livestreamText?: string;
  /** Musik latar terpilih, sudah di-resolve dari `songs` (URL domain sendiri). */
  music: { url: string; title: string } | null;
  /** Watermark footer untuk paket Basic (SPEC §2). */
  watermark: boolean;
}
