/**
 * Options kustomisasi tema `noir` (wedding sinematik, tier Story). Fase G.
 * Tema GELAP → palet terkurasi memvariasikan AKSEN (bg/teks dijaga tetap agar
 * token turunan koheren). `customAccent:false` (penjaga kontras hanya menggelapkan
 * = salah arah di kertas gelap; kurasi menjamin kontras). Dua pasangan font
 * (a bawaan, b Playfair Display + Montserrat). Motion = gsap → `calm` ditangani
 * CoverGate (tanpa CSS tambahan).
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#0d0d12";
const INK = "#ece7dd";

export const noirOptions: ThemeOptions = {
  variants: [
    {
      id: "champagne",
      name: "Sampanye",
      acc: "#cba15f",
      paper: PAPER,
      ink: INK,
    },
    { id: "silver", name: "Perak", acc: "#b9c2cc", paper: PAPER, ink: INK },
    {
      id: "rosegold",
      name: "Rose Gold",
      acc: "#cf9b8f",
      paper: PAPER,
      ink: INK,
    },
    { id: "emerald", name: "Zamrud", acc: "#7fb69a", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Cormorant Garamond + Jost",
      dispVar: "var(--nr-disp-a)",
      bodyVar: "var(--nr-body-a)",
    },
    {
      id: "b",
      name: "Playfair Display + Montserrat",
      dispVar: "var(--nr-disp-b)",
      bodyVar: "var(--nr-body-b)",
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
};
