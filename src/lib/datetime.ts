import { isCompleteLocalDateTime } from "@/lib/event-draft";
import { TIMEZONES, type TimezoneId } from "@/lib/validation/content";

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
 * Waktu-lokal dari editor → UTC yang AMAN disimpan di `invitation_events`
 * (DECISIONS #42). Nilai belum lengkap/tak sah (mis. "2026-02-30T10:00", tahun
 * 0001, sisa ketikan) → `null` = sesi draft belum berjam, alih-alih tanggal
 * yang digeser diam-diam atau galat Postgres yang menggagalkan autosave.
 */
export function localToStoredUtc(
  local: string | null | undefined,
  tz: TimezoneId,
): string | null {
  return isCompleteLocalDateTime(local)
    ? localToUtc((local as string).trim(), tz)
    : null;
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

const HARI = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;
const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

export interface FormattedEvent {
  weekday: string; // "Sabtu"
  date: string; // "15 Agustus 2026"
  time: string; // "10.00"
  tzLabel: string; // "WIB"
  full: string; // "Sabtu, 15 Agustus 2026 · 10.00 WIB"
}

/**
 * UTC ISO → tampilan Indonesia di zona `tz`. Memanfaatkan offset tetap: geser
 * lalu baca komponen UTC = wall-clock zona (tanpa Intl/library). `null` bila tak valid.
 */
export function formatEventDateTime(
  utc: string,
  tz: TimezoneId,
): FormattedEvent | null {
  const ms = Date.parse(utc);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + OFFSET_MINUTES[tz] * 60000);
  const weekday = HARI[d.getUTCDay()];
  const date = `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const time = `${pad(d.getUTCHours())}.${pad(d.getUTCMinutes())}`;
  const tzLabel = TIMEZONES[tz];
  return {
    weekday,
    date,
    time,
    tzLabel,
    full: `${weekday}, ${date} · ${time} ${tzLabel}`,
  };
}

/** Tanggal-saja `YYYY-MM-DD` → { weekday, date } Indonesia. `null` bila tak valid. */
export function formatDateOnly(
  date: string,
): { weekday: string; date: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo - 1, day));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== mo - 1) return null;
  return { weekday: HARI[d.getUTCDay()], date: `${day} ${BULAN[mo - 1]} ${y}` };
}
