import { R2StorageDriver } from "./r2-driver";
import { SupabaseStorageDriver } from "./supabase-driver";
import type { StorageDriver, StorageDriverName } from "./types";

let cached: StorageDriver | null = null;

/** Ambil driver storage aktif berdasarkan env STORAGE_DRIVER (default `supabase`). */
export function getStorage(): StorageDriver {
  if (cached) return cached;
  const name = (process.env.STORAGE_DRIVER ?? "supabase") as StorageDriverName;
  cached = name === "r2" ? new R2StorageDriver() : new SupabaseStorageDriver();
  return cached;
}

export type { StorageDriver, StorageObjectPath, UploadInput } from "./types";
