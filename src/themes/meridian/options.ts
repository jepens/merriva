/**
 * Options kustomisasi tema `meridian` (wedding Art Deco gala, tier Story).
 * Fase G. Tema GELAP (navy) → varian memvariasikan AKSEN METALIK (emas/perak)
 * sambil mempertahankan basis navy agar nuansa gala koheren. `customAccent:false`.
 * Font tunggal. Motion: gsap + shimmer CSS (calm mematikan shimmer via CSS).
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#0f1826";
const INK = "#f7f4ec";

export const meridianOptions: ThemeOptions = {
  variants: [
    { id: "gold", name: "Emas", acc: "#a97e35", paper: PAPER, ink: INK },
    {
      id: "rosegold",
      name: "Emas Mawar",
      acc: "#c39b7b",
      paper: PAPER,
      ink: INK,
    },
    { id: "silver", name: "Perak", acc: "#aab4bd", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Italiana + Jost",
      dispVar: "var(--mrd-display)",
      bodyVar: "var(--mrd-body)",
    },
  ],
  sections: [
    { id: "intro", reorder: false, toggle: false },
    { id: "couple", reorder: true, toggle: false },
    { id: "countdown", reorder: true, toggle: true },
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
};
