/**
 * Options kustomisasi tema `meridian` (wedding Art Deco gala, tier Story).
 * Fase G. Tema GELAP (navy) → varian memvariasikan AKSEN METALIK (emas/perak)
 * sambil mempertahankan basis navy agar nuansa gala koheren. `customAccent:false`.
 * Dua pasangan font (Italiana / Bodoni Moda + Jost). Motion: gsap + shimmer CSS
 * (calm mematikan shimmer via CSS).
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#0f1826";
const INK = "#f7f4ec";

export const meridianOptions: ThemeOptions = {
  variants: [
    { id: "gold", name: "Emas", acc: "#a97e35", paper: PAPER, ink: INK },
    {
      id: "rosegold",
      name: "Emas Mawar",
      acc: "#c39b7b",
      paper: PAPER,
      ink: INK,
    },
    { id: "silver", name: "Perak", acc: "#aab4bd", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Italiana + Jost",
      dispVar: "var(--mrd-disp-a)",
      bodyVar: "var(--mrd-body-a)",
    },
    {
      id: "b",
      name: "Bodoni Moda + Jost",
      dispVar: "var(--mrd-disp-b)",
      bodyVar: "var(--mrd-body-b)",
    },
  ],
  sections: [
    { id: "hero", reorder: false, toggle: false },
    { id: "couple", reorder: true, toggle: false },
    { id: "countdown", reorder: true, toggle: true },
    { id: "schedule", reorder: true, toggle: true },
    { id: "gallery", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false },
    { id: "envelope", reorder: true, toggle: true },
  ],
  styles: {
    gallery: ["strip", "grid", "polaroid"],
  },
  supports: {
    customAccent: false,
    motion: true,
    grain: true,
  },
  // Foto bernama yang BENAR-BENAR dirender tema ini (THEME-CONTRACT §2).
  // `aspect` = rasio wadahnya di CSS (.mrd-stepped aspect-ratio: 4/5) — dipakai editor untuk
  // bingkai penyesuaian, BUKAN untuk memangkas berkas.
  media: {
    slots: [
      { id: "groom", aspect: 4 / 5 },
      { id: "bride", aspect: 4 / 5 },
    ],
  },
  preview: {
    root: "mrd",
    // `--mrd-display`/`--mrd-body` = var yang dibaca mrd.css; tanpa keduanya
    // pasangan "Bodoni Moda + Jost" terpilih tetapi tak pernah dirender.
    vars: [
      { name: "--mrd-gold", token: "accent" },
      { name: "--mrd-display", token: "disp" },
      { name: "--mrd-body", token: "body" },
    ],
  },
};
