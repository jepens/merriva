/**
 * Bagian MURNI dari `pnpm theme:new` (THEME-CONTRACT §4) — tanpa I/O, supaya
 * bisa diuji.
 *
 * Menambah satu tema menyentuh ENAM tempat di luar folder temanya: empat
 * registry, satu migrasi seed, dan `pnpm thumbs`. Yang terlewat tak pernah
 * menimbulkan galat — ia hanya membuat tema tak muncul di katalog, atau muncul
 * tetapi gagal dirender. Dengan sepuluh tema itu masih bisa diingat; dengan
 * tiga puluh, tidak.
 *
 * Berkas yang dihasilkan SUDAH memenuhi kontrak (test konformansi hijau sejak
 * menit pertama). Yang belum ada hanyalah art direction — dan memang itulah
 * pekerjaan sungguhannya.
 */

/** Slug = nama folder `src/themes/{slug}` DAN kolom `themes.slug`. */
const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Prefix kelas CSS tema (mis. `er`, `mrd`) — pendek, huruf kecil. */
const PREFIX = /^[a-z][a-z0-9]{1,5}$/;

export const KATEGORI = ["wedding", "corporate", "family"];
export const TIER = ["standard", "premium", "signature"];

export function slugSah(slug) {
  return typeof slug === "string" && slug.length <= 32 && SLUG.test(slug);
}

export function prefixSah(prefix) {
  return typeof prefix === "string" && PREFIX.test(prefix);
}

/** `eternal-rose` → `eternalRose` (nama ekspor options & demo). */
export function camel(slug) {
  return slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** `eternal-rose` → `EternalRose` (nama komponen). */
export function pascal(slug) {
  const c = camel(slug);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** `eternal-rose` → `Eternal Rose` (nama tampil bawaan di katalog). */
export function namaTampil(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Prefix bawaan: inisial tiap kata, atau 3 huruf pertama bila satu kata. */
export function prefixBawaan(slug) {
  const kata = slug.split("-");
  const p = kata.length > 1 ? kata.map((w) => w[0]).join("") : slug.slice(0, 3);
  return p.slice(0, 6);
}

/**
 * Sisipkan satu baris ke dalam objek/registry TypeScript tepat sebelum
 * penutupnya. IDEMPOTEN: bila `penanda` sudah ada, berkasnya dikembalikan apa
 * adanya — menjalankan ulang scaffold tak pernah menggandakan baris.
 *
 * Melempar bila jangkarnya tak ditemukan: lebih baik berhenti daripada menulis
 * berkas registry yang rusak dan baru ketahuan saat build.
 */
export function sisipkanBaris(sumber, { penanda, baris, penutup }) {
  if (sumber.includes(penanda)) return sumber;
  const i = sumber.lastIndexOf(penutup);
  if (i === -1) {
    throw new Error(`Jangkar ${JSON.stringify(penutup)} tak ditemukan.`);
  }
  return sumber.slice(0, i) + baris + sumber.slice(i);
}

/** Sisipkan satu baris `import` setelah blok impor terakhir yang cocok. */
export function sisipkanImpor(sumber, { penanda, baris, setelah }) {
  if (sumber.includes(penanda)) return sumber;
  const i = sumber.lastIndexOf(setelah);
  if (i === -1) throw new Error(`Jangkar impor tak ditemukan: ${setelah}`);
  const akhir = sumber.indexOf("\n", i) + 1;
  return sumber.slice(0, akhir) + baris + sumber.slice(akhir);
}

// --- Template berkas tema ----------------------------------------------------

export function tOptions({ slug, prefix }) {
  const c = camel(slug);
  return `import type { ThemeOptions } from "@/lib/customizer/theme-options";

/**
 * Kontrak kustomisasi tema \`${slug}\` (CUSTOMIZER-SPEC §3, THEME-CONTRACT).
 * Dihasilkan \`pnpm theme:new\` — sudah memenuhi kontrak; yang perlu diganti
 * adalah PILIHANNYA (varian warna, pasangan font, section, rasio wadah foto),
 * bukan bentuknya.
 */
export const ${c}Options: ThemeOptions = {
  variants: [
    {
      id: "bawaan",
      name: "Bawaan",
      acc: "#8a6a4f",
      paper: "#faf7f2",
      ink: "#231f1c",
    },
  ],
  fontPairs: [
    {
      id: "a",
      name: "Bawaan",
      dispVar: "var(--${prefix}-disp)",
      bodyVar: "var(--${prefix}-body)",
    },
  ],
  // \`hero\` & \`rsvp\` WAJIB ada dan tak boleh disembunyikan (THEME-CONTRACT §1).
  // Buang section yang tema ini memang tak punya; jangan ganti namanya.
  sections: [
    { id: "hero", reorder: false, toggle: false },
    { id: "couple", reorder: true, toggle: true },
    { id: "countdown", reorder: true, toggle: true },
    { id: "schedule", reorder: true, toggle: true },
    { id: "gallery", reorder: true, toggle: true },
    { id: "story", reorder: true, toggle: true },
    { id: "envelope", reorder: true, toggle: true },
    { id: "rsvp", reorder: true, toggle: false },
  ],
  styles: {},
  supports: { customAccent: false, motion: true, grain: false },
  // Rasio = lebar/tinggi WADAH foto di CSS tema ini. Samakan dengan CSS-nya;
  // bingkai penyesuaian di editor mengikuti angka ini.
  media: {
    slots: [
      { id: "groom", aspect: 4 / 5 },
      { id: "bride", aspect: 4 / 5 },
    ],
  },
  preview: {
    root: "${prefix}",
    vars: [
      { name: "--${prefix}-acc", token: "accent" },
      { name: "--${prefix}-acc-text", token: "accentText" },
      { name: "--${prefix}-on-acc", token: "onAccent" },
      { name: "--${prefix}-paper", token: "paper" },
      { name: "--${prefix}-ink", token: "ink" },
      { name: "--${prefix}-disp", token: "disp" },
      { name: "--${prefix}-body", token: "body" },
    ],
  },
};
`;
}

export function tLabels({ slug }) {
  return `/** Teks tetap tema \`${slug}\` — terpusat supaya tak tercecer di JSX. */
export const L = {
  couple: {
    eyebrow: "Mempelai",
    groom: "Mempelai Pria",
    bride: "Mempelai Wanita",
    parents: (ayah?: string, ibu?: string) =>
      ayah && ibu ? \`Putra/i dari \${ayah} & \${ibu}\` : "",
  },
  countdown: {
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
    done: "Hari bahagia telah tiba",
  },
  schedule: { eyebrow: "Acara" },
  gallery: { eyebrow: "Galeri" },
  story: { eyebrow: "Kisah" },
  envelope: { eyebrow: "Amplop" },
  rsvp: { eyebrow: "Ucapan & Konfirmasi" },
  cover: { open: "Buka Undangan" },
} as const;
`;
}

export function tCss({ slug, prefix }) {
  return `/* Tema ${slug} — kerangka dari \`pnpm theme:new\`.
   CSS ini SUMBER KEBENARAN; \`scripts/build-theme-css.mjs\` menyalinnya ke
   \`public/themes/${slug}.{hash}.css\`. JANGAN di-import dari index.tsx
   (DECISIONS #31) — ia dikirim lewat <ThemeStyles slug="${slug}" />.

   Art direction tema ini dimulai di sini. */

.${prefix} {
  --${prefix}-acc: #8a6a4f;
  --${prefix}-acc-text: #6b5038;
  --${prefix}-on-acc: #ffffff;
  --${prefix}-paper: #faf7f2;
  --${prefix}-ink: #231f1c;
  --${prefix}-disp: ui-serif, Georgia, serif;
  --${prefix}-body: ui-sans-serif, system-ui, sans-serif;

  background: var(--${prefix}-paper);
  color: var(--${prefix}-ink);
  font-family: var(--${prefix}-body);
}

.${prefix}-stage {
  max-width: 480px;
  margin: 0 auto;
}

.${prefix}-section {
  padding: 48px 20px;
}

.${prefix}-eyebrow {
  font-family: var(--${prefix}-disp);
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--${prefix}-acc-text);
  text-align: center;
}

.${prefix}-title {
  font-family: var(--${prefix}-disp);
  font-size: 34px;
  line-height: 1.15;
  text-align: center;
  margin: 8px 0 0;
}

.${prefix}-foto {
  width: min(62%, 240px);
  aspect-ratio: 4 / 5;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 12px;
  background: color-mix(in srgb, var(--${prefix}-acc) 18%, transparent);
  display: grid;
  place-items: center;
}

.${prefix}-foto span {
  font-family: var(--${prefix}-disp);
  font-size: 56px;
  color: var(--${prefix}-acc-text);
}

/* Hormati prefers-reduced-motion: konten tetap lengkap tanpa animasi. */
@media (prefers-reduced-motion: reduce) {
  .${prefix} * {
    animation: none !important;
    transition: none !important;
  }
}
`;
}
