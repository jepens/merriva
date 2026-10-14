import { describe, expect, it } from "vitest";

import {
  isKnownSection,
  isThemeSpecificSection,
  SECTION_CANDIDATE,
  SECTION_CORE,
  SECTION_STANDARD,
  SECTION_VOCAB,
} from "@/lib/customizer/section-vocab";

/**
 * Kosakata section (THEME-CONTRACT §1). Yang dijaga di sini bukan daftar
 * katanya, melainkan RATCHET-nya: sinonim lama harus tetap ditolak selamanya.
 *
 * Sepuluh tema pertama sempat memakai `hero`, `intro`, DAN `opening` untuk hal
 * yang sama, plus `principals` untuk `couple`. Itu bukan kesalahan ketik — tiap
 * tema ditulis terpisah dan tak ada yang memeriksa. Begitu satu sinonim
 * diterima lagi, cabangnya tumbuh kembali dan `settings.custom` tak bisa ikut
 * saat pemilik berganti tema.
 */

describe("kosakata", () => {
  it("inti, standar, dan kandidat semuanya dikenali", () => {
    for (const id of [
      ...SECTION_CORE,
      ...SECTION_STANDARD,
      ...SECTION_CANDIDATE,
    ]) {
      expect(isKnownSection(id), id).toBe(true);
    }
  });

  it("tak ada id ganda antar kelompok", () => {
    const semua = [...SECTION_CORE, ...SECTION_STANDARD, ...SECTION_CANDIDATE];
    expect(new Set(semua).size).toBe(semua.length);
    expect(SECTION_VOCAB.size).toBe(semua.length);
  });

  it.each(["intro", "opening", "principals", "event", "rundown"])(
    "MENOLAK sinonim lama %j",
    (id) => {
      expect(isKnownSection(id)).toBe(false);
    },
  );

  // `ax-b`: awalan `x-` harus di DEPAN, bukan sekadar terkandung.
  it.each(["", "Hero", "HERO", "hero-section", "couple2", "x", "x-", "ax-b"])(
    "menolak %j",
    (id) => {
      expect(isKnownSection(id)).toBe(false);
    },
  );
});

describe("section khas tema", () => {
  it.each(["x-seating", "x-dresscode", "x-a"])("%j dikenali", (id) => {
    expect(isThemeSpecificSection(id)).toBe(true);
    expect(isKnownSection(id)).toBe(true);
  });

  it("`x-` telanjang bukan section khas", () => {
    // Kalau lolos, sebuah tema bisa mendaftarkan section tanpa nama sama sekali.
    expect(isThemeSpecificSection("x-")).toBe(false);
  });

  it("id kanonik bukan section khas (labelnya tetap satu di seluruh produk)", () => {
    expect(isThemeSpecificSection("hero")).toBe(false);
    expect(isThemeSpecificSection("couple")).toBe(false);
  });
});

describe("inti", () => {
  it("hanya hero & rsvp — menambah yang wajib berarti merombak semua tema", () => {
    expect([...SECTION_CORE]).toEqual(["hero", "rsvp"]);
  });
});
