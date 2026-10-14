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

/**
 * Tipe varian yang diterima server. Klien mengompres ke WebP, atau JPEG bila
 * Safari/iOS tak mendukung `toBlob('image/webp')` (`lib/image/encode`). PNG dan
 * lainnya ditolak — bukan karena tak bisa ditampilkan, melainkan karena berarti
 * kompresi klien tidak berjalan dan ukurannya tak terkendali.
 */
export const ACCEPTED_VARIANT_TYPES: ReadonlySet<string> = new Set([
  "image/webp",
  "image/jpeg",
]);

/**
 * Validasi satu varian unggahan. SATU tempat untuk galeri DAN foto bernama:
 * dua salinan aturan ini akan berbeda pada hari salah satunya diperluas.
 */
export function isVariantBlob(value: unknown, maxBytes: number): value is Blob {
  return (
    value instanceof Blob &&
    ACCEPTED_VARIANT_TYPES.has(value.type) &&
    value.size > 0 &&
    value.size <= maxBytes
  );
}

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

/**
 * Foto BERNAMA (SPEC §4.4 langkah 2 & §4.5): satu foto per jenis per undangan,
 * bukan galeri. Pathnya disimpan di dalam `content` — `coverPhoto`, `logo`,
 * `groom.photo`, `bride.photo` — bukan di tabel `media`, sehingga TIDAK ikut
 * batas foto paket (batas itu tentang galeri).
 *
 * Konsekuensi yang mudah terlewat: karena tak ada baris tabel yang menunjuknya,
 * penghapusan retensi harus memanennya dari `content` SEBELUM `content`
 * dikosongkan — lihat migrasi `20261014120000_purge_named_photos`.
 */
export const NAMED_PHOTO_KINDS = ["cover", "groom", "bride", "logo"] as const;
export type NamedPhotoKind = (typeof NAMED_PHOTO_KINDS)[number];

/** Segmen folder foto bernama, membedakannya dari prefix galeri. */
const NAMED_SEGMENT = "foto";

/**
 * Prefix objek satu foto bernama. `photoId` adalah UUID BARU setiap unggah —
 * sengaja bukan nama tetap per jenis: media disajikan `immutable` setahun, jadi
 * menimpa path yang sama akan membuat Cloudflare dan peramban tamu menyajikan
 * foto LAMA sampai undangannya kedaluwarsa. Mengganti foto = path baru + objek
 * lama dihapus.
 */
export function namedPhotoPrefix(
  invitationId: string,
  photoId: string,
): string {
  return `inv/${invitationId}/${NAMED_SEGMENT}/${photoId}`;
}

/** UUID v4 kanonik huruf kecil — bentuk yang dihasilkan `crypto.randomUUID()`. */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Apakah `path` benar-benar prefix foto bernama milik `invitationId`?
 *
 * Dipakai gerbang penghapusan: tanpa ini, pemilik undangan A bisa mengirim path
 * milik undangan B — atau path galeri orang lain — dan menghapus objeknya,
 * karena storage tak mengenal kepemilikan. Sengaja pencocokan BENTUK PENUH
 * (bukan `startsWith`) supaya tak ada ruang untuk segmen tambahan.
 */
export function isNamedPhotoPath(invitationId: string, path: string): boolean {
  if (!new RegExp(`^${UUID}$`).test(invitationId)) return false;
  return new RegExp(`^inv/${invitationId}/${NAMED_SEGMENT}/${UUID}$`).test(
    path,
  );
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
