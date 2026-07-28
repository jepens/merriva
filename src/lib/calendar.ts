/**
 * Generator "Simpan ke Kalender" (SPEC §4.5) — MURNI & teruji, tanpa dependency.
 * Menghasilkan (1) berkas **iCalendar RFC 5545** (`.ics` — dipakai Apple Calendar,
 * Outlook, dll.) dan (2) **URL Google Calendar**.
 *
 * Waktu acara disimpan UTC (CLAUDE.md) → dipancarkan dalam bentuk UTC (`…Z`).
 * Indonesia TANPA DST, sehingga instan absolut menghasilkan tampilan lokal yang
 * benar di perangkat tamu tanpa perlu komponen `VTIMEZONE` (tamu di WIB melihat
 * jam acara apa adanya; tamu lintas-zona melihat konversi yang tepat).
 */

const PRODID = "-//Merriva//Undangan//ID";
// Domain UID stabil lintas-env → menambah ulang acara yang sama = memperbarui,
// bukan menggandakan entri kalender (UID iCalendar bersifat idempoten).
const UID_DOMAIN = "merriva.id";
// Sesi tanpa waktu selesai → durasi default 1 jam (VEVENT tanpa DTEND dianggap
// berdurasi nol oleh sebagian klien — buruk untuk UX).
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export interface CalendarEventInput {
  /** Pengenal stabil (uuid `invitation_events.id`) → UID unik & idempoten. */
  id: string;
  /** Nama sesi, mis. "Akad Nikah". */
  title: string;
  /** Instan mulai (UTC ISO string). */
  startAt: string;
  /** Instan selesai (UTC ISO string); `null` → default +1 jam. */
  endAt?: string | null;
  /** Nama gedung. */
  venueName?: string | null;
  /** Alamat lengkap. */
  address?: string | null;
  /** Deskripsi bebas (mis. tautan undangan). */
  description?: string | null;
}

/** Instan mulai/selesai ter-resolve (ms epoch). `null` bila `startAt` tak valid. */
function resolveInstants(
  ev: CalendarEventInput,
): { startMs: number; endMs: number } | null {
  const startMs = Date.parse(ev.startAt);
  if (Number.isNaN(startMs)) return null;
  const parsedEnd = ev.endAt ? Date.parse(ev.endAt) : Number.NaN;
  const endMs =
    !Number.isNaN(parsedEnd) && parsedEnd > startMs
      ? parsedEnd
      : startMs + DEFAULT_DURATION_MS;
  return { startMs, endMs };
}

/** ms epoch → bentuk UTC iCalendar/Google `YYYYMMDDTHHMMSSZ`. */
function icalUtc(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Gabungan lokasi (gedung + alamat) untuk LOCATION; `""` bila keduanya kosong. */
function locationOf(ev: CalendarEventInput): string {
  return [ev.venueName, ev.address]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .join(", ");
}

/**
 * Escape nilai TEXT iCalendar (RFC 5545 §3.3.11): `\` `;` `,` dan baris-baru.
 * Backslash HARUS diproses lebih dulu agar escape lain tak ter-escape ganda.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Content line folding (RFC 5545 §3.1): baris > 75 oktet dipecah, baris lanjutan
 * diawali SATU spasi. Menghitung oktet UTF-8 dan tidak memecah di tengah karakter
 * multi-oktet (iterasi per code point). Baris lanjutan menyisakan 74 oktet konten
 * (1 oktet untuk spasi awalan).
 */
function foldLine(input: string): string {
  if (encoder.encode(input).length <= 75) return input;
  let out = "";
  let segment = "";
  let bytes = 0;
  let first = true;
  for (const ch of input) {
    const chBytes = encoder.encode(ch).length;
    const limit = first ? 75 : 74;
    if (bytes + chBytes > limit) {
      out += (first ? "" : " ") + segment + "\r\n";
      first = false;
      segment = "";
      bytes = 0;
    }
    segment += ch;
    bytes += chBytes;
  }
  return out + (first ? "" : " ") + segment;
}

/** Satu content line `NAME:VALUE` (nilai sudah di-escape bila TEXT) + folding. */
function contentLine(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

/** Baris-baris VEVENT untuk satu sesi; `null` bila `startAt` tak valid. */
function veventLines(ev: CalendarEventInput, dtstamp: string): string[] | null {
  const t = resolveInstants(ev);
  if (!t) return null;
  const lines = [
    "BEGIN:VEVENT",
    contentLine("UID", `${ev.id}@${UID_DOMAIN}`),
    contentLine("DTSTAMP", dtstamp),
    contentLine("DTSTART", icalUtc(t.startMs)),
    contentLine("DTEND", icalUtc(t.endMs)),
    contentLine("SUMMARY", escapeText(ev.title)),
  ];
  const location = locationOf(ev);
  if (location) lines.push(contentLine("LOCATION", escapeText(location)));
  if (ev.description?.trim()) {
    lines.push(contentLine("DESCRIPTION", escapeText(ev.description.trim())));
  }
  lines.push("END:VEVENT");
  return lines;
}

/**
 * Rakit dokumen iCalendar (VCALENDAR) berisi ≥1 VEVENT. Baris memakai CRLF dan
 * diakhiri CRLF (sesuai RFC). `null` bila tak ada sesi valid.
 *
 * @param events daftar sesi acara
 * @param now    epoch ms untuk DTSTAMP (default sekarang; diinjeksi saat uji)
 */
export function buildIcs(
  events: CalendarEventInput[],
  now: number = Date.now(),
): string | null {
  const dtstamp = icalUtc(now);
  const vevents = events
    .map((ev) => veventLines(ev, dtstamp))
    .filter((l): l is string[] => l !== null)
    .flat();
  if (vevents.length === 0) return null;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    contentLine("PRODID", PRODID),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/**
 * URL Google Calendar (`render?action=TEMPLATE`) untuk satu sesi. Nilai di-encode
 * lewat `URLSearchParams` (bukan escape iCalendar). `null` bila `startAt` tak valid.
 */
export function googleCalendarUrl(ev: CalendarEventInput): string | null {
  const t = resolveInstants(ev);
  if (!t) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${icalUtc(t.startMs)}/${icalUtc(t.endMs)}`,
  });
  const location = locationOf(ev);
  if (location) params.set("location", location);
  if (ev.description?.trim()) params.set("details", ev.description.trim());
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
