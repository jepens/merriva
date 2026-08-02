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

/**
 * Bentuk STRUKTURAL `settings.custom` (Fase G / CUSTOMIZER-SPEC §2) — dipakai
 * saat MEMBACA settings agar field lolos parse & tersimpan. Ini HANYA menjaga
 * bentuk JSON aman (hex ketat → cegah injeksi CSS, batas panjang → cegah JSONB
 * liar). Whitelist ketat terhadap options tema + gating paket ditegakkan
 * TERPISAH di server action `updateInvitationAppearance` (satu sumber kebenaran).
 * Bentuknya sengaja identik dgn `CustomSettings` (`@/lib/customizer/theme-options`).
 */
export const customSettingsBaseSchema = z.object({
  v: z.literal(1),
  variant: z.string().trim().max(40),
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable(),
  fontPair: z.string().trim().max(40),
  sections: z
    .array(z.object({ id: z.string().trim().max(40), visible: z.boolean() }))
    .max(60),
  styles: z.record(z.string().trim().max(40), z.string().trim().max(40)),
  motion: z.enum(["full", "calm"]),
  grain: z.boolean(),
});

export type CustomSettingsBase = z.infer<typeof customSettingsBaseSchema>;

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
  /**
   * Kustomisasi tampilan oleh pembeli (Fase G). Absen = bawaan tema (undangan
   * lama render identik). Ditulis EKSKLUSIF oleh `updateInvitationAppearance`;
   * jalur simpan lain WAJIB mengabaikan `custom` dari klien & mempertahankan
   * nilai milik server (cegah bypass gating).
   */
  custom: customSettingsBaseSchema.optional(),
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
