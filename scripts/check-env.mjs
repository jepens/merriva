#!/usr/bin/env node
/**
 * Validator environment variable — SATU perintah, SATU daftar.
 *
 *   pnpm env:check              # periksa berkas dev (.env.local)
 *   pnpm env:check --prod       # periksa berkas produksi (.env.production.local)
 *   pnpm env:check --file X     # periksa berkas lain
 *
 * Ada karena nilai env tersebar di `.env`, `.env.local`, tabel lampiran
 * LAUNCH-CHECKLIST, dan panel Easypanel — dan "ada yang terlewat" adalah
 * kegagalan yang paling sering SENYAP di produk ini: NEXT_PUBLIC_APP_URL yang
 * kosong tak menimbulkan galat apa pun tetapi mematikan lima fitur sekaligus.
 *
 * Manifest + pemindai ada di `env-manifest.mjs` agar bisa diuji; properti
 * anti-drift-nya dijaga `tests/unit/env-manifest.test.ts`, bukan ingatan.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { BAWAAN_RUNTIME, MANIFEST, envDipakaiKode } from "./env-manifest.mjs";

const ROOT = process.cwd();

function bacaEnv(path) {
  const out = new Map();
  let raw;
  try {
    raw = readFileSync(join(ROOT, path), "utf8");
  } catch {
    return null;
  }
  for (const ln of raw.split("\n")) {
    const t = ln.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out.set(t.slice(0, i).trim(), t.slice(i + 1).trim());
  }
  return out;
}

const argv = process.argv.slice(2);
const prod = argv.includes("--prod");
const iFile = argv.indexOf("--file");
const target =
  iFile >= 0 && argv[iFile + 1]
    ? argv[iFile + 1]
    : prod
      ? ".env.production.local"
      : ".env.local";

const env = bacaEnv(target);
console.log(`\nenv:check — ${prod ? "PRODUKSI" : "DEV"} · berkas: ${target}\n`);

if (!env) {
  console.log(`  BERKAS TIDAK ADA: ${target}`);
  console.log(`  Buat dari daftar induk:  cp .env.example ${target}\n`);
  process.exit(1);
}

const wajib = (m) =>
  m.kapan === "always" ||
  (prod && m.kapan === "prod") ||
  (m.kapan === "r2" && (env.get("STORAGE_DRIVER") ?? "") === "r2");

const kurang = [];
let terisi = 0;
for (const m of MANIFEST) {
  if (env.get(m.key)) {
    terisi += 1;
    continue;
  }
  if (wajib(m)) kurang.push(m);
}

if (kurang.length === 0) {
  console.log(
    `  LENGKAP — ${terisi} variabel terisi, tak ada yang wajib terlewat.`,
  );
} else {
  console.log(`  ${kurang.length} WAJIB BELUM TERISI:\n`);
  for (const m of kurang) {
    console.log(`  ${m.buildArg ? "[BUILD-ARG]" : "[runtime]  "} ${m.key}`);
    if (m.gen) console.log(`      buat dengan: ${m.gen}`);
    if (m.rusak) console.log(`      bila kosong: ${m.rusak}`);
    console.log("");
  }
}

// Build-arg: pengingat yang paling sering menggigit.
const ba = MANIFEST.filter((m) => m.buildArg);
console.log(
  `  ${ba.length} variabel di bawah WAJIB juga diteruskan sebagai --build-arg`,
);
console.log(
  `  (Next meng-inline nilainya saat build; .dockerignore membuang .env*):`,
);
for (const m of ba) console.log(`      ${env.get(m.key) ? "v" : "-"} ${m.key}`);

// Fallback lintas-berkas — jebakan paling halus di setup ini. Next memuat `.env`
// sebagai lapis TERENDAH, termasuk saat `pnpm dev`, jadi variabel yang tak ada di
// `.env.local` diam-diam diambil dari sana.
if (!prod && target === ".env.local") {
  const dasar = bacaEnv(".env");
  if (dasar) {
    const warisan = MANIFEST.filter((m) => !env.get(m.key) && dasar.get(m.key));
    if (warisan.length) {
      console.log(
        `\n  ${warisan.length} variabel TIDAK ada di ${target} → diambil dari .env:`,
      );
      for (const m of warisan) console.log(`      ${m.key}`);
    }
    const a = env.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
    const b = dasar.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
    const lokal = (u) => /127\.0\.0\.1|localhost/.test(u);
    if (a && b && a !== b) {
      console.log(
        `\n  PERINGATAN: .env.local dan .env menunjuk project Supabase BERBEDA.`,
      );
      console.log(`      .env.local → ${lokal(a) ? "stack LOKAL" : "cloud"}`);
      console.log(
        `      .env       → ${lokal(b) ? "stack LOKAL" : "cloud (kemungkinan PRODUKSI)"}`,
      );
      console.log(
        `      Bila .env.local hilang/salah nama, \`pnpm dev\` jatuh ke .env dan`,
      );
      console.log(`      menulis ke data di sana. Pindahkan nilai produksi ke`);
      console.log(
        `      .env.production.local (hanya dimuat saat NODE_ENV=production).`,
      );
    }
  }
}

// Anti-drift: variabel baru di kode yang belum didaftarkan.
const dipakai = envDipakaiKode({ readFileSync, readdirSync, statSync, join });
const didaftar = new Set(MANIFEST.map((m) => m.key));
const liar = [...dipakai].filter(
  (k) => !didaftar.has(k) && !BAWAAN_RUNTIME.has(k),
);
if (liar.length) {
  console.log(`\n  DRIFT — dibaca kode tetapi TIDAK ada di manifest:`);
  for (const k of liar) console.log(`      ${k}`);
  console.log(
    `  Tambahkan ke MANIFEST di scripts/env-manifest.mjs beserta akibat kosongnya.`,
  );
}

console.log("");
process.exit(kurang.length > 0 || liar.length > 0 ? 1 : 0);
