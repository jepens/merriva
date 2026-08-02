/**
 * Options kustomisasi tema `aria` (wedding minimalis galeri, tier Craft). Fase G.
 * Monokrom + satu aksen → varian memvariasikan warna aksen (kertas & tinta tetap).
 * `customAccent:false` (kurasi menjamin kontras). `motion:false` (Craft — gerak
 * intrinsik minimal, tak diatur user). Countdown menyatu di blok Acara (tak jadi
 * section terpisah pada mode kustomisasi). Font tunggal.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#fbfaf7";
const INK = "#151310";

export const ariaOptions: ThemeOptions = {
  variants: [
    { id: "red", name: "Merah", acc: "#c0392b", paper: PAPER, ink: INK },
    { id: "blue", name: "Biru Klasik", acc: "#2f5fb0", paper: PAPER, ink: INK },
    {
      id: "green",
      name: "Hijau Hutan",
      acc: "#2f6b4f",
      paper: PAPER,
      ink: INK,
    },
    { id: "mono", name: "Monokrom", acc: "#3a3632", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Instrument Serif + Inter",
      dispVar: "var(--ar-serif)",
      bodyVar: "var(--ar-sans)",
    },
  ],
  sections: [
    { id: "opening", reorder: false, toggle: true },
    { id: "couple", reorder: true, toggle: false },
    { id: "schedule", reorder: true, toggle: true },
    { id: "gallery", reorder: true, toggle: true },
    { id: "story", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false },
    { id: "envelope", reorder: true, toggle: true },
  ],
  styles: {},
  supports: {
    customAccent: false,
    motion: false,
    grain: true,
  },
  preview: {
    root: "ar",
    vars: [
      { name: "--ar-paper", token: "paper" },
      { name: "--ar-ink", token: "ink" },
      { name: "--ar-red", token: "accent" },
    ],
  },
};
