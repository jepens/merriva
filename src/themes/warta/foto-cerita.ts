import type { InvitationMediaView, PhotoView } from "@/types/invitation";

/** Foto pendamping satu entri Feature: unggahan pemilik, foto galeri, atau tak ada. */
export type FotoCerita =
  { unggah: PhotoView } | { galeri: InvitationMediaView } | null;

/**
 * Foto per entri cerita Warta (DECISIONS #127) — satu aturan, murni:
 *
 * - Ada SATU saja entri berfoto unggahan → hanya foto unggahan yang dipakai;
 *   entri tanpa foto tampil tanpa foto. Mencampur keduanya membuat foto galeri
 *   muncul di entri yang sengaja dibiarkan tanpa foto.
 * - Tak ada satu pun → galeri berurutan (cerita ke-i = foto galeri ke-i), yaitu
 *   perilaku Warta sebelum ada unggah foto cerita: undangan yang tak pernah
 *   mengunggah foto cerita tetap tampil penuh seperti koran.
 */
export function fotoCerita(
  jumlah: number,
  storyPhotos: readonly (PhotoView | null)[] | undefined,
  media: readonly InvitationMediaView[],
): FotoCerita[] {
  const unggah = storyPhotos ?? [];
  const adaUnggahan = unggah.some((p) => p !== null);
  return Array.from({ length: jumlah }, (_, i) => {
    if (adaUnggahan) {
      const p = unggah[i];
      return p ? { unggah: p } : null;
    }
    const m = media[i];
    return m ? { galeri: m } : null;
  });
}
