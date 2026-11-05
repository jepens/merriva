/**
 * Options kustomisasi tema `meihua` (wedding Tionghoa, tier Story).
 * THEME-WAVE3 §2.4. Varian: Merah Lacquer / Burgundy Malam / Champagne Siang.
 * `customAccent:false`. Dua pasangan font. Motion = gsap → `calm` via CoverGate.
 * Budaya (§3.4): merah+emas dominan; putih/hitam tak pernah jadi latar dominan.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

export const meihuaOptions: ThemeOptions = {
  variants: [
    {
      id: "lacquer",
      name: "Merah Lacquer",
      acc: "#e2b13c",
      paper: "#7c1e1a",
      ink: "#fbefd9",
    },
    {
      id: "burgundy",
      name: "Burgundy Malam",
      acc: "#e2b13c",
      paper: "#6e1f2e",
      ink: "#f6e8d8",
    },
    {
      id: "champagne",
      name: "Champagne Siang",
      acc: "#9e2b25",
      paper: "#faf4e8",
      ink: "#4a241c",
    },
  ],
  fontPairs: [
    {
      id: "a",
      name: "DM Serif Display + Work Sans",
      dispVar: "var(--mh-disp-a)",
      bodyVar: "var(--mh-body-a)",
    },
    {
      id: "b",
      name: "Playfair Display + Figtree",
      dispVar: "var(--mh-disp-b)",
      bodyVar: "var(--mh-body-b)",
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
    gallery: ["okta", "grid"],
  },
  supports: {
    customAccent: false,
    motion: true,
    grain: true,
  },
  // Rasio = wadah `.mh-foto` (212×256 − padding bingkai) di meihua.css.
  media: {
    slots: [
      { id: "groom", aspect: 194 / 238 },
      { id: "bride", aspect: 194 / 238 },
    ],
  },
  preview: {
    root: "mh",
    vars: [
      { name: "--mh-gold", token: "accent" },
      { name: "--mh-gold-soft", token: "accent" },
      { name: "--mh-red", token: "paper" },
      { name: "--mh-ink", token: "ink" },
      { name: "--mh-display", token: "disp" },
      { name: "--mh-body", token: "body" },
    ],
  },
};
