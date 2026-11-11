import type { ThemeOptions } from "@/lib/customizer/theme-options";

/**
 * Id varian "Edisi Indonesia" (DECISIONS #130) — juga nilai `data-variant` di
 * akar yang menyaring judul dua bahasa & gaya edisinya di warta.css.
 */
export const VARIAN_EDISI_INDONESIA = "indonesia";

/** Slot foto khas Warta: foto lebar penuh halaman Berita (DECISIONS #131). */
export const SLOT_FOTO_BERITA = "x-berita";

/**
 * Kontrak kustomisasi tema `warta` (CUSTOMIZER-SPEC §3, THEME-CONTRACT) —
 * undangan berwujud koran retro ("The Wedding Post"), tier Craft.
 *
 * Varian = warna TINTA cetak di atas kertas koran: aksen dipakai pita ticker,
 * tombol, garis kop, dan hati di kalender. `customAccent:false` — kurasi menjaga
 * kontras pita gelap. Varian keempat "Edisi Indonesia" (DECISIONS #130) lebih
 * dari warna: `data-variant="indonesia"` di akar menukar judul dekoratif ke
 * bahasa Indonesia, foto polos tanpa raster, dan font Dhaksinarga (warta.css).
 *
 * Satu pasangan font: Anton (judul) + PT Serif (isi); font kop
 * (UnifrakturMaguntia), subjudul (Playfair), eyebrow (Montserrat), mesin
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
    {
      // Kertas abu-abu halaman acuan pemilik (terukur #c6c6c6).
      id: VARIAN_EDISI_INDONESIA,
      name: "Edisi Indonesia",
      acc: "#1c1c1c",
      paper: "#c6c6c6",
      ink: "#141414",
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
      // `.wt-photo--news`, kedua edisi; tanpa foto = tak dirender.
      { id: SLOT_FOTO_BERITA, label: "Foto berita utama", aspect: 3 / 2 },
    ],
    // Feature: entri genap lanskap (`wt-photo--wide`), ganjil potret
    // (`wt-photo--tall`) — warta.css.
    // `galleryFallback`: tanpa foto cerita, galeri berurutan (`fotoCerita`).
    // Edisi Indonesia: bingkai acuan pemilik ±8:9 lalu ±5:7 (warta.css).
    story: {
      aspect: [4 / 3, 3 / 4],
      galleryFallback: true,
      aspectPerVarian: { [VARIAN_EDISI_INDONESIA]: [8 / 9, 5 / 7] },
    },
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
