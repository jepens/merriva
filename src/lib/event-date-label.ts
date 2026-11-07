import { formatDateOnly, formatEventDateTime } from "@/lib/datetime";
import type { TimezoneId } from "@/lib/validation/content";

/**
 * Label hari & tanggal acara — "Minggu, 6 Desember 2026" — untuk gambar
 * pratinjau tautan, deskripsi kartu WhatsApp (`og:description`), dan variabel
 * `{tanggal}` pesan Sebar. SATU sumber supaya ketiganya tak pernah menyebut
 * tanggal yang berbeda untuk undangan yang sama.
 *
 * Sesi pertama yang berjam (`startAt`, dibaca di zona waktu acara) menang;
 * tanpa itu jatuh ke `event_date` undangan. `null` bila keduanya tak ada.
 */
export function eventDateLabel(
  startAt: string | null | undefined,
  timezone: TimezoneId,
  eventDate: string | null | undefined,
): string | null {
  if (startAt) {
    const f = formatEventDateTime(startAt, timezone);
    return f ? `${f.weekday}, ${f.date}` : null;
  }
  if (eventDate) {
    const f = formatDateOnly(eventDate);
    return f ? `${f.weekday}, ${f.date}` : null;
  }
  return null;
}
