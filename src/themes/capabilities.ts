/**
 * Kapabilitas/perilaku per tema (metadata behavioral — beda dari `catalog-meta`
 * yang visual). Dibaca `app/[slug]/page.tsx` untuk memilih komposisi cover,
 * TANPA hard-code slug (DECISIONS #11).
 *
 * `coverMode`:
 *  - `'shell'` : cover + musik + personalisasi dari `InvitationShell` bersama
 *    (default; tema lama sebelum port).
 *  - `'theme'` : tema memegang cover + musik sendiri (cover-gate) → halaman
 *    publik membungkus dengan `GuestPersonalizationProvider` saja, tanpa cover
 *    generik. Wajib agar cover muncul di `/preview/tema/{slug}` (tema polos).
 *
 * Arah akhir: seluruh tema `'theme'` → cover `InvitationShell` di-deprecate.
 */
export type CoverMode = "theme" | "shell";

const THEME_CAPABILITIES: Record<string, { coverMode: CoverMode }> = {
  "eternal-rose": { coverMode: "theme" },
  noir: { coverMode: "theme" },
};

export function getThemeCoverMode(slug: string): CoverMode {
  return THEME_CAPABILITIES[slug]?.coverMode ?? "shell";
}
