import type { VideoView } from "./video";
import { youtubeVideoId } from "./youtube";

/**
 * Gerbang section video untuk `index.tsx` tema — kembaran SERVER dari
 * `hasThemeVideo` di `./video`.
 *
 * Kenapa bukan `hasThemeVideo` langsung: modul itu `"use client"`, dan fungsi
 * yang diekspor modul client di Server Component hanyalah client reference —
 * memanggilnya melempar "Attempted to call hasThemeVideo() from the server".
 * Unit test tak menangkapnya (tanpa batas RSC); halaman undangan yang memuat
 * video akan menangkapnya. Kesetaraan keduanya dikunci `theme-video-gate.test.ts`.
 */
export function hasVideoSection(
  video: VideoView | null | undefined,
  youtubeUrl: string | null | undefined,
): boolean {
  return Boolean(video) || youtubeVideoId(youtubeUrl) !== null;
}
