import type { StorageDriver, StorageObjectPath, UploadInput } from "./types";

/** Bangun URL publik dari domain sendiri (cdn.merriva.id) + path relatif. */
function publicUrl(path: StorageObjectPath): string {
  const base = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}

/**
 * Driver Cloudflare R2 (S3 API).
 * Skeleton — diaktifkan di M4 (migrasi media dari Supabase → R2, SPEC §6.4).
 */
export class R2StorageDriver implements StorageDriver {
  upload(_input: UploadInput): Promise<StorageObjectPath> {
    throw new Error("R2StorageDriver.upload belum diimplementasikan (M4).");
  }

  getPublicUrl(path: StorageObjectPath): string {
    return publicUrl(path);
  }

  delete(_path: StorageObjectPath): Promise<void> {
    throw new Error("R2StorageDriver.delete belum diimplementasikan (M4).");
  }
}
