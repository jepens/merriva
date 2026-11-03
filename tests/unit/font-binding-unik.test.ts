import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Setiap binding `localFont` wajib bernama unik di seluruh `src/`.
 *
 * KENAPA TEST INI ADA: `next/font/local` memakai NAMA BINDING sebagai
 * `font-family` (loader Next: `['font-family', variableName]`), dan build
 * Turbopack tidak memberinya hash. Halaman /[slug] memuat @font-face SEMUA tema,
 * jadi dua tema yang sama-sama menamai fontnya `dispA` bertabrakan: untuk
 * deskriptor yang sama peramban memakai face TERAKHIR, dan undangan tampil
 * dengan huruf tema lain. Itu terjadi sungguhan sejak 4 Okt 2026
 * (DECISIONS #107). Tak ada galat dan semua font berstatus `loaded`, jadi
 * satu-satunya penjaga yang murah adalah melarang nama ganda di sumbernya.
 *
 * Nama keluarga font dicocokkan CSS tanpa peduli huruf besar-kecil, jadi
 * `erDispA` dan `erdispa` juga dihitung sama. Pindaiannya mencari `localFont(`
 * secara harfiah, jadi impor beralias ikut dilarang di bawah.
 */

const SRC = join(process.cwd(), "src");
const DEKLARASI = /\bconst\s+(\w+)\s*=\s*localFont\(/g;
const IMPOR = /\bimport\s+(\w+)\s+from\s+["']next\/font\/local["']/g;

function berkasSumber(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return berkasSumber(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

const temuan = new Map<string, string[]>();
const impor: string[] = [];
for (const file of berkasSumber(SRC)) {
  const isi = readFileSync(file, "utf8");
  for (const m of isi.matchAll(IMPOR))
    impor.push(`${relative(SRC, file)}: ${m[1]}`);
  for (const m of isi.matchAll(DEKLARASI)) {
    const kunci = m[1].toLowerCase();
    temuan.set(kunci, [
      ...(temuan.get(kunci) ?? []),
      `${relative(SRC, file)}: ${m[1]}`,
    ]);
  }
}

describe("nama binding next/font", () => {
  it("memindai font tema dan marketing (folder salah = test tak menguji apa pun)", () => {
    expect(temuan.size).toBeGreaterThanOrEqual(50);
    expect(temuan.has("erdispa")).toBe(true);
    expect(temuan.has("mrvdisplay")).toBe(true);
  });

  it("tak ada nama yang dipakai dua kali", () => {
    const ganda = [...temuan.values()].filter((daftar) => daftar.length > 1);
    expect(ganda).toEqual([]);
  });

  it("next/font/local selalu diimpor sebagai `localFont` — alias lolos dari pindaian", () => {
    expect(impor.length).toBeGreaterThanOrEqual(15);
    expect(impor.filter((i) => !i.endsWith(": localFont"))).toEqual([]);
  });
});
