import type { NamedPhotoKind } from "@/lib/media";
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
 * URL foto bernama yang SUDAH tersimpan, dirakit di server dari `storage_path`
 * (`getPublicUrl`). Dikirim ke editor sebagai nilai awal pratinjau supaya klien
 * tak pernah merakit URL media sendiri — aturan "media hanya dari domain
 * sendiri" tinggal di satu tempat (SPEC §6.4).
 */
export type NamedPhotoUrls = Partial<Record<NamedPhotoKind, string | null>>;
