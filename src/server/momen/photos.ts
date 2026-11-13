import type { SupabaseClient } from "@supabase/supabase-js";

import { reportHandledError } from "@/lib/observability";
import { getStorage } from "@/lib/storage";
import type { Database } from "@/types/database";

/**
 * Pembacaan foto Album Momen ber-PAGINASI (AUDIT-2026-09-04 PER-4).
 *
 * Sebelumnya halaman tamu `/{slug}/momen` (route publik `force-dynamic`, tak
 * pernah ter-cache) dan dashboard menarik SELURUH album tanpa `limit`. Album 500
 * foto ≈ 150 KB payload per pembukaan dan 500 node `<img>` di DOM; 200 tamu
 * membuka bersamaan ≈ 100.000 baris terbaca + ~30 MB egress dari satu instance,
 * tepat di hari acara.
 *
 * Kursor = `created_at` baris terakhir (keyset), memakai index
 * `momen_photos_album_created_idx (album_id, created_at)` — bukan OFFSET, yang
 * biayanya tumbuh linear dan bisa melompati baris pada feed hidup.
 */

/** Satu foto siap render (URL sudah lewat `lib/storage` + domain sendiri). */
export interface MomenPhotoRecord {
  id: string;
  guestName: string;
  deviceId: string;
  filterId: string;
  url: string;
  thumbUrl: string;
  status: "visible" | "hidden";
  /** Objek storage sudah dihapus saat foto disembunyikan (KEA-3, #137). */
  purged: boolean;
  createdAt: string;
}

export interface MomenPhotoPage {
  photos: MomenPhotoRecord[];
  /** `created_at` untuk permintaan berikutnya; null = halaman terakhir. */
  nextCursor: string | null;
  /**
   * Benar bila bacaannya GAGAL (bukan album kosong) — DECISIONS #46. Render
   * awal halaman tetap degradasi jinak (#45), tetapi "muat lebih" memakai ini
   * untuk mempertahankan kursor & tombolnya, bukan diam-diam menghabiskannya.
   */
  failed?: boolean;
}

/** Ringkasan album — biaya konstan, dari RPC agregat (bukan dari daftar). */
export interface MomenAlbumStats {
  visibleCount: number;
  hiddenCount: number;
  photographerCount: number;
  participantCount: number;
}

export const MOMEN_PAGE_SIZE = 40;

/**
 * Satu halaman foto album, terbaru dulu.
 *
 * `includeHidden` HANYA untuk jalur pemilik (dashboard) — jalur tamu wajib
 * membiarkannya `false` supaya foto yang dimoderasi tak pernah terpancar.
 *
 * `deviceId` WAJIB diisi jalur tamu (DECISIONS #137: tamu hanya melihat
 * fotonya sendiri) dan HARUS berasal dari cookie sesi ber-tanda-tangan, bukan
 * dari klien. Jalur pemilik membiarkannya kosong (seluruh album).
 */
export async function fetchMomenPhotos(
  admin: SupabaseClient<Database>,
  albumId: string,
  opts: {
    cursor?: string | null;
    limit?: number;
    includeHidden?: boolean;
    deviceId?: string;
  } = {},
): Promise<MomenPhotoPage> {
  const limit = opts.limit ?? MOMEN_PAGE_SIZE;

  let query = admin
    .from("momen_photos")
    .select(
      "id, guest_name, device_id, filter_id, storage_path, thumb_path, status, purged_at, created_at",
    )
    .eq("album_id", albumId)
    .order("created_at", { ascending: false })
    // Ambil SATU lebih untuk mendeteksi halaman berikutnya tanpa query hitung.
    .limit(limit + 1);

  if (!opts.includeHidden) query = query.eq("status", "visible");
  // Index `(album_id, device_id)` sudah ada; jatah ≤ 20 foto per perangkat.
  if (opts.deviceId) query = query.eq("device_id", opts.deviceId);
  if (opts.cursor) query = query.lt("created_at", opts.cursor);

  const { data, error } = await query;
  // Error DB di sini pernah tertelan diam-diam → galeri tampil KOSONG dan itu
  // tak bisa dibedakan dari album yang memang belum berisi (mis. saat migrasi
  // kolom baru belum terpasang di lingkungan itu). Laporkan; bentuk hasilnya
  // tetap degradasi jinak agar halaman tak ikut tumbang.
  if (error) {
    reportHandledError(error, "momen.photos.fetch", { albumId });
    return { photos: [], nextCursor: opts.cursor ?? null, failed: true };
  }
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const storage = getStorage();
  const photos: MomenPhotoRecord[] = page.map((r) => ({
    id: r.id,
    guestName: r.guest_name,
    deviceId: r.device_id,
    filterId: r.filter_id,
    url: storage.getPublicUrl(r.storage_path),
    thumbUrl: storage.getPublicUrl(r.thumb_path),
    status: r.status === "hidden" ? "hidden" : "visible",
    purged: r.purged_at !== null,
    createdAt: r.created_at,
  }));

  return {
    photos,
    nextCursor: hasMore ? (photos[photos.length - 1]?.createdAt ?? null) : null,
  };
}

/**
 * Ringkasan album lewat RPC agregat. Gagal → nol semua (degradasi jinak: angka
 * ringkasan hilang, galeri tetap tampil) alih-alih menggagalkan halaman.
 */
export async function fetchMomenAlbumStats(
  admin: SupabaseClient<Database>,
  albumId: string,
): Promise<MomenAlbumStats> {
  const { data, error } = await admin.rpc("momen_album_stats", {
    p_album_id: albumId,
  });
  if (error) {
    reportHandledError(error, "momen.stats", { albumId });
  }
  const row = data?.[0];
  return {
    visibleCount: row?.visible_count ?? 0,
    hiddenCount: row?.hidden_count ?? 0,
    photographerCount: row?.photographer_count ?? 0,
    participantCount: row?.participant_count ?? 0,
  };
}
