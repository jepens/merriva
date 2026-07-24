import { z } from "zod";

/**
 * `invitations.settings` (SPEC §4.4 step 7): varian warna tema, toggle
 * tampil/sembunyi per section, moderasi ucapan, dan pilihan musik latar.
 *
 * Section dianggap TAMPIL kecuali di-set `false` secara eksplisit
 * (undefined = default tampil) — supaya undangan lama tetap lengkap saat
 * daftar section bertambah.
 */

export const SECTION_KEYS = [
  "hero",
  "countdown",
  "schedule",
  "gallery",
  "story",
  "envelope",
  "rsvp",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const sectionTogglesSchema = z.object({
  hero: z.boolean().optional(),
  countdown: z.boolean().optional(),
  schedule: z.boolean().optional(),
  gallery: z.boolean().optional(),
  story: z.boolean().optional(),
  envelope: z.boolean().optional(),
  rsvp: z.boolean().optional(),
});

/** Timezone acara Indonesia (CLAUDE.md: timestamp UTC → tampil WIB/WITA/WIT). */
export const TIMEZONES = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
} as const;

export type TimezoneId = keyof typeof TIMEZONES;

export const settingsSchema = z.object({
  /** Varian warna tema (kode divalidasi terhadap `theme.json` di server). */
  themeVariant: z.string().trim().max(40).optional(),
  /** Timezone acara — dipakai konversi waktu event & tampilan. Default WIB. */
  timezone: z
    .enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"])
    .default("Asia/Jakarta"),
  sections: sectionTogglesSchema.default({}),
  /** Moderasi ucapan: bila true, ucapan baru perlu disetujui pemilik. */
  moderateGuestbook: z.boolean().default(false),
  /** Musik latar dari library royalty-free (`songs.id`). */
  songId: z.uuid().optional(),
});

export type SectionToggles = z.infer<typeof sectionTogglesSchema>;
export type InvitationSettings = z.infer<typeof settingsSchema>;

/** Default settings untuk undangan baru. */
export const DEFAULT_SETTINGS: InvitationSettings = {
  timezone: "Asia/Jakarta",
  sections: {},
  moderateGuestbook: false,
};

/** True bila section perlu ditampilkan (undefined/true = tampil). */
export function isSectionVisible(
  settings: InvitationSettings,
  key: SectionKey,
): boolean {
  return settings.sections[key] !== false;
}
