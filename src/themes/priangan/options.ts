/**
 * Options kustomisasi tema `priangan` (wedding adat Sunda, tier Story).
 * THEME-WAVE3 §2.1. Varian memvariasikan aksen (Pinus/Senja/Sogan) di kertas
 * gading yang sama. `customAccent:false` (kurasi menjamin kontras). Dua
 * pasangan font. Motion = gsap → `calm` via CoverGate.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#f6f1e3";
const INK = "#23311f";

export const prianganOptions: ThemeOptions = {
  variants: [
    { id: "pinus", name: "Pinus", acc: "#2e5b41", paper: PAPER, ink: INK },
    { id: "senja", name: "Senja", acc: "#35466b", paper: PAPER, ink: INK },
    { id: "sogan", name: "Sogan", acc: "#7a4f24", paper: PAPER, ink: INK },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Prata + Mulish",
      dispVar: "var(--pg-disp-a)",
      bodyVar: "var(--pg-body-a)",
    },
    {
      id: "b",
      name: "Cormorant Garamond + Karla",
      dispVar: "var(--pg-disp-b)",
      bodyVar: "var(--pg-body-b)",
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
    { id: "envelope", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false },
  ],
  styles: {
    gallery: ["arch", "grid"],
  },
  supports: {
    customAccent: false,
    motion: true,
    grain: true,
  },
  // Rasio = wadah `.pg-foto` (210×270 − padding bingkai) di priangan.css.
  media: {
    slots: [
      { id: "groom", aspect: 194 / 254 },
      { id: "bride", aspect: 194 / 254 },
    ],
  },
  preview: {
    root: "pg",
    vars: [
      { name: "--pg-acc", token: "accent" },
      { name: "--pg-acc-d", token: "accent" },
      { name: "--pg-paper", token: "paper" },
      { name: "--pg-ink", token: "ink" },
      { name: "--pg-display", token: "disp" },
      { name: "--pg-body", token: "body" },
    ],
  },
};
