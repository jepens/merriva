import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { StorageDriver } from "@/lib/storage/types";
import { dataOrThrow } from "@/lib/supabase/result";
import type { Database } from "@/types/database";

/**
 * Penyapu musik unggahan usang (DECISIONS #121) — satu langkah cron
 * `purge-expired`.
 *
 * Route unggah menulis objek + baris `music_uploads`, sedangkan rujukannya di
 * `content.customMusic` baru disimpan autosave editor. Objek yang diganti, atau
 * diunggah lalu tak pernah tersimpan, tak dirujuk siapa pun tetapi tetap
 * tersaji publik di `/media` — tanpa penyapu, ia hidup selamanya. Yang disapu:
 * baris hidup berumur > 24 jam yang path-nya BUKAN `content.customMusic.path`
 * undangannya, atau yang undangannya sudah di-purge. Objeknya dihapus, barisnya
 * ditandai `replaced` (baris tetap ada sebagai catatan unggah).
 *
 * Saringannya di DB (RPC `music_uploads_usang`), bukan di sini: rujukan yang
 * sedang dipakai juga baris hidup > 24 jam, dan pemindaian berhalaman dengan
 * plafon akan habis membacanya setiap jalankan begitu jumlahnya melewati
 * plafon — objek usang di belakangnya tak pernah tersentuh. RPC tak pernah
 * mengembalikan rujukan saat ini, jadi batasnya hanya terisi kandidat.
 *
 * Rujukan yang sedang dipakai TIDAK disentuh walau undangannya turun paket,
 * kedaluwarsa, atau dikunci admin: perakit render sudah mengabaikannya, dan
 * datanya baru hilang lewat purge retensi atau takedown.
 */

/** Unggahan semuda ini bisa jadi belum disimpan autosave — jangan disapu. */
export const MUSIK_USANG_SESUDAH_JAM = 24;
/** Objek yang dihapus per jalankan; sisanya diambil jalankan berikutnya. */
export const MAKS_HAPUS_PER_JALAN = 200;

export interface HasilSapuMusik {
  /** Kandidat usang yang dibaca dari RPC (maks. `MAKS_HAPUS_PER_JALAN` + 1). */
  scanned: number;
  /** Objek terhapus DAN barisnya ditandai `replaced`. */
  swept: number;
  /** Hapus objek atau penandaan baris gagal — dicoba lagi jalankan berikutnya. */
  failed: number;
  /** Kandidat melebihi batas hapus — masih ada sisa untuk jalankan berikutnya. */
  truncated: boolean;
}

export async function sapuMusikUsang(
  admin: SupabaseClient<Database>,
  storage: Pick<StorageDriver, "delete">,
  now: Date,
): Promise<HasilSapuMusik> {
  const cutoff = new Date(
    now.getTime() - MUSIK_USANG_SESUDAH_JAM * 3_600_000,
  ).toISOString();

  // Satu baris lebih dari batas hapus: cukup untuk tahu masih ada sisa tanpa
  // menghitung seluruh backlog.
  const kandidat =
    dataOrThrow(
      await admin.rpc("music_uploads_usang", {
        p_sebelum: cutoff,
        p_batas: MAKS_HAPUS_PER_JALAN + 1,
      }),
      "music_uploads_usang (penyapu)",
    ) ?? [];

  const target = kandidat.slice(0, MAKS_HAPUS_PER_JALAN);
  let swept = 0;
  let failed = 0;
  for (const m of target) {
    try {
      // Semua driver menganggap objek yang sudah tiada sebagai sukses.
      await storage.delete(m.path);
    } catch {
      // Baris TIDAK ditandai: ia tetap hidup dan dicoba lagi jalankan berikutnya.
      failed += 1;
      continue;
    }
    const { error } = await admin
      .from("music_uploads")
      .update({ removed_at: now.toISOString(), removed_reason: "replaced" })
      .eq("id", m.id)
      // Purge/takedown yang menandai lebih dulu menang — alasannya tak ditimpa.
      .is("removed_at", null);
    if (error) {
      failed += 1;
      continue;
    }
    swept += 1;
  }

  return {
    scanned: kandidat.length,
    swept,
    failed,
    truncated: kandidat.length > MAKS_HAPUS_PER_JALAN,
  };
}
