import type { InvitationMediaView, PhotoView } from "@/types/invitation";

import {
  demoPhotoCredits,
  demoPhotos,
  type DemoPhotoCredit,
} from "./demo-photos.generated";

export type { DemoPhotoCredit };

/**
 * Foto demo Pexels (aset lokal `/demo/<slug>/`) untuk sebuah tema, atau `null`
 * bila skrip `pnpm demo:photos` belum dijalankan → pemanggil memakai fallback
 * swatch SVG-nya sendiri. Akses map di-cast eksplisit karena
 * `noUncheckedIndexedAccess` tak aktif (kunci tak dikenal = `undefined` runtime).
 */
export function demoPhotosFor(slug: string): InvitationMediaView[] | null {
  const list = (
    demoPhotos as Record<string, InvitationMediaView[] | undefined>
  )[slug];
  return list && list.length > 0 ? list : null;
}

/** Kredit fotografer Pexels satu tema (footer preview) — kosong bila belum ada. */
export function demoPhotoCreditsFor(slug: string): DemoPhotoCredit[] {
  return (
    (demoPhotoCredits as Record<string, DemoPhotoCredit[] | undefined>)[slug] ??
    []
  );
}

/** Semua fotografer unik lintas tema (footer katalog /tema). */
export function allDemoPhotographers(): { name: string; url: string }[] {
  const seen = new Map<string, { name: string; url: string }>();
  for (const credits of Object.values(demoPhotoCredits)) {
    for (const c of credits) {
      if (!seen.has(c.photographerUrl)) {
        seen.set(c.photographerUrl, {
          name: c.photographer,
          url: c.photographerUrl,
        });
      }
    }
  }
  return [...seen.values()];
}

/**
 * URL foto demo -> `PhotoView` siap render. Demo selalu memakai titik tengah
 * tanpa perbesaran: katalog memamerkan TEMANYA, bukan penyesuaian seseorang.
 */
export function demoPhoto(url: string | undefined | null): PhotoView | null {
  return url ? { url, x: 0.5, y: 0.5, zoom: 1 } : null;
}
