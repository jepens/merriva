import type { TimezoneId } from "@/lib/validation/content";

/**
 * Konversi waktu acara Indonesia. Timestamp disimpan UTC (CLAUDE.md), input/tampil
 * memakai waktu-lokal zona acara. Indonesia TANPA DST → offset tetap:
 *   WIB (Asia/Jakarta)  = +07:00
 *   WITA (Asia/Makassar) = +08:00
 *   WIT (Asia/Jayapura)  = +09:00
 * sehingga konversi cukup pergeseran menit tetap (tanpa library timezone).
 */

const OFFSET_MINUTES: Record<TimezoneId, number> = {
  "Asia/Jakarta": 420,
  "Asia/Makassar": 480,
  "Asia/Jayapura": 540,
};

/**
 * Waktu-lokal `YYYY-MM-DDTHH:mm` (wall-clock di zona `tz`) → UTC ISO string.
 * Mengembalikan `null` bila input kosong / tak valid.
 */
export function localToUtc(local: string, tz: TimezoneId): string | null {
  if (!local) return null;
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)
    ? `${local}:00`
    : local;
  const asUtc = Date.parse(`${withSeconds}Z`);
  if (Number.isNaN(asUtc)) return null;
  return new Date(asUtc - OFFSET_MINUTES[tz] * 60000).toISOString();
}

/**
 * UTC ISO string → waktu-lokal `YYYY-MM-DDTHH:mm` di zona `tz` (untuk input
 * `datetime-local`). Mengembalikan `""` bila input tak valid.
 */
export function utcToLocal(utc: string, tz: TimezoneId): string {
  const ms = Date.parse(utc);
  if (Number.isNaN(ms)) return "";
  return new Date(ms + OFFSET_MINUTES[tz] * 60000).toISOString().slice(0, 16);
}
