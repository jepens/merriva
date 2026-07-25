import { BASIC_LIMITS, resolveLimits } from "@/lib/limits";
import type { InvitationMediaView } from "@/types/invitation";

/**
 * Aturan media galeri (SPEC §4.4 / §6.4). Satu foto = satu baris `media` dengan
 * `storage_path` berupa PREFIX `inv/{invitationId}/{mediaId}`; dua varian WebP
 * berada di dalamnya (`1600.webp` display, `400.webp` thumb). DB tak pernah
 * menyimpan URL vendor — hanya path relatif; penyajian lewat domain sendiri
 * (`StorageDriver.getPublicUrl`). Fungsi di sini murni (tanpa I/O) → mudah diuji.
 */

/** Varian WebP: nama berkas + target lebar maksimum + kualitas encode. */
export const MEDIA_VARIANTS = {
  display: { file: "1600.webp", maxWidth: 1600, quality: 0.82 },
  thumb: { file: "400.webp", maxWidth: 400, quality: 0.75 },
} as const;

export const MEDIA_CONTENT_TYPE = "image/webp";

/** Batas ukuran unggah per varian (pertahanan server; storage juga batasi 2MB). */
export const MEDIA_MAX_BYTES = {
  display: 2_000_000,
  thumb: 400_000,
} as const;

/** Batas foto paket Basic — dipakai untuk draft tanpa paket (SPEC §2). */
export const BASIC_MAX_PHOTOS = BASIC_LIMITS.maxPhotos;

/** Prefix objek media satu foto (path relatif; UUID tak tertebak). */
export function mediaPrefix(invitationId: string, mediaId: string): string {
  return `inv/${invitationId}/${mediaId}`;
}

export function displayPath(prefix: string): string {
  return `${prefix}/${MEDIA_VARIANTS.display.file}`;
}

export function thumbPath(prefix: string): string {
  return `${prefix}/${MEDIA_VARIANTS.thumb.file}`;
}

/** Semua objek storage milik satu baris media (untuk penghapusan). */
export function mediaObjectPaths(prefix: string): string[] {
  return [displayPath(prefix), thumbPath(prefix)];
}

/** Baris `media` → view siap render (URL domain sendiri via `getUrl`). */
export function toMediaView(
  row: {
    id: string;
    storage_path: string;
    width: number | null;
    height: number | null;
  },
  getUrl: (path: string) => string,
): InvitationMediaView {
  return {
    id: row.id,
    url: getUrl(displayPath(row.storage_path)),
    thumbUrl: getUrl(thumbPath(row.storage_path)),
    width: row.width,
    height: row.height,
  };
}

/**
 * Batas foto efektif: dari paket bila valid, jika tidak Basic. Delegasi ke
 * `resolveLimits` (satu sumber kebenaran di `lib/limits.ts`).
 */
export function photoLimitFromPackage(
  limits: { max_photos?: number | null } | null | undefined,
): number {
  return resolveLimits(limits).maxPhotos;
}
