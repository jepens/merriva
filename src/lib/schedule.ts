import { utcToLocal } from "@/lib/datetime";
import type { TimezoneId } from "@/lib/validation/content";
import type { EventDraft } from "@/lib/validation/content/event";

/**
 * Predikat TUNGGAL "sesi terjadwal" (DECISIONS #42). `invitation_events.start_at`
 * boleh NULL — sesi draft yang jam mulainya belum diisi disimpan agar isiannya
 * tak hilang — tetapi sesi seperti itu TIDAK PERNAH tampil di halaman publik,
 * pratinjau, berkas .ics, maupun OG. Semua pembaca publik menyaring lewat sini
 * sehingga kontrak tema (`InvitationEventView.startAt: string`) tak berubah.
 */
export function scheduledEvents<T extends { start_at: string | null }>(
  rows: readonly T[],
): (T & { start_at: string })[] {
  return rows.filter(
    (row): row is T & { start_at: string } =>
      typeof row.start_at === "string" &&
      !Number.isNaN(Date.parse(row.start_at)),
  );
}

interface StoredEventRow {
  name: string;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  address: string | null;
  maps_url: string | null;
}

/** Baris tersimpan → nilai form editor. Sesi tanpa jam kembali UTUH, Mulai kosong. */
export function toEventDraft(row: StoredEventRow, tz: TimezoneId): EventDraft {
  return {
    name: row.name,
    startAt: row.start_at ? utcToLocal(row.start_at, tz) : "",
    endAt: row.end_at ? utcToLocal(row.end_at, tz) : "",
    venueName: row.venue_name ?? "",
    address: row.address ?? "",
    mapsUrl: row.maps_url ?? "",
  };
}
