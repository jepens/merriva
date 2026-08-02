/**
 * Keputusan validasi tampilan (Fase G) yang MURNI & bebas-DB: registry options
 * tema → schema whitelist → gating paket. Diekstrak dari server action agar bisa
 * diuji tanpa mock Supabase (DoD §9: "nilai liar/injeksi ditolak"). Server action
 * hanya menambah auth/kepemilikan/simpan di sekelilingnya.
 */
import { getThemeOptions } from "@/themes/theme-options-registry";

import { buildCustomSettingsSchema } from "./settings-custom-schema";
import type { CustomSettings } from "./theme-options";

export type AppearanceParseResult =
  | { ok: true; custom: CustomSettings }
  | {
      ok: false;
      reason: "unsupported" | "invalid";
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * Validasi input kustomisasi terhadap options tema + gating paket. `premium`
 * berasal dari `packages.limits` (server). Tema tanpa options → "unsupported".
 * Nilai di luar whitelist / injeksi / permutasi salah / opsi terkunci Premium →
 * "invalid" (bukan "dibersihkan diam-diam").
 */
export function parseAppearanceInput(
  themeSlug: string,
  premium: boolean,
  input: unknown,
): AppearanceParseResult {
  const options = getThemeOptions(themeSlug);
  if (!options) return { ok: false, reason: "unsupported" };

  const res = buildCustomSettingsSchema(options, { premium }).safeParse(input);
  if (!res.success) {
    return {
      ok: false,
      reason: "invalid",
      fieldErrors: res.error.flatten().fieldErrors,
    };
  }
  return { ok: true, custom: res.data as CustomSettings };
}
