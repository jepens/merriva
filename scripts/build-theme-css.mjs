#!/usr/bin/env node
/**
 * Keluarkan CSS tema dari graph modul JS → aset statis ber-hash isi.
 *
 * KENAPA ADA (AUDIT-2026-09-04 PER-2/PER-5): selama CSS tema di-`import` dari
 * `src/themes/{slug}/index.tsx`, Next MENGUMPULKAN seluruh CSS yang terjangkau
 * dari graph modul halaman ke `entryCSSFiles["…/[slug]/page"]` dan meng-emit
 * <link> untuk SEMUANYA. Jadi setiap undangan mengunduh stylesheet KESEPULUH
 * tema (13 berkas / 57,2 KB gz) padahal hanya memakai satu (~3-5,5 KB gz).
 *
 * Ini BATAS FRAMEWORK, bukan kesalahan pemakaian: dokumentasi Next menyatakan
 * dynamic import sebuah Server Component hanya me-lazy-load Client Component
 * ANAK-nya, dan `getLinkAndScriptTags` memang berkunci pada path entry halaman.
 * Satu-satunya jalan keluar adalah tidak melewatkan CSS tema lewat graph modul.
 *
 * Skrip ini menyalin `src/themes/{slug}/*.css` (SUMBER KEBENARAN, tidak pindah)
 * ke `public/themes/{slug}.{hash}.css` dan menulis manifest TypeScript yang
 * dipakai `<ThemeStyles>` untuk mengemit <link> HANYA bagi tema yang dipakai.
 * Nama berkas ber-hash isi → aman di-cache `immutable` (lihat next.config.ts).
 *
 * Dijalankan otomatis oleh `pnpm dev` dan `pnpm build`.
 */

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const THEMES_DIR = join("src", "themes");
const OUT_DIR = join("public", "themes");
const MANIFEST = join(THEMES_DIR, "theme-css.generated.ts");

/** Folder tema = folder di `src/themes/` yang bukan diawali `_`. */
function themeSlugs() {
  return readdirSync(THEMES_DIR)
    .filter((name) => !name.startsWith("_"))
    .filter((name) => statSync(join(THEMES_DIR, name)).isDirectory())
    .sort();
}

/** Satu berkas CSS di akar folder tema (konvensi; lihat THEME-PORTING §2). */
function themeCssFile(slug) {
  const files = readdirSync(join(THEMES_DIR, slug)).filter((f) =>
    f.endsWith(".css"),
  );
  if (files.length === 0) return null;
  if (files.length > 1) {
    throw new Error(
      `Tema "${slug}" punya ${files.length} berkas CSS di akar folder ` +
        `(${files.join(", ")}). Konvensi: tepat satu — gabungkan, atau impor ` +
        `berkas tambahan dari komponen bersama di src/themes/_shared/.`,
    );
  }
  return files[0];
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const entries = [];
for (const slug of themeSlugs()) {
  const cssFile = themeCssFile(slug);
  if (!cssFile) continue;
  const buf = readFileSync(join(THEMES_DIR, slug, cssFile));
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 10);
  const outName = `${slug}.${hash}.css`;
  writeFileSync(join(OUT_DIR, outName), buf);
  entries.push({ slug, href: `/themes/${outName}`, bytes: buf.length });
}

const lines = [
  "// DIHASILKAN OTOMATIS oleh `scripts/build-theme-css.mjs` — JANGAN diedit tangan.",
  "// Sumber kebenaran CSS tetap `src/themes/{slug}/*.css`; berkas ini hanya",
  "// memetakan slug tema → aset statis ber-hash isi di `public/themes/`.",
  "// Lihat docs/DECISIONS.md #31 dan docs/THEME-PORTING.md §2.",
  "",
  "export const themeCssHrefs: Record<string, string> = {",
  ...entries.map(
    (e) => `  ${JSON.stringify(e.slug)}: ${JSON.stringify(e.href)},`,
  ),
  "};",
  "",
];
writeFileSync(MANIFEST, lines.join("\n"), "utf8");

const total = entries.reduce((n, e) => n + e.bytes, 0);
console.log(
  `theme-css: ${entries.length} tema → public/themes/ (${(total / 1024).toFixed(1)} KB mentah)`,
);
