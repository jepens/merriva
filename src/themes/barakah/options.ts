/**
 * Options kustomisasi tema `barakah` (wedding islami elegan, tier Story). Fase G.
 * Palet terkurasi memvariasikan permata primer (emerald→maroon→biru tua) sambil
 * mempertahankan emas + pasir + teks agar identitas islami koheren.
 * `customAccent:false` (kurasi menjamin kontras). Dua pasangan font (a bawaan,
 * b Cormorant Garamond + Jost). Motion = gsap → `calm` via CoverGate.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#f4efe2";
const INK = "#22312a";

export const barakahOptions: ThemeOptions = {
  variants: [
    { id: "emerald", name: "Zamrud", acc: "#0e3b30", paper: PAPER, ink: INK },
    { id: "maroon", name: "Maroon", acc: "#6d2532", paper: PAPER, ink: INK },
    { id: "navy", name: "Biru Tua", acc: "#1f3a5f", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Marcellus + Figtree",
      dispVar: "var(--bk-disp-a)",
      bodyVar: "var(--bk-body-a)",
    },
    {
      id: "b",
      name: "Cormorant Garamond + Jost",
      dispVar: "var(--bk-disp-b)",
      bodyVar: "var(--bk-body-b)",
    },
  ],
  sections: [
    { id: "hero", reorder: false, toggle: false },
    { id: "quote", reorder: true, toggle: true },
    { id: "couple", reorder: true, toggle: false },
    { id: "countdown", reorder: true, toggle: true },
    { id: "schedule", reorder: true, toggle: true },
    { id: "gallery", reorder: true, toggle: true },
    { id: "story", reorder: true, toggle: true },
    { id: "envelope", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false },
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
  // `aspect` = rasio wadahnya di CSS (.bk-mihrab aspect-ratio: 4/5.4) — dipakai editor untuk
  // bingkai penyesuaian, BUKAN untuk memangkas berkas.
  media: {
    slots: [
      { id: "groom", aspect: 4 / 5.4 },
      { id: "bride", aspect: 4 / 5.4 },
    ],
  },
  preview: {
    root: "bk",
    vars: [
      { name: "--bk-sand", token: "paper" },
      { name: "--bk-ink", token: "ink" },
      { name: "--bk-emerald", token: "accent" },
      { name: "--bk-emerald-d", token: "accent" },
      { name: "--bk-display", token: "disp" },
      { name: "--bk-body", token: "body" },
    ],
  },
};
