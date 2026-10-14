/**
 * Options schema tema `eternal-rose` — acuan pertama (CUSTOMIZER-SPEC §10).
 * Varian & gaya sesuai prototipe teruji `prototypes/customizer-mobile.html`.
 *
 * `dispVar`/`bodyVar` menunjuk CSS var instance next/font tema (didefinisikan di
 * `index.tsx`); resolver memetakan pasangan aktif → `--er-serif`/`--er-sans`.
 * Pasangan b/c memakai instance next/font tambahan (maks 3 — anggaran font).
 * `sections[].id` = id section final tema (dipakai section-map di `index.tsx`).
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

export const eternalRoseOptions: ThemeOptions = {
  variants: [
    {
      id: "rose",
      name: "Rose",
      acc: "#B76E79",
      paper: "#F6EFE7",
      ink: "#241A1E",
    },
    {
      id: "sage",
      name: "Sage",
      acc: "#75855F",
      paper: "#F6F3E9",
      ink: "#26291E",
    },
    {
      id: "dusk",
      name: "Dusk",
      acc: "#4C5B8C",
      paper: "#F1F1F4",
      ink: "#1D2130",
    },
    {
      id: "mocha",
      name: "Mocha",
      acc: "#8A6A4F",
      paper: "#F7F1E8",
      ink: "#2A211A",
    },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Fraunces + Instrument Sans",
      dispVar: "var(--er-disp-a)",
      bodyVar: "var(--er-body-a)",
    },
    {
      id: "b",
      name: "Cormorant Garamond + Jost",
      dispVar: "var(--er-disp-b)",
      bodyVar: "var(--er-body-b)",
    },
    {
      id: "c",
      name: "Marcellus + Figtree",
      dispVar: "var(--er-disp-c)",
      bodyVar: "var(--er-body-c)",
    },
  ],
  sections: [
    { id: "hero", reorder: false, toggle: false }, // wajib & terkunci di atas
    { id: "quote", reorder: true, toggle: true },
    { id: "couple", reorder: true, toggle: false }, // mempelai wajib tampil
    { id: "countdown", reorder: true, toggle: true },
    { id: "schedule", reorder: true, toggle: true },
    { id: "gallery", reorder: true, toggle: true },
    { id: "story", reorder: true, toggle: true },
    { id: "envelope", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false }, // RSVP wajib tampil
  ],
  styles: {
    gallery: ["strip", "grid", "polaroid"],
  },
  supports: {
    customAccent: true,
    motion: true,
    grain: true,
  },
  // Foto bernama yang BENAR-BENAR dirender tema ini (THEME-CONTRACT §2).
  // `aspect` = rasio wadahnya di CSS (.er-arch aspect-ratio: 3/4) — dipakai editor untuk
  // bingkai penyesuaian, BUKAN untuk memangkas berkas.
  media: {
    slots: [
      { id: "groom", aspect: 3 / 4 },
      { id: "bride", aspect: 3 / 4 },
    ],
  },
  preview: {
    root: "er",
    vars: [
      { name: "--paper", token: "paper" },
      { name: "--ink", token: "ink" },
      { name: "--rose", token: "accent" },
      { name: "--er-acc-ink", token: "accentText" },
      { name: "--er-on-acc", token: "onAccent" },
      { name: "--er-serif", token: "disp" },
      { name: "--er-sans", token: "body" },
    ],
  },
};
