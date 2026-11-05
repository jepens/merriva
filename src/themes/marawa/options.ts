/**
 * Options kustomisasi tema `marawa` (wedding adat Minang, tier Story, dark).
 * THEME-WAVE3 §2.2. Varian memvariasikan latar gelap (Maroon Malam / Hitam
 * Songket / Hijau Gadang) dengan emas tetap. `customAccent:false`. Dua pasangan
 * font. Motion = gsap → `calm` via CoverGate.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const INK = "#f2e7d4";

export const marawaOptions: ThemeOptions = {
  variants: [
    {
      id: "maroon",
      name: "Maroon Malam",
      acc: "#d4a848",
      paper: "#1a1412",
      ink: INK,
    },
    {
      id: "hitam",
      name: "Hitam Songket",
      acc: "#d4a848",
      paper: "#141110",
      ink: INK,
    },
    {
      id: "gadang",
      name: "Hijau Gadang",
      acc: "#cfa64b",
      paper: "#152019",
      ink: "#eef0e3",
    },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Cinzel + Albert Sans",
      dispVar: "var(--mw-disp-a)",
      bodyVar: "var(--mw-body-a)",
    },
    {
      id: "b",
      name: "Playfair Display + Figtree",
      dispVar: "var(--mw-disp-b)",
      bodyVar: "var(--mw-body-b)",
    },
  ],
  sections: [
    { id: "hero", reorder: false, toggle: false },
    { id: "quote", reorder: true, toggle: true },
    { id: "couple", reorder: true, toggle: false },
    { id: "countdown", reorder: true, toggle: true },
    { id: "schedule", reorder: true, toggle: true },
    { id: "story", reorder: true, toggle: true },
    { id: "gallery", reorder: true, toggle: true },
    { id: "video", reorder: true, toggle: true },
    { id: "envelope", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false },
  ],
  styles: {
    gallery: ["songket", "grid"],
  },
  supports: {
    customAccent: false,
    motion: true,
    grain: true,
  },
  // Rasio = wadah `.mw-foto` (216×264 − padding bingkai) di marawa.css.
  media: {
    slots: [
      { id: "groom", aspect: 198 / 246 },
      { id: "bride", aspect: 198 / 246 },
    ],
  },
  preview: {
    root: "mw",
    vars: [
      { name: "--mw-gold", token: "accent" },
      { name: "--mw-gold-soft", token: "accent" },
      { name: "--mw-bg", token: "paper" },
      { name: "--mw-ink", token: "ink" },
      { name: "--mw-display", token: "disp" },
      { name: "--mw-body", token: "body" },
    ],
  },
};
