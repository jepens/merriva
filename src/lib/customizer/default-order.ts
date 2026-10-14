import {
  isSectionVisible,
  SECTION_KEYS,
  type SectionKey,
} from "@/lib/validation/content/settings";
import type { InvitationSettings } from "@/lib/validation/content";

import type { ThemeOptions } from "./theme-options";

/** Section yang masih dikendalikan toggle LAMA (`settings.sections`). */
function isLegacyToggle(id: string): id is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(id);
}

/**
 * Urutan & visibilitas section untuk undangan yang BELUM punya
 * `settings.custom` (jalur lama). Satu salinan untuk sepuluh tema — sebelumnya
 * logika ini disalin di tiap `index.tsx`, dan salinan itulah yang menyimpan
 * sebuah jebakan.
 *
 * **Jebakannya:** `toggle: false` di `options.ts` berarti "wajib tampil"
 * (hero & rsvp). Tetapi jalur lama hanya menanyakan `isSectionVisible`, dan
 * `hero` KEBETULAN ada di `SECTION_KEYS` — jadi begitu sebuah tema memakai id
 * kanonik `hero` (bukan `intro`/`opening`), `settings.sections.hero = false`
 * bisa menyembunyikan layar pembukanya, melanggar kontraknya sendiri. Di sini
 * `toggle: false` menang lebih dulu, sehingga rename ke kosakata kanonik tidak
 * diam-diam membuka kemungkinan itu.
 */
export function defaultSectionOrder(
  options: ThemeOptions,
  settings: InvitationSettings,
): Array<{ id: string; visible: boolean }> {
  return options.sections.map((s) => ({
    id: s.id,
    visible: !s.toggle
      ? true
      : isLegacyToggle(s.id)
        ? isSectionVisible(settings, s.id)
        : true,
  }));
}
