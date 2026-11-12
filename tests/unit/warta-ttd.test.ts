import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Tanda tangan penutup Warta ("Wanda Sucipto & Rani Dwi Safitri") SATU baris
 * di semua lebar layar (laporan pemilik 12 Nov 2026, DECISIONS #134). Ukurannya
 * hanya terbukti di peramban (Playwright: 1 baris & di dalam kolom pada
 * 320–430 px); test ini menjaga tiga syaratnya agar tak hilang saat refaktor.
 */
const css = readFileSync(
  join(process.cwd(), "src", "themes", "warta", "warta.css"),
  "utf8",
);
const sections = readFileSync(
  join(process.cwd(), "src", "themes", "warta", "sections.tsx"),
  "utf8",
);
const blok = (selector: string) => {
  const i = css.indexOf(`${selector} {`);
  return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
};

describe("tanda tangan penutup Warta", () => {
  it("tak membungkus — pengepas mengecilkan seluruh barisnya", () => {
    expect(blok(".wt-footer__names")).toMatch(/white-space:\s*nowrap/);
  });

  it("kolom pita = lebar pita (trek auto ikut melebar oleh teks nowrap)", () => {
    expect(blok(".wt-band")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
  });

  it("kelompok pengepas sendiri, terpisah dari nama mempelai", () => {
    expect(sections).toContain(
      'className="wt-footer__names" data-wt-fit="ttd"',
    );
    expect(sections).toContain(
      'className="wt-profile__name" data-wt-fit="nama"',
    );
  });
});
