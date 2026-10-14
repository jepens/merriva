/**
 * Options kustomisasi tema `festa` (family ceria, tier Craft). Fase G. Palet
 * hangat multi-warna → varian memvariasikan WARNA UTAMA (matahari) sambil menjaga
 * koral + teal + krem sebagai pop meriah. `customAccent:false`. Font tunggal.
 * Motion: CSS (blob/marquee) → calm mematikan via CSS.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#fff7e8";
const INK = "#4a3423";

export const festaOptions: ThemeOptions = {
  variants: [
    { id: "sun", name: "Kuning", acc: "#f5b93f", paper: PAPER, ink: INK },
    { id: "pink", name: "Merah Muda", acc: "#ef6f9c", paper: PAPER, ink: INK },
    { id: "mint", name: "Hijau Mint", acc: "#46a883", paper: PAPER, ink: INK },
    { id: "sky", name: "Biru Langit", acc: "#4e9de5", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Bricolage Grotesque + Figtree",
      dispVar: "var(--ft-disp)",
      bodyVar: "var(--ft-body)",
    },
  ],
  sections: [
    { id: "hero", reorder: false, toggle: false },
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
  preview: {
    root: "ft",
    vars: [{ name: "--ft-sun", token: "accent" }],
  },
};
