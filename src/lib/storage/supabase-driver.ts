import type { StorageDriver, StorageObjectPath, UploadInput } from "./types";

/** Bangun URL publik dari domain sendiri + path relatif (tanpa URL vendor). */
function publicUrl(path: StorageObjectPath): string {
  const base = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}

/**
 * Driver Supabase Storage.
 * Skeleton M0 — `upload`/`delete` diimplementasikan di M1 (fitur upload media).
 */
export class SupabaseStorageDriver implements StorageDriver {
  upload(_input: UploadInput): Promise<StorageObjectPath> {
    throw new Error(
      "SupabaseStorageDriver.upload belum diimplementasikan (M1).",
    );
  }

  getPublicUrl(path: StorageObjectPath): string {
    return publicUrl(path);
  }

  delete(_path: StorageObjectPath): Promise<void> {
    throw new Error(
      "SupabaseStorageDriver.delete belum diimplementasikan (M1).",
    );
  }
}
