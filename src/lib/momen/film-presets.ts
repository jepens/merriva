/**
 * Preset filter film Album Momen — sumber kebenaran tunggal untuk preview & bake.
 *
 * Dua lapis (MOMEN-SPEC §3):
 * - `css` + `overlay`: preview live murah di atas <video>/<img> (CSS filter jalan
 *   di semua browser termasuk iOS Safari; temp/tint/vignette lewat layer overlay).
 * - `params`: bake permanen per-piksel via `film-render.ts` — TANPA `ctx.filter`
 *   (dukungan Safari tidak andal), hasil identik lintas browser & teruji unit.
 *
 * Nama preset milik Merriva sendiri — bukan merek stok film (Kodak/Fujifilm/
 * Ilford adalah merek dagang pihak ketiga; kita hanya mengejar karakter visual).
 */

export interface FilmParams {
  /** Pengali terang, 1 = netral (0.5–1.5). */
  bright: number;
  /** Kontras di sekitar 128, 1 = netral (0.5–1.6). */
  contrast: number;
  /** Saturasi, 1 = netral, 0 = kelabu. Diabaikan bila `mono`. */
  saturate: number;
  /** Suhu warna −1..1; positif = hangat (R naik, B turun). */
  temp: number;
  /** Tint −1..1; positif = magenta, negatif = hijau. */
  tint: number;
  /** 0..1 — "fade film": hitam terangkat, bayangan pudar. */
  fade: number;
  /** Hitam-putih (luma Rec.601). */
  mono: boolean;
  /** 0..1 kekuatan vignette (sudut menggelap). */
  vignette: number;
  /** 0..1 kekuatan grain (deterministik per seed). */
  grain: number;
  /** 0..1 halation: pendar merah-oranye di sekitar area sangat terang. */
  halation: number;
}

export interface FilmPreset {
  id: FilmPresetId;
  /** Nama tampilan (Bahasa Indonesia, milik Merriva). */
  name: string;
  /** Deskripsi singkat untuk UI pemilih filter. */
  desc: string;
  /** String CSS `filter` untuk preview live. */
  css: string;
  /**
   * CSS `background` untuk layer overlay preview (tint suhu + vignette),
   * dipasang dengan `mix-blend-mode` normal + `pointer-events:none`.
   * String kosong = tanpa overlay.
   */
  overlay: string;
  params: FilmParams;
}

export const FILM_PRESET_IDS = [
  "polos",
  "hangat",
  "vivid",
  "pesta",
  "mono",
  "senja",
] as const;

export type FilmPresetId = (typeof FILM_PRESET_IDS)[number];

const NEUTRAL: FilmParams = {
  bright: 1,
  contrast: 1,
  saturate: 1,
  temp: 0,
  tint: 0,
  fade: 0,
  mono: false,
  vignette: 0,
  grain: 0,
  halation: 0,
};

export const FILM_PRESETS: readonly FilmPreset[] = [
  {
    id: "polos",
    name: "Polos",
    desc: "Apa adanya, tanpa efek",
    css: "none",
    overlay: "",
    params: { ...NEUTRAL },
  },
  {
    id: "hangat",
    name: "Hangat",
    desc: "Lembut & hangat, hitam pudar",
    css: "brightness(1.04) contrast(0.94) saturate(0.92) sepia(0.14)",
    overlay:
      "radial-gradient(140% 110% at 50% 45%, rgba(255,176,102,0.10), rgba(31,20,10,0.18) 100%)",
    params: {
      ...NEUTRAL,
      bright: 1.04,
      contrast: 0.94,
      saturate: 0.92,
      temp: 0.28,
      tint: 0.04,
      fade: 0.35,
      vignette: 0.16,
      grain: 0.22,
    },
  },
  {
    id: "vivid",
    name: "Vivid",
    desc: "Warna berani, kontras tegas",
    css: "brightness(1.02) contrast(1.14) saturate(1.32)",
    overlay:
      "radial-gradient(150% 120% at 50% 45%, rgba(0,0,0,0), rgba(10,8,16,0.22) 100%)",
    params: {
      ...NEUTRAL,
      bright: 1.02,
      contrast: 1.14,
      saturate: 1.32,
      temp: 0.06,
      vignette: 0.2,
      grain: 0.12,
    },
  },
  {
    id: "pesta",
    name: "Pesta",
    desc: "Gaya kamera saku + lampu kilat",
    css: "brightness(1.1) contrast(1.2) saturate(1.12)",
    overlay:
      "radial-gradient(120% 95% at 50% 42%, rgba(255,255,255,0.06), rgba(6,8,18,0.34) 100%)",
    params: {
      ...NEUTRAL,
      bright: 1.1,
      contrast: 1.2,
      saturate: 1.12,
      temp: -0.08,
      tint: 0.05,
      fade: 0.1,
      vignette: 0.38,
      grain: 0.42,
    },
  },
  {
    id: "mono",
    name: "Mono",
    desc: "Hitam-putih klasik, grain jelas",
    css: "grayscale(1) brightness(1.03) contrast(1.16)",
    overlay:
      "radial-gradient(150% 120% at 50% 45%, rgba(0,0,0,0), rgba(0,0,0,0.26) 100%)",
    params: {
      ...NEUTRAL,
      bright: 1.03,
      contrast: 1.16,
      mono: true,
      fade: 0.18,
      vignette: 0.24,
      grain: 0.5,
    },
  },
  {
    id: "senja",
    name: "Senja",
    desc: "Malam sinematik, pendar lampu",
    css: "brightness(1.02) contrast(1.08) saturate(1.06)",
    overlay:
      "radial-gradient(140% 110% at 50% 45%, rgba(96,150,255,0.08), rgba(4,6,20,0.30) 100%)",
    params: {
      ...NEUTRAL,
      bright: 1.02,
      contrast: 1.08,
      saturate: 1.06,
      temp: -0.22,
      tint: 0.06,
      fade: 0.12,
      vignette: 0.28,
      grain: 0.3,
      halation: 0.55,
    },
  },
];

const BY_ID = new Map(FILM_PRESETS.map((p) => [p.id, p]));

/** Ambil preset by id; fallback ke `polos` untuk id tak dikenal (defensif). */
export function getFilmPreset(id: string): FilmPreset {
  return BY_ID.get(id as FilmPresetId) ?? FILM_PRESETS[0]!;
}

/** True bila `id` adalah preset yang dikenal. */
export function isFilmPresetId(id: string): id is FilmPresetId {
  return BY_ID.has(id as FilmPresetId);
}
