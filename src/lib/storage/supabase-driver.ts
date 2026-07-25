import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/env";

import type { StorageDriver, StorageObjectPath, UploadInput } from "./types";

/** Bucket tunggal untuk seluruh media (foto galeri & bernama). */
export const MEDIA_BUCKET = "media";

/** Bangun URL publik dari domain sendiri + path relatif (tanpa URL vendor). */
function publicUrl(path: StorageObjectPath): string {
  const base = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}

/**
 * Driver Supabase Storage (fase dev/klien awal, SPEC §6.4).
 *
 * Menulis dengan service_role (server-only) → melewati RLS storage.objects,
 * jadi hanya kode server yang bisa menaruh objek; browser tak pernah menulis
 * langsung. Penyajian ke tamu TIDAK memakai URL Supabase melainkan
 * `getPublicUrl` (domain sendiri) agar pindah vendor cukup ganti env.
 */
export class SupabaseStorageDriver implements StorageDriver {
  private client: SupabaseClient | null = null;

  private admin(): SupabaseClient {
    if (!this.client) {
      this.client = createClient(
        getSupabaseUrl(),
        getSupabaseServiceRoleKey(),
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
    }
    return this.client;
  }

  async upload(input: UploadInput): Promise<StorageObjectPath> {
    const { error } = await this.admin()
      .storage.from(MEDIA_BUCKET)
      .upload(input.path, input.body, {
        contentType: input.contentType,
        upsert: true,
        // Immutable: path berbasis hash/UUID → boleh di-cache lama oleh CDN.
        cacheControl: "31536000",
      });
    if (error) throw new Error(`Gagal unggah storage: ${error.message}`);
    return input.path;
  }

  getPublicUrl(path: StorageObjectPath): string {
    return publicUrl(path);
  }

  async delete(path: StorageObjectPath): Promise<void> {
    const { error } = await this.admin()
      .storage.from(MEDIA_BUCKET)
      .remove([path]);
    if (error) throw new Error(`Gagal hapus storage: ${error.message}`);
  }
}
