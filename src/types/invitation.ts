import type {
  InvitationContent,
  InvitationSettings,
} from "@/lib/validation/content";
import type { InvitationCategory } from "@/types";

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
  /** Musik latar terpilih, sudah di-resolve dari `songs` (URL domain sendiri). */
  music: { url: string; title: string } | null;
  /** Watermark footer untuk paket Basic (SPEC §2). */
  watermark: boolean;
}
