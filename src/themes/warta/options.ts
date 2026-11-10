import type { ThemeOptions } from "@/lib/customizer/theme-options";

/**
 * Kontrak kustomisasi tema `warta` (CUSTOMIZER-SPEC §3, THEME-CONTRACT) —
 * undangan berwujud koran retro ("The Wedding Post"), tier Craft.
 *
 * Varian = warna TINTA cetak di atas kertas koran: aksen dipakai pita ticker,
 * tombol, garis kop, dan hati di kalender. `customAccent:false` — kurasi menjaga
 * kontras pita gelap. Satu pasangan font: Anton (judul) + PT Serif (isi); font
 * kop (UnifrakturMaguntia), subjudul (Playfair), eyebrow (Montserrat), mesin
 * ketik (Special Elite), dan tanda tangan (Great Vibes) adalah IDENTITAS tema,
 * bukan pilihan.
 */
export const wartaOptions: ThemeOptions = {
  variants: [
    {
      id: "koran",
      name: "Koran Hitam",
      acc: "#191715",
      paper: "#fcfbf8",
      ink: "#191715",
    },
    {
      id: "sepia",
      name: "Sepia Lawas",
      acc: "#4a3420",
      paper: "#ece2cd",
      ink: "#2a1d12",
    },
    {
      id: "merah",
      name: "Tinta Merah",
      acc: "#9b1c1c",
      paper: "#fbf9f4",
      ink: "#191715",
    },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Anton + PT Serif",
      dispVar: "var(--wt-disp-a)",
      bodyVar: "var(--wt-body-a)",
    },
  ],
  // Urutan bawaan = susunan halaman koran: News → Couple → Feature → Diary →
  // Classified → Reply → Archive (+ kupon amplop).
  sections: [
    { id: "hero", reorder: false, toggle: false },
    { id: "quote", reorder: true, toggle: true },
    { id: "couple", reorder: true, toggle: true },
    { id: "story", reorder: true, toggle: true },
    { id: "countdown", reorder: true, toggle: true },
    { id: "schedule", reorder: true, toggle: true },
    { id: "video", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false },
    { id: "gallery", reorder: true, toggle: true },
    { id: "envelope", reorder: true, toggle: true },
  ],
  styles: {},
  supports: { customAccent: false, motion: true, grain: true },
  // Rasio = lebar/tinggi WADAH foto di warta.css.
  media: {
    slots: [
      { id: "cover", aspect: 4 / 3 },
      { id: "bride", aspect: 4 / 5 },
      { id: "groom", aspect: 4 / 5 },
    ],
  },
  preview: {
    root: "wt",
    vars: [
      { name: "--wt-acc", token: "accent" },
      { name: "--wt-acc-text", token: "accentText" },
      { name: "--wt-on-acc", token: "onAccent" },
      { name: "--wt-paper", token: "paper" },
      { name: "--wt-ink", token: "ink" },
      { name: "--wt-disp", token: "disp" },
      { name: "--wt-body", token: "body" },
    ],
  },
};
