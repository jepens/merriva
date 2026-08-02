/**
 * Options kustomisasi tema `verdant` (wedding botanikal, tier Story). Fase G.
 * Palet terkurasi memvariasikan aksen primer (kertas ivory & teks dijaga tetap
 * agar token turunan koheren). `customAccent:false` (kurasi menjamin kontras).
 * Font tunggal. Motion = gsap → `calm` via CoverGate (tanpa CSS tambahan).
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#faf6ed";
const INK = "#3a3126";

export const verdantOptions: ThemeOptions = {
  variants: [
    { id: "sage", name: "Sage", acc: "#75855f", paper: PAPER, ink: INK },
    {
      id: "terracotta",
      name: "Terakota",
      acc: "#b5623f",
      paper: PAPER,
      ink: INK,
    },
    { id: "dusk", name: "Biru Debu", acc: "#5f7285", paper: PAPER, ink: INK },
    { id: "plum", name: "Plum", acc: "#7d5568", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "EB Garamond + Karla",
      dispVar: "var(--vd-serif)",
      bodyVar: "var(--vd-sans)",
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
  styles: {},
  supports: {
    customAccent: false,
    motion: true,
    grain: true,
  },
};
