/* AUTO-GENERATED oleh scripts/fetch-demo-photos.mjs — JANGAN sunting tangan.
 *
 * Regenerasi: `pnpm demo:photos` (butuh PEXELS_API_KEY di .env). Skrip mengunduh
 * foto ke /public/demo/<slug>/ lalu menulis ulang berkas ini. Selama kedua map
 * masih kosong (skrip belum dijalankan), tiap demo-data.ts memakai fallback
 * swatch SVG-nya sendiri.
 *
 * Lisensi Pexels mewajibkan tautan Pexels + kredit fotografer — ditampilkan di
 * footer /tema & /preview via komponen PexelsCredit (lihat DECISIONS).
 */
import type { InvitationMediaView } from "@/types/invitation";

export interface DemoPhotoCredit {
  photographer: string;
  photographerUrl: string;
  /** Halaman foto di Pexels (tautan kredit). */
  pexelsUrl: string;
  alt: string;
}

export const demoPhotos: Record<string, InvitationMediaView[]> = {};

export const demoPhotoCredits: Record<string, DemoPhotoCredit[]> = {};
