#!/usr/bin/env node
/**
 * Laporan & GERBANG anggaran bundle per-route, dibaca dari manifest resmi Next.
 *
 * KENAPA ADA: `docs/THEME-PORTING.md` §4 menetapkan anggaran gzip per tier tema
 * ("Craft +0KB dari baseline") dengan instruksi "cek `next build` output per
 * route". Sejak Next 16 + Turbopack, tabel First Load JS TIDAK LAGI dicetak,
 * sehingga anggaran itu berhenti bisa ditegakkan — dan justru itulah sebabnya
 * regresi PER-1/PER-2/PER-5 lolos tanpa ketahuan: `/[slug]` diam-diam tumbuh
 * menjadi 116 berkas font (2,03 MB) + 13 stylesheet render-blocking dari
 * KESEPULUH tema, bukan hanya tema yang dipakai (AUDIT-2026-09-04 PER-14).
 *
 * Sumber angka (bukan tebakan):
 *   - CSS & JS entry  : `.next/server/app/**​/page_client-reference-manifest.js`
 *                       (`entryCSSFiles` / `entryJSFiles` — yang benar-benar
 *                       di-emit Next sebagai <link>/<script> untuk route itu)
 *   - font di-preload : `.next/server/app/**​/next-font-manifest.json`
 *
 * Pakai: `pnpm bundle:report` (laporan) atau `pnpm bundle:report --check`
 * (keluar non-nol bila anggaran terlampaui — untuk CI).
 */

import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const NEXT_DIR = ".next";
const APP_DIR = join(NEXT_DIR, "server", "app");

/**
 * Anggaran per route (gzip, kecuali font yang dihitung mentah karena woff2
 * sudah terkompresi). `null` = dilaporkan tetapi tidak digerbangi.
 *
 * `/[slug]` adalah halaman undangan tamu — jalur LCP yang paling dijaga
 * (CLAUDE.md: "LCP < 2,5 dtk di 4G"). Angkanya ditetapkan SEDIKIT di atas
 * kondisi saat ini supaya gerbang menangkap pertumbuhan baru, bukan langsung
 * merah. Turunkan seiring perbaikan struktural (pisahkan tema dari graph modul).
 */
const BUDGETS = {
  "/[slug]/page": { cssGz: 96 * 1024, jsGz: 200 * 1024, fontBytes: 256 * 1024 },
  "/[slug]/momen/page": {
    cssGz: 32 * 1024,
    jsGz: 200 * 1024,
    fontBytes: 128 * 1024,
  },
  "/(marketing)/page": {
    cssGz: 48 * 1024,
    jsGz: 200 * 1024,
    fontBytes: 128 * 1024,
  },
};

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/** Lebar kolom route mengikuti nama terpanjang agar tabel tak meleset. */
let NAME_W = 36;

/** Ukuran mentah + gzip sebuah aset `.next/static/...`; 0 bila tak ditemukan. */
function assetSize(p) {
  const abs = join(NEXT_DIR, p.replace(/^\/+/, ""));
  if (!existsSync(abs)) return { raw: 0, gz: 0 };
  const buf = readFileSync(abs);
  return { raw: buf.length, gz: gzipSync(buf).length };
}

/** Semua berkas `page_client-reference-manifest.js` di bawah `.next/server/app`. */
function manifestFiles(dir = APP_DIR, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) manifestFiles(full, out);
    else if (name === "page_client-reference-manifest.js") out.push(full);
  }
  return out;
}

/**
 * Manifest Next berbentuk `globalThis.__RSC_MANIFEST["<route>"] = {...}`.
 * Dieksekusi di scope terbatas — tak ada I/O di dalamnya, hanya literal objek.
 */
function readRscManifest(file) {
  const src = readFileSync(file, "utf8");
  const scope = { __RSC_MANIFEST: {} };
  new Function("globalThis", src)(scope);
  return scope.__RSC_MANIFEST;
}

/**
 * Font yang benar-benar di-emit sebagai `<link rel=preload as=font>`.
 * Manifest-nya ada satu tingkat di bawah folder route: `<route>/page/`.
 */
function fontsFor(routeDir) {
  const f = join(routeDir, "page", "next-font-manifest.json");
  if (!existsSync(f)) return { count: 0, bytes: 0 };
  const m = JSON.parse(readFileSync(f, "utf8"));
  const files = Object.values(m.app ?? {}).flat();
  let bytes = 0;
  for (const p of files) bytes += assetSize(p).raw;
  return { count: files.length, bytes };
}

const rows = [];
for (const file of manifestFiles()) {
  const manifest = readRscManifest(file);
  const routeDir = file.replace(/page_client-reference-manifest\.js$/, "");
  for (const [route, data] of Object.entries(manifest)) {
    const css = Object.values(data.entryCSSFiles ?? {}).flat();
    const js = Object.values(data.entryJSFiles ?? {}).flat();

    // Satu berkas bisa muncul di beberapa entry (layout + page) → hitung sekali.
    const uniq = (list, get) => [...new Set(list.map(get))];
    let cssRaw = 0,
      cssGz = 0;
    for (const p of uniq(css, (c) => (typeof c === "string" ? c : c.path))) {
      const s = assetSize(p);
      cssRaw += s.raw;
      cssGz += s.gz;
    }
    let jsGz = 0;
    for (const p of uniq(js, (j) => (typeof j === "string" ? j : j.path))) {
      jsGz += assetSize(p).gz;
    }
    const font = fontsFor(routeDir);
    rows.push({
      route,
      cssCount: uniq(css, (c) => (typeof c === "string" ? c : c.path)).length,
      cssRaw,
      cssGz,
      jsGz,
      fontCount: font.count,
      fontBytes: font.bytes,
    });
  }
}

rows.sort((a, b) => b.cssGz + b.jsGz - (a.cssGz + a.jsGz));
NAME_W = Math.max(NAME_W, ...rows.map((r) => r.route.length)) + 2;

if (rows.length === 0) {
  console.error("Tidak ada manifest di .next — jalankan `pnpm build` dulu.");
  process.exit(1);
}

const check = process.argv.includes("--check");
const failures = [];

console.log("\nAnggaran bundle per route (sumber: manifest resmi Next)\n");
console.log(
  [
    "ROUTE".padEnd(NAME_W),
    "CSS gz".padStart(9),
    "JS gz".padStart(9),
    "FONT".padStart(14),
  ].join(""),
);
console.log("-".repeat(NAME_W + 32));

for (const r of rows) {
  const b = BUDGETS[r.route];
  const mark = (value, limit) => (limit != null && value > limit ? " !" : "  ");
  console.log(
    [
      r.route.padEnd(NAME_W),
      (kb(r.cssGz) + mark(r.cssGz, b?.cssGz)).padStart(9),
      (kb(r.jsGz) + mark(r.jsGz, b?.jsGz)).padStart(9),
      (
        `${r.fontCount}× ${kb(r.fontBytes)}` + mark(r.fontBytes, b?.fontBytes)
      ).padStart(14),
    ].join(""),
  );
  if (!b) continue;
  for (const [key, label, value] of [
    ["cssGz", "CSS gzip", r.cssGz],
    ["jsGz", "JS gzip", r.jsGz],
    ["fontBytes", "font preload", r.fontBytes],
  ]) {
    if (b[key] != null && value > b[key]) {
      failures.push(
        `${r.route} — ${label} ${kb(value)} melampaui anggaran ${kb(b[key])}`,
      );
    }
  }
}

console.log(
  "\nCSS & JS = berkas yang di-emit Next sebagai <link>/<script> untuk route itu.",
);
console.log(
  "FONT = berkas ber-<link rel=preload as=font> (mentah; woff2 sudah terkompresi).",
);
console.log(
  "Anggaran: docs/THEME-PORTING.md §4 · gerbang: scripts/bundle-report.mjs\n",
);

if (failures.length > 0) {
  console.error("ANGGARAN TERLAMPAUI:");
  for (const f of failures) console.error("  - " + f);
  console.error("");
  if (check) process.exit(1);
} else if (check) {
  console.log("Semua route dalam anggaran.\n");
}
