/**
 * Options kustomisasi tema `barakah` (wedding islami elegan, tier Story). Fase G.
 * Palet terkurasi memvariasikan permata primer (emerald→maroon→biru tua) sambil
 * mempertahankan emas + pasir + teks agar identitas islami koheren.
 * `customAccent:false` (kurasi menjamin kontras). Font tunggal. Motion = gsap →
 * `calm` via CoverGate (tanpa CSS tambahan).
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
      dispVar: "var(--bk-display)",
      bodyVar: "var(--bk-body)",
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
