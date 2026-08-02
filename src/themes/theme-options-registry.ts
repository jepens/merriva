import type { ThemeOptions } from "@/lib/customizer/theme-options";

import { eternalRoseOptions } from "./eternal-rose/options";
import { noirOptions } from "./noir/options";
import { verdantOptions } from "./verdant/options";

/**
 * Registry `options.ts` per tema (CUSTOMIZER-SPEC §3/§10). Satu sumber kebenaran
 * yang dibaca editor generik (render kontrol) DAN validator server (whitelist).
 * Tema tanpa entri = belum mendukung kustomisasi → fitur tak muncul (tetap
 * berfungsi normal). Options = data murni (tanpa react/next-font) → aman diimpor
 * di server maupun klien; cukup satu baris per tema saat rollout.
 */
export const themeOptionsRegistry: Record<string, ThemeOptions> = {
  "eternal-rose": eternalRoseOptions,
  noir: noirOptions,
  verdant: verdantOptions,
};

export function getThemeOptions(slug: string): ThemeOptions | null {
  return themeOptionsRegistry[slug] ?? null;
}
