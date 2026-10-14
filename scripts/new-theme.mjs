// @ts-nocheck
/**
 * `pnpm theme:new <slug>` — rangka tema baru yang SUDAH memenuhi kontrak
 * (THEME-CONTRACT §4).
 *
 *   pnpm theme:new senja
 *   pnpm theme:new kembang-api --name "Kembang Api" --kategori wedding \
 *                              --tier premium --prefix ka
 *
 * Menambah tema menyentuh ENAM tempat di luar folder temanya: empat registry,
 * satu migrasi seed, dan `pnpm thumbs`. Yang terlewat tak menimbulkan galat —
 * ia hanya membuat tema tak muncul di katalog, atau muncul tetapi gagal
 * dirender. Skrip ini mengurus kelimanya yang bisa diotomatiskan dan
 * MENGINGATKAN yang keenam.
 *
 * Idempoten: menjalankan ulang pada slug yang sudah terdaftar tak menggandakan
 * baris registry. Folder yang sudah ada TIDAK ditimpa — ia berhenti.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  KATEGORI,
  TIER,
  camel,
  namaTampil,
  pascal,
  prefixBawaan,
  prefixSah,
  sisipkanBaris,
  sisipkanImpor,
  slugSah,
  tCss,
  tLabels,
  tOptions,
} from "./theme-scaffold.mjs";
import { tCover, tDemo, tIndex, tSeed, tSections } from "./theme-templates.mjs";

const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith("--"));

function opsi(nama, bawaan) {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
}

function mati(pesan) {
  console.error(`\n  ${pesan}\n`);
  process.exit(1);
}

if (!slug) {
  mati(
    "Pemakaian: pnpm theme:new <slug> [--name N] [--kategori wedding] " +
      "[--tier standard] [--prefix xx]",
  );
}
if (!slugSah(slug)) {
  mati(
    `Slug "${slug}" tidak sah. Huruf kecil, angka, dan tanda hubung; ` +
      `mulai dengan huruf (mis. \`eternal-rose\`).`,
  );
}

const nama = opsi("name", namaTampil(slug));
const kategori = opsi("kategori", "wedding");
const tier = opsi("tier", "standard");
const prefix = opsi("prefix", prefixBawaan(slug));

if (!KATEGORI.includes(kategori)) {
  mati(`Kategori "${kategori}" tak dikenal. Pilih: ${KATEGORI.join(", ")}.`);
}
if (!TIER.includes(tier)) {
  mati(`Tier "${tier}" tak dikenal. Pilih: ${TIER.join(", ")}.`);
}
if (!prefixSah(prefix)) {
  mati(`Prefix CSS "${prefix}" tidak sah: 2–6 huruf kecil/angka.`);
}

const DIR = join("src", "themes", slug);
if (existsSync(DIR)) {
  mati(`Folder ${DIR} sudah ada. Hapus dulu, atau pilih slug lain.`);
}

const c = camel(slug);
const P = pascal(slug);

// --- berkas tema -------------------------------------------------------------
mkdirSync(DIR, { recursive: true });
const berkas = {
  "options.ts": tOptions({ slug, prefix }),
  "labels.ts": tLabels({ slug }),
  "sections.tsx": tSections({ slug, prefix }),
  "cover.tsx": tCover({ slug, prefix }),
  "index.tsx": tIndex({ slug, prefix }),
  "demo-data.ts": tDemo({ slug }),
  [`${slug}.css`]: tCss({ slug, prefix }),
};
for (const [n, isi] of Object.entries(berkas)) {
  writeFileSync(join(DIR, n), isi, "utf8");
}

// --- registry ----------------------------------------------------------------
function sunting(path, ubah) {
  const asli = readFileSync(path, "utf8");
  const baru = ubah(asli);
  if (baru !== asli) writeFileSync(path, baru, "utf8");
  return baru !== asli;
}

const T = join("src", "themes");

sunting(join(T, "registry.ts"), (s) =>
  sisipkanBaris(s, {
    penanda: `"${slug}":`,
    baris: `  "${slug}": () => import("./${slug}"),\n`,
    penutup: "};",
  }),
);

sunting(join(T, "demo-data-registry.ts"), (s) =>
  sisipkanBaris(s, {
    penanda: `"${slug}":`,
    baris: `  "${slug}": () => import("./${slug}/demo-data"),\n`,
    penutup: "};",
  }),
);

sunting(join(T, "theme-options-registry.ts"), (s) => {
  const denganImpor = sisipkanImpor(s, {
    penanda: `from "./${slug}/options"`,
    baris: `import { ${c}Options } from "./${slug}/options";\n`,
    setelah: 'from "./verdant/options";',
  });
  return sisipkanBaris(denganImpor, {
    penanda: `"${slug}":`,
    baris: `  "${slug}": ${c}Options,\n`,
    penutup: "};",
  });
});

sunting(join(T, "catalog-meta.ts"), (s) =>
  sisipkanBaris(s, {
    penanda: `"${slug}":`,
    baris:
      `  "${slug}": {\n` +
      `    bg: "#faf7f2",\n` +
      `    ink: "#231f1c",\n` +
      `    accent: "#8a6a4f",\n` +
      `    line: "rgba(35,31,28,0.14)",\n` +
      `    ornament: "\\u25c6",\n` +
      `  },\n`,
    penutup: "};",
  }),
);

// --- migrasi seed ------------------------------------------------------------
// Stempel waktu UTC gaya Supabase; `is_active` sengaja FALSE di templatenya.
const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const migrasi = join(
  "supabase",
  "migrations",
  `${ts}_seed_${slug.replace(/-/g, "_")}_theme.sql`,
);
writeFileSync(
  migrasi,
  tSeed({ slug, nama, kategori, tier, urutan: 100 }),
  "utf8",
);

// --- laporan -----------------------------------------------------------------
console.log(`
  Tema "${slug}" (${P}Theme) dibuat.

    ${DIR}/            7 berkas
    ${migrasi}

  Terdaftar di: registry, theme-options-registry, demo-data-registry,
  catalog-meta.

  Berikutnya:
    1. pnpm lint && pnpm typecheck && pnpm test   (konformansi harus hijau)
    2. art direction: ${DIR}/${slug}.css + sections.tsx
    3. demo-data.ts  — tampilkan kekuatan temanya (THEME-PORTING §5)
    4. pnpm thumbs   — poster katalog
    5. supabase db push, lalu set is_active = true setelah DoD selesai
`);
