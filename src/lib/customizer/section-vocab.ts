/**
 * Kosakata section kanonik (THEME-CONTRACT §1).
 *
 * Id section bukan nama bebas: ia tersimpan di `settings.custom.sections`,
 * menentukan label di editor tampilan, dan menentukan apakah pengaturan pemilik
 * bisa ikut berpindah saat ia berganti tema. Sepuluh tema pertama sempat
 * bercabang — `hero` / `intro` / `opening` untuk hal yang sama, `couple` vs
 * `principals` — dan tak ada yang menangkapnya karena tak ada yang memeriksa.
 *
 * Kosakata ini SENGAJA kecil. Ragam tema tumbuh lewat section khas bertanda
 * `x-` (§ bawah), bukan lewat sinonim untuk hal yang sama.
 */

/** Wajib ada di setiap tema; tak boleh diurut ulang maupun disembunyikan. */
export const SECTION_CORE = ["hero", "rsvp"] as const;

/** Dipakai bila temanya memang punya bagian itu. */
export const SECTION_STANDARD = [
  "quote",
  "couple",
  "countdown",
  "schedule",
  "agenda",
  "gallery",
  "video",
  "story",
  "envelope",
] as const;

/**
 * Sudah disepakati namanya, belum ada temanya. Ditulis di sini supaya tema
 * pertama yang membutuhkannya memakai nama yang sama — bukan mengarang sendiri.
 */
export const SECTION_CANDIDATE = [
  "location",
  "livestream",
  "dresscode",
  "wishes",
] as const;

export const SECTION_VOCAB: ReadonlySet<string> = new Set<string>([
  ...SECTION_CORE,
  ...SECTION_STANDARD,
  ...SECTION_CANDIDATE,
]);

/** Awalan wajib untuk section yang hanya ada di satu tema. */
export const SECTION_X_PREFIX = "x-";

/**
 * Section khas tema (mis. `x-seating`). Wajib menyertakan `label` sendiri —
 * `copy.appearance.sectionLabels` hanya memuat kosakata kanonik, dan section
 * satu-tema tak layak menambah entri global di sana.
 */
export function isThemeSpecificSection(id: string): boolean {
  return id.startsWith(SECTION_X_PREFIX) && id.length > SECTION_X_PREFIX.length;
}

/** Id yang boleh muncul di `options.sections`. */
export function isKnownSection(id: string): boolean {
  return SECTION_VOCAB.has(id) || isThemeSpecificSection(id);
}
