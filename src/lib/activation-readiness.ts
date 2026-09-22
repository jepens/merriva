import type { SupabaseClient } from "@supabase/supabase-js";

import { copy } from "@/lib/copy";
import { isBlankEventDraft } from "@/lib/event-draft";
import { scheduledEvents } from "@/lib/schedule";
import { isDraftSlug } from "@/lib/slug";
import type { Database } from "@/types/database";

/**
 * Syarat yang harus dipenuhi pemilik sebelum boleh MEMBAYAR (SPEC §4.8 langkah
 * 0, DECISIONS #44) — SATU sumber untuk halaman aktivasi (daftar syarat) dan
 * `createCheckoutAction` (penahan server). Keduanya juga membaca jadwal lewat
 * query yang SAMA (`fetchReadinessEvents`), jadi tak mungkin berbeda pendapat
 * soal "undangan ini siap dibayar" — kecuali saat jadwal tak bisa dibaca, yang
 * sengaja ditangani berbeda (lihat pemanggilnya).
 *
 * Hanya syarat yang bisa DIPERBAIKI pemilik di editor. Status dapat-dibayar dan
 * purge dijaga terpisah di pemanggil — keduanya bukan urusan editor.
 */
export type ActivationBlocker = "slug" | "schedule";

export interface ReadinessEventRow {
  name: string;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  address: string | null;
  maps_url: string | null;
}

export interface ActivationReadiness {
  /** Urutan perbaikan yang wajar: alamat dulu, lalu jadwal. */
  blockers: ActivationBlocker[];
  /**
   * Sesi berisi yang belum berjam. TIDAK menghalangi pembayaran (cukup satu sesi
   * berjam), tetapi sesi ini tak akan tampil ke tamu (#42) — halaman aktivasi
   * menyebut namanya agar pemilik tak kaget setelah membayar.
   */
  unscheduled: string[];
}

/**
 * Jadwal undangan untuk penilaian syarat — urut `sort_order` (label cadangan
 * "Sesi N" harus sama dengan penomoran kartu di editor). Dibaca lewat klien
 * PENGGUNA: RLS `invitation_events_select` memberi pemilik seluruh sesi
 * undangannya sendiri, tak lebih.
 */
export function fetchReadinessEvents(
  supabase: SupabaseClient<Database>,
  invitationId: string,
) {
  return supabase
    .from("invitation_events")
    .select("name, start_at, end_at, venue_name, address, maps_url")
    .eq("invitation_id", invitationId)
    .order("sort_order", { ascending: true });
}

/** Baris tersimpan tanpa isian apa pun (sisa lama; aksi simpan kini tak membuatnya). */
function isBlankRow(row: ReadinessEventRow): boolean {
  return isBlankEventDraft({
    name: row.name,
    startAt: row.start_at ?? "",
    endAt: row.end_at ?? "",
    venueName: row.venue_name ?? "",
    address: row.address ?? "",
    mapsUrl: row.maps_url ?? "",
  });
}

/**
 * @param events hasil `fetchReadinessEvents` (urut `sort_order`).
 */
export function activationReadiness(
  inv: { slug: string },
  events: readonly ReadinessEventRow[],
): ActivationReadiness {
  const blockers: ActivationBlocker[] = [];
  if (isDraftSlug(inv.slug)) blockers.push("slug");

  // Predikat tunggal "sesi terjadwal" (#42) — sama dengan yang dipakai halaman
  // publik, jadi "berjam" di sini = "tampil ke tamu" di sana.
  const scheduled = new Set<ReadinessEventRow>(scheduledEvents(events));
  if (scheduled.size === 0) blockers.push("schedule");

  // Nomor "Sesi N" = posisi di daftar urut sort_order, sama dengan nomor kartu
  // yang dilihat pemilik di editor setelah memuat ulang. Baris kosong total
  // (editor menampilkannya sebagai kartu kosong TANPA catatan) tak disebut —
  // pemilik tak akan menemukan apa pun untuk diperbaiki di kartu itu.
  const unscheduled = events.flatMap((e, i) =>
    scheduled.has(e) || isBlankRow(e)
      ? []
      : [e.name.trim() || `${copy.editor.schedule.session} ${i + 1}`],
  );

  return { blockers, unscheduled };
}
