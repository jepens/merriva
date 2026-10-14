import { getStorageDriver } from "@/lib/env";

import { LocalStorageDriver } from "./local-driver";
import { R2StorageDriver } from "./r2-driver";
import { SupabaseStorageDriver } from "./supabase-driver";
import type { StorageDriver } from "./types";

let cached: StorageDriver | null = null;

/** Ambil driver storage aktif berdasarkan env STORAGE_DRIVER (default `supabase`).
 * Ejaan yang tak dikenali DITOLAK di `getStorageDriver()`, bukan diam-diam jatuh
 * ke Supabase — salah ketik di panel adalah cara paling mudah mengira media
 * tersimpan di satu tempat padahal ada di tempat lain. */
export function getStorage(): StorageDriver {
  if (cached) return cached;
  const name = getStorageDriver();
  cached =
    name === "r2"
      ? new R2StorageDriver()
      : name === "local"
        ? new LocalStorageDriver()
        : new SupabaseStorageDriver();
  return cached;
}

export type { StorageDriver, StorageObjectPath, UploadInput } from "./types";
