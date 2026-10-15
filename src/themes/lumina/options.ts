/**
 * Options kustomisasi tema `lumina` (universal, tier Craft). Fase G. Estetika
 * soft-film netral → varian memvariasikan aksen taupe (kertas & tinta tetap).
 * `customAccent:false` (kurasi menjamin kontras). `motion:false` (Craft — gerak
 * intrinsik minimal). Font tunggal. Adaptif semua kategori; id section netral.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#e9e5dc";
const INK = "#2a2723";

export const luminaOptions: ThemeOptions = {
  variants: [
    { id: "taupe", name: "Taupe", acc: "#7a5f40", paper: PAPER, ink: INK },
    { id: "sage", name: "Sage", acc: "#5f6e4e", paper: PAPER, ink: INK },
    { id: "dusk", name: "Biru Kelabu", acc: "#566575", paper: PAPER, ink: INK },
    { id: "rose", name: "Rose", acc: "#855366", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Spectral + Karla",
      dispVar: "var(--lm-display)",
      bodyVar: "var(--lm-body)",
    },
  ],
  sections: [
    { id: "hero", reorder: false, toggle: false },
    { id: "couple", reorder: true, toggle: false },
    { id: "countdown", reorder: true, toggle: true },
    { id: "story", reorder: true, toggle: true },
    { id: "schedule", reorder: true, toggle: true },
    { id: "gallery", reorder: true, toggle: true },
    { id: "envelope", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false },
  ],
  styles: {},
  supports: {
    customAccent: false,
    motion: false,
    grain: true,
  },
  // Rasio = lebar/tinggi wadah `.lm-principal__ph` di `lm.css`. Keduanya harus
  // sama persis; bingkai penyesuaian di editor memakai angka ini.
  media: {
    slots: [
      { id: "groom", aspect: 4 / 5 },
      { id: "bride", aspect: 4 / 5 },
    ],
  },
  preview: {
    root: "lm",
    vars: [
      { name: "--lm-taupe", token: "accent" },
      { name: "--lm-taupe-ink", token: "accent" },
    ],
  },
};
