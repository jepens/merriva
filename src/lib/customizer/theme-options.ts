/**
 * Kontrak "options schema" per tema (CUSTOMIZER-SPEC §3) + bentuk
 * `settings.custom` (§2). Framework-free — satu sumber kebenaran yang dibaca
 * editor generik (render kontrol) DAN validator server (whitelist).
 */

/** Satu varian warna terkurasi milik tema. */
export interface ThemeVariant {
  id: string;
  name: string;
  /** Warna aksen (dekoratif). Teks aksen dihitung via contrast-guard. */
  acc: string;
  /** Warna kertas/latar utama. */
  paper: string;
  /** Warna teks utama. */
  ink: string;
}

/** Pasangan font terkurasi. `dispVar`/`bodyVar` = CSS var dari next/font tema. */
export interface FontPairOption {
  id: string;
  name: string;
  /** contoh: "var(--er-disp-a)" — di-wire ke instance next/font tema. */
  dispVar: string;
  bodyVar: string;
}

/** Section yang dikenal tema + kebebasannya. */
export interface SectionOption {
  id: string;
  /** Boleh dipindah urutannya oleh user. */
  reorder: boolean;
  /** Boleh disembunyikan oleh user (false = wajib tampil). */
  toggle: boolean;
}

/** Token render yang bisa dipetakan ke CSS var tema. */
export type PreviewVarToken =
  | "accent"
  | "accentText"
  | "onAccent"
  | "paper"
  | "ink"
  | "disp"
  | "body";

/** Pemetaan: nama CSS var milik tema ← nilai token hasil resolve. */
export interface PreviewVar {
  /** contoh: "--rose", "--er-serif". */
  name: string;
  token: PreviewVarToken;
}

/**
 * Kontrak DOM tema untuk pratinjau langsung editor (Fase G). SATU SUMBER yang
 * dipakai BERSAMA oleh render server (index.tsx menyusun `appearance.style` dari
 * `vars` lewat `appearanceStyle`) DAN editor (menerapkan var yang sama ke iframe
 * same-origin) → editor ≡ halaman publik, tanpa duplikasi yang bisa drift.
 * Selektor turunan mengikuti konvensi kelas tema `<root>` / `<root>-stage` /
 * `<root>-grain` / `<root>-open`; override hanya bila tema menyimpang.
 */
export interface PreviewContract {
  /** Kelas akar tema (token pertama rootClassName), mis. "er", "nr", "mrd". */
  root: string;
  /** Pemetaan CSS var tema ← token resolve (dipakai server & editor). */
  vars: readonly PreviewVar[];
  /** Override kelas stage (default `${root}-stage`). */
  stage?: string;
  /** Override kelas grain; `false` bila tema tanpa grain (default `${root}-grain`). */
  grain?: string | false;
  /** Override kelas tombol buka sampul (default `${root}-open`). */
  open?: string;
}

export interface ThemeOptions {
  /** Minimal 1; index 0 = bawaan tema. */
  variants: readonly ThemeVariant[];
  /** Minimal 1, maksimal 3 (anggaran font); index 0 = bawaan (tier Basic). */
  fontPairs: readonly FontPairOption[];
  /** Daftar LENGKAP section tema, dalam urutan bawaan. */
  sections: readonly SectionOption[];
  /** Gaya per-section: key → daftar nilai; index 0 = bawaan (tier Basic). */
  styles: Readonly<Record<string, readonly string[]>>;
  supports: {
    customAccent: boolean;
    motion: boolean;
    grain: boolean;
  };
  /** Kontrak DOM untuk pratinjau langsung editor + penyusunan `appearance.style`. */
  preview: PreviewContract;
}

/** Bentuk `settings.custom` v1 (disimpan di invitations.settings.custom). */
export interface CustomSettings {
  v: 1;
  variant: string;
  /** "#rrggbb" HANYA bila custom accent (Premium); null = ikut varian. */
  accent: string | null;
  fontPair: string;
  /** Permutasi lengkap section tema: urutan render + visibilitas. */
  sections: Array<{ id: string; visible: boolean }>;
  styles: Record<string, string>;
  motion: "full" | "calm";
  grain: boolean;
}

/** Default `settings.custom` = bawaan tema, diturunkan dari schema-nya. */
export function defaultCustomSettings(options: ThemeOptions): CustomSettings {
  const styles: Record<string, string> = {};
  for (const [key, values] of Object.entries(options.styles)) {
    const first = values[0];
    if (first !== undefined) styles[key] = first;
  }
  const variant = options.variants[0];
  const fontPair = options.fontPairs[0];
  if (!variant || !fontPair) {
    throw new Error("ThemeOptions minimal punya 1 variant dan 1 fontPair");
  }
  return {
    v: 1,
    variant: variant.id,
    accent: null,
    fontPair: fontPair.id,
    sections: options.sections.map((s) => ({ id: s.id, visible: true })),
    styles,
    motion: "full",
    grain: true,
  };
}
