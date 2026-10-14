/**
 * Options kustomisasi tema `prisma` (corporate eksperimental, tier Signature).
 * Fase G. Tema GELAP (aurora) → varian memvariasikan WARNA SOROTAN utama
 * (lime/magenta/amber) di atas latar aurora violet-cyan yang dipertahankan.
 * `customAccent:false`. Font tunggal. Motion: gsap + aurora/marquee CSS (calm
 * mematikan keduanya via CSS). Bernomor & blok Acara gabungan → dua jalur render.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#0a0a16";
const INK = "#f2f2f7";

export const prismaOptions: ThemeOptions = {
  variants: [
    { id: "lime", name: "Lime", acc: "#d8ff5f", paper: PAPER, ink: INK },
    { id: "magenta", name: "Magenta", acc: "#ff5fa2", paper: PAPER, ink: INK },
    { id: "amber", name: "Amber", acc: "#ffb84d", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Space Grotesk + Space Mono",
      dispVar: "var(--pr-disp)",
      bodyVar: "var(--pr-mono)",
    },
  ],
  sections: [
    { id: "hero", reorder: false, toggle: false },
    { id: "agenda", reorder: true, toggle: true },
    { id: "schedule", reorder: true, toggle: true },
    { id: "gallery", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false },
    { id: "envelope", reorder: true, toggle: true },
  ],
  styles: {},
  supports: {
    customAccent: false,
    motion: true,
    grain: true,
  },
  preview: {
    root: "pr",
    vars: [{ name: "--pr-lime", token: "accent" }],
  },
};
