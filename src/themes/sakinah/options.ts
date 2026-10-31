/**
 * Options kustomisasi tema `sakinah` (wedding syar'i TANPA FOTO, tier Craft).
 * THEME-WAVE3 §2.3. Nol foto secara desain → `media` TIDAK dideklarasikan
 * (editor tak menampilkan bidang unggah apa pun — jujur, bukan fitur hilang).
 * Galeri tak ada; diganti section khas `x-doa`. `customAccent:false` (kurasi
 * menjamin kontras), `motion:false` (Craft). Dua pasangan font.
 */
import type { ThemeOptions } from "@/lib/customizer/theme-options";

const PAPER = "#f7f3ea";
const INK = "#2a3328";

export const sakinahOptions: ThemeOptions = {
  variants: [
    { id: "sage", name: "Sage", acc: "#3e5340", paper: PAPER, ink: INK },
    {
      id: "tenang",
      name: "Biru Tenang",
      acc: "#33415c",
      paper: "#f2f3ef",
      ink: "#242b33",
    },
    {
      id: "khidmat",
      name: "Maroon Khidmat",
      acc: "#5e2430",
      paper: "#f7f1e8",
      ink: "#33251f",
    },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Amiri + Plus Jakarta Sans",
      dispVar: "var(--sk-disp-a)",
      bodyVar: "var(--sk-body-a)",
    },
    {
      id: "b",
      name: "EB Garamond + Karla",
      dispVar: "var(--sk-disp-b)",
      bodyVar: "var(--sk-body-b)",
    },
  ],
  sections: [
    { id: "hero", reorder: false, toggle: false },
    { id: "quote", reorder: true, toggle: true },
    { id: "couple", reorder: true, toggle: false },
    { id: "countdown", reorder: true, toggle: true },
    { id: "schedule", reorder: true, toggle: true },
    { id: "x-doa", reorder: true, toggle: true, label: "Doa Pengantin" },
    { id: "rsvp", reorder: true, toggle: false },
    { id: "envelope", reorder: true, toggle: true },
  ],
  styles: {},
  supports: {
    customAccent: false,
    motion: false,
    grain: true,
  },
  // TANPA `media`: tema ini tidak merender foto apa pun (THEME-WAVE3 §3.3).
  preview: {
    root: "sk",
    vars: [
      { name: "--sk-acc", token: "accent" },
      { name: "--sk-acc-d", token: "accent" },
      { name: "--sk-paper", token: "paper" },
      { name: "--sk-ink", token: "ink" },
      { name: "--sk-display", token: "disp" },
      { name: "--sk-body", token: "body" },
    ],
  },
};
