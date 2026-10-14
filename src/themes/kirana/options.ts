/**
 * Options kustomisasi tema `kirana` (wedding adat Jawa modern, tier Story).
 * Fase G. Palet sogan → varian memvariasikan aksen (Sogan/Indigo/Hitam Wayang)
 * sambil mempertahankan krem + emas agar nuansa Jawa koheren. `customAccent:false`
 * (kurasi menjamin kontras). Font tunggal. Motion = gsap → `calm` via CoverGate.
 * Urutan kirana: RSVP sebelum amplop; hero dapat disembunyikan.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#e2d5b4";
const INK = "#3b2f22";

export const kiranaOptions: ThemeOptions = {
  variants: [
    { id: "sogan", name: "Sogan", acc: "#6b4a2b", paper: PAPER, ink: INK },
    { id: "indigo", name: "Indigo", acc: "#35485f", paper: PAPER, ink: INK },
    {
      id: "wayang",
      name: "Hitam Wayang",
      acc: "#2a241d",
      paper: PAPER,
      ink: INK,
    },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Cormorant Upright + Figtree",
      dispVar: "var(--kr-disp-a)",
      bodyVar: "var(--kr-body-a)",
    },
    {
      id: "b",
      name: "Playfair Display + Karla",
      dispVar: "var(--kr-disp-b)",
      bodyVar: "var(--kr-body-b)",
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
  preview: {
    root: "kr",
    vars: [
      { name: "--kr-sogan", token: "accent" },
      { name: "--kr-sogan-d", token: "accent" },
      { name: "--kr-ink", token: "ink" },
      { name: "--kr-display", token: "disp" },
      { name: "--kr-body", token: "body" },
    ],
  },
};
