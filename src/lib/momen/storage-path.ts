import { extForFormat, type EncodedFormat } from "@/lib/image/encode";

/**
 * Path objek storage foto Album Momen — MURNI (tanpa I/O). Wajib cocok dengan
 * constraint regex kolom `momen_photos.storage_path`/`thumb_path`
 * (`^momen/<album 36>/<photo 36>/(display|thumb)\.(webp|jpg)$`). Album & foto =
 * UUID (36 char) → path tak tertebak: objek hanya aman selama URL-nya tak
 * dibagikan route (URL hanya dipancarkan ke pemotretnya sendiri — aksi galeri
 * ber-sesi, #137 — atau ke pemilik). Ekstensi ikut `EncodedFormat` (jpg =
 * fallback iOS).
 */

export function momenPrefix(albumId: string, photoId: string): string {
  return `momen/${albumId}/${photoId}`;
}

export function momenDisplayPath(
  albumId: string,
  photoId: string,
  format: EncodedFormat,
): string {
  return `${momenPrefix(albumId, photoId)}/display.${extForFormat(format)}`;
}

export function momenThumbPath(
  albumId: string,
  photoId: string,
  format: EncodedFormat,
): string {
  return `${momenPrefix(albumId, photoId)}/thumb.${extForFormat(format)}`;
}

/** Kedua objek (display + thumb) satu foto — untuk unggah/hapus. */
export function momenObjectPaths(
  albumId: string,
  photoId: string,
  format: EncodedFormat,
): [display: string, thumb: string] {
  return [
    momenDisplayPath(albumId, photoId, format),
    momenThumbPath(albumId, photoId, format),
  ];
}
