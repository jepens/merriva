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

/**
 * Ukuran kanvas pratinjau tautan (OG). Satu sumber untuk `/api/og` DAN untuk
 * bingkai penyesuaian di editor — kalau keduanya mengarang sendiri, pemilik
 * membingkai foto pada rasio yang bukan rasio yang akhirnya dikirim WhatsApp.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_ASPECT = OG_SIZE.width / OG_SIZE.height;

/**
 * Varian KHUSUS pratinjau tautan: **JPEG**, bukan WebP.
 *
 * Alasannya bukan preferensi melainkan batas mesin: satori (di balik
 * `next/og`) TIDAK bisa meraster WebP. Dan cara gagalnya yang berbahaya — ia
 * tidak melempar. Ia mencatat `Unsupported image type: image/webp` lalu tetap
 * menghasilkan PNG yang sepenuhnya SAH, hanya tanpa fotonya. Dibuktikan dengan
 * probe 15 Okt 2026: kontrol PNG 26 KB berisi gambar, WebP 4,5 KB berisi latar
 * kosong. Tanpa varian ini, pratinjau WhatsApp akan terlihat "berhasil"
 * selamanya sambil tak pernah memuat satu wajah pun.
 *
 * Hanya foto SAMPUL yang punya varian ini — ia satu-satunya yang dibaca OG.
 */
export const OG_VARIANT = {
  file: "og.jpg",
  maxWidth: OG_SIZE.width,
  quality: 0.8,
} as const;

/** Batas ukuran varian OG (pertahanan server, sejalan `MEDIA_MAX_BYTES`). */
export const OG_MAX_BYTES = 700_000;

export function ogPath(prefix: string): string {
  return `${prefix}/${OG_VARIANT.file}`;
}

/**
 * Semua objek storage milik satu baris media (untuk penghapusan).
 *
 * Varian OG ikut DI SINI, bukan di daftar terpisah: penghapusan dipakai juga
 * oleh purge retensi UU PDP (`/api/cron/purge-expired`), dan daftar yang lupa
 * menyebut `og.jpg` akan meninggalkan foto wajah seseorang di disk setelah
 * seluruh data pribadinya dihapus. Foto galeri tak punya varian ini, jadi satu
 * penghapusan menyasar objek yang tak ada — tak apa: seluruh pemanggilnya
 * best-effort (`allSettled`), dan kelebihan satu panggilan saat purge jauh
 * lebih murah daripada satu objek yatim yang seharusnya sudah hilang.
 */
export function mediaObjectPaths(prefix: string): string[] {
  return [displayPath(prefix), thumbPath(prefix), ogPath(prefix)];
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

/**
 * Video undangan (FASE J). Seperti foto bernama, rujukannya hidup di `content`
 * (`content.video`) dan disimpan AUTOSAVE — tak ada baris tabel. Bedanya, yang
 * disimpan adalah path OBJEK PENUH (berkas video + poster), bukan prefix:
 * ekstensi berkasnya mengikuti container unggahan (`mp4`/`webm`/`mov`) dan
 * posternya mengikuti format yang benar-benar dihasilkan peramban
 * (`webp`, atau `jpg` di Safari/iOS — `lib/image/encode`).
 *
 * Prefix `video/{invitationId}/{videoId}`; `videoId` UUID BARU setiap unggah
 * dengan alasan yang sama seperti `namedPhotoPrefix` (cache `immutable`).
 */
export const VIDEO_EXT_BY_TYPE: Readonly<Record<string, string>> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Batas poster (satu bingkai, lebar ≤ varian display) — sejalan foto. */
export const VIDEO_POSTER_MAX_BYTES = MEDIA_MAX_BYTES.display;

export function videoPrefix(invitationId: string, videoId: string): string {
  return `video/${invitationId}/${videoId}`;
}

export function videoFilePath(prefix: string, ext: string): string {
  return `${prefix}/video.${ext}`;
}

export function videoPosterPath(prefix: string, ext: string): string {
  return `${prefix}/poster.${ext}`;
}

/**
 * Apakah `path` benar-benar objek video/poster milik `invitationId`? Gerbang
 * penghapusan, alasan & bentuknya sama dengan `isNamedPhotoPath`: path datang
 * dari klien dan storage tak mengenal kepemilikan. Cermin regex di migrasi
 * retensi video — keduanya harus berubah bersama.
 */
export function isVideoObjectPath(invitationId: string, path: string): boolean {
  if (!new RegExp(`^${UUID}$`).test(invitationId)) return false;
  return new RegExp(
    `^video/${invitationId}/${UUID}/(video\\.(mp4|webm|mov)|poster\\.(webp|jpg))$`,
  ).test(path);
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
