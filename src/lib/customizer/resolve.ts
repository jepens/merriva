/**
 * Resolver `settings.custom` → token render (CUSTOMIZER-SPEC §8). MURNI &
 * deterministik: dipakai di render publik (server) DAN pratinjau editor agar
 * "editor ≡ halaman publik" untuk settings yang sama. Penjaga kontras dihitung
 * DI SINI (server) juga — bukan hanya di editor — sehingga data apa pun yang
 * tersimpan tetap aman dirender (defense-in-depth; SPEC §4).
 *
 * Aturan section = permutasi lengkap; posisi terkunci (`reorder:false`) dan
 * "wajib tampil" (`toggle:false`) ditegakkan ulang di sini. Bila `custom`
 * cacat/absen → jatuh ke bawaan tema (order asli, semua tampil) → tak pernah
 * merender tata letak rusak. Urutan yang dikembalikan = DOM ORDER (bukan CSS
 * order): tema menyusun array section sesuai ini.
 */
import { safeTextColor, textOnAccent } from "./contrast-guard";
import type { CustomSettings, ThemeOptions } from "./theme-options";

export interface ResolvedSection {
  id: string;
  visible: boolean;
}

export interface ResolvedAppearance {
  variantId: string;
  /** Warna aksen dekoratif (mentah dari varian atau custom). */
  accent: string;
  /** Aksen aman untuk TEKS di atas kertas (WCAG AA ≥ 4.5). */
  accentText: string;
  /** Warna teks di ATAS elemen beraksen (putih/ink). */
  onAccent: string;
  paper: string;
  ink: string;
  /** true bila `accentText` digelapkan dari `accent` demi lolos AA. */
  accentSnapped: boolean;
  /** CSS var pasangan font terpilih, mis. "var(--er-disp-b)". */
  dispVar: string;
  bodyVar: string;
  /** Gaya per-section terpilih (key → nilai valid). */
  styles: Record<string, string>;
  /** Urutan render + visibilitas (DOM order). */
  sections: ResolvedSection[];
  motion: "full" | "calm";
  grain: boolean;
}

function resolveSections(
  options: ThemeOptions,
  custom: CustomSettings | null | undefined,
): ResolvedSection[] {
  const defaultOrder = options.sections.map((s) => ({
    id: s.id,
    visible: true,
  }));
  const wanted = custom?.sections;
  if (!wanted || wanted.length === 0) return defaultOrder;

  const optById = new Map(options.sections.map((s) => [s.id, s]));
  const ids = wanted.map((s) => s.id);
  const isPermutation =
    ids.length === optById.size &&
    new Set(ids).size === optById.size &&
    ids.every((id) => optById.has(id));
  if (!isPermutation) return defaultOrder;

  // Posisi terkunci (`reorder:false`) wajib di index bawaannya; jika digeser →
  // anggap data cacat, kembali ke bawaan (aman).
  for (let i = 0; i < options.sections.length; i++) {
    const opt = options.sections[i];
    if (opt && !opt.reorder && ids[i] !== opt.id) return defaultOrder;
  }

  return wanted.map((s) => {
    const opt = optById.get(s.id);
    // `toggle:false` (wajib tampil) tak boleh disembunyikan.
    return { id: s.id, visible: opt && !opt.toggle ? true : s.visible };
  });
}

export function resolveAppearance(
  options: ThemeOptions,
  custom: CustomSettings | null | undefined,
): ResolvedAppearance {
  const variant =
    (custom && options.variants.find((v) => v.id === custom.variant)) ||
    options.variants[0];
  if (!variant) throw new Error("ThemeOptions minimal punya 1 variant");

  const fontPair =
    (custom && options.fontPairs.find((f) => f.id === custom.fontPair)) ||
    options.fontPairs[0];
  if (!fontPair) throw new Error("ThemeOptions minimal punya 1 fontPair");

  const accent = custom?.accent ?? variant.acc;
  const guard = safeTextColor(accent, variant.paper);
  const onAccent = textOnAccent(accent, variant.ink);

  const styles: Record<string, string> = {};
  for (const [key, values] of Object.entries(options.styles)) {
    const chosen = custom?.styles?.[key];
    styles[key] =
      chosen && values.includes(chosen) ? chosen : (values[0] ?? "");
  }

  return {
    variantId: variant.id,
    accent,
    accentText: guard.color,
    onAccent,
    paper: variant.paper,
    ink: variant.ink,
    accentSnapped: guard.snapped,
    dispVar: fontPair.dispVar,
    bodyVar: fontPair.bodyVar,
    styles,
    sections: resolveSections(options, custom),
    motion: custom?.motion === "calm" ? "calm" : "full",
    grain: custom ? custom.grain !== false : true,
  };
}
