/**
 * Aturan sesi jadwal DRAFT (DECISIONS #42) — dipakai BERSAMA editor (klien) dan
 * aksi simpan (server), jadi keduanya tak mungkin berbeda pendapat soal "sesi
 * ini sudah berjam". Sengaja tanpa impor: aman di bundle klien.
 */

/** Batas input `datetime-local`: tahun 5–6 digit diizinkan Chrome & lolos `Date.parse`. */
export const EVENT_LOCAL_MIN = "1900-01-01T00:00";
export const EVENT_LOCAL_MAX = "9999-12-31T23:59";

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Waktu-lokal LENGKAP dan sah: `YYYY-MM-DDTHH:mm[:ss]`, tahun 1900–9999,
 * tanggal kalender nyata (menolak `2026-02-30`, bukan menggesernya ke Maret),
 * tanpa offset zona. Batas bawah 1900 membuat konversi zona (≤ 9 jam) tak
 * pernah jatuh ke tahun 0000 yang ditolak Postgres — dulu nilai seperti itu
 * menggagalkan SELURUH autosave dengan pesan "periksa koneksi".
 */
export function isCompleteLocalDateTime(
  value: string | null | undefined,
): boolean {
  if (typeof value !== "string") return false;
  const m = LOCAL_DATETIME.exec(value.trim());
  if (!m) return false;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= lastDayOfMonth;
}

export interface EventDraftFields {
  name?: string;
  startAt?: string;
  endAt?: string;
  venueName?: string;
  address?: string;
  mapsUrl?: string;
}

/** Kartu sesi kosong total — baru ditambah, belum diisi apa pun. Tidak disimpan. */
export function isBlankEventDraft(event: EventDraftFields): boolean {
  return [
    event.name,
    event.startAt,
    event.endAt,
    event.venueName,
    event.address,
    event.mapsUrl,
  ].every((v) => !v || !v.trim());
}

/**
 * Langkah Jadwal lengkap: ada sesi berjam DAN setiap sesi yang berisi sudah
 * berjam. Dulu cukup satu sesi berjam, sehingga centang tetap tampil padahal
 * sesi lain tak akan pernah muncul di undangan.
 */
export function isScheduleComplete(
  events: readonly EventDraftFields[],
): boolean {
  return (
    events.some((e) => isCompleteLocalDateTime(e.startAt)) &&
    events.every(
      (e) => isCompleteLocalDateTime(e.startAt) || isBlankEventDraft(e),
    )
  );
}
