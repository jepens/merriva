/**
 * Kontrak abstraksi storage media (SPEC §6.4 / DECISIONS #6).
 *
 * Aturan yang membuat pindah vendor = ganti env:
 *  - DB hanya menyimpan `path` relatif (immutable hash) — TIDAK pernah URL vendor.
 *  - Media selalu disajikan dari domain sendiri (NEXT_PUBLIC_MEDIA_URL).
 *  - Driver dipilih via env STORAGE_DRIVER (`supabase` | `r2`).
 */

/** Path relatif objek media (immutable hash), mis. `inv/abc123/1600.webp`. */
export type StorageObjectPath = string;

export interface UploadInput {
  path: StorageObjectPath;
  body: ArrayBuffer | Uint8Array | Blob;
  contentType: string;
}

export interface StorageDriver {
  /** Unggah objek ke `path` relatif; mengembalikan path yang disimpan ke DB. */
  upload(input: UploadInput): Promise<StorageObjectPath>;
  /** URL publik untuk tamu — SELALU domain sendiri, bukan URL vendor. */
  getPublicUrl(path: StorageObjectPath): string;
  /** Hapus objek. */
  delete(path: StorageObjectPath): Promise<void>;
}

export type StorageDriverName = "supabase" | "r2";
