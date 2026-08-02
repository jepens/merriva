import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  hexToRgb,
  relativeLuminance,
  rgbToHex,
  safeTextColor,
  textOnAccent,
} from "./contrast-guard";

describe("contrast-guard", () => {
  it("parse & serialisasi hex", () => {
    expect(hexToRgb("#B76E79")).toEqual({ r: 183, g: 110, b: 121 });
    expect(rgbToHex({ r: 183, g: 110, b: 121 })).toBe("#b76e79");
    expect(() => hexToRgb("merah")).toThrow();
    expect(() => hexToRgb("#fff")).toThrow(); // hanya 6 digit
    expect(() => hexToRgb("#ff0000;}body{")).toThrow(); // injeksi
  });

  it("luminansi & rasio sesuai nilai acuan WCAG", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1); // simetris
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("kasus prototipe: pink pucat di kertas eternal-rose di-snap sampai AA", () => {
    // Kasus persis dari prototypes/customizer-mobile.html
    const res = safeTextColor("#e8b7c0", "#F6EFE7");
    expect(res.snapped).toBe(true);
    expect(res.ratio).toBeGreaterThanOrEqual(4.5);
    expect(res.color).not.toBe("#e8b7c0");
    // hasil tetap hex valid
    expect(res.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("warna yang sudah aman tidak diubah", () => {
    const res = safeTextColor("#0E3B30", "#F4EFE2"); // zamrud barakah di pasir
    expect(res.snapped).toBe(false);
    expect(res.color).toBe("#0e3b30");
    expect(res.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("deterministik & idempoten: snap dua kali = hasil sama", () => {
    const once = safeTextColor("#e8b7c0", "#F6EFE7");
    const twice = safeTextColor(once.color, "#F6EFE7");
    expect(twice.snapped).toBe(false);
    expect(twice.color).toBe(once.color);
  });

  it("kasus ekstrem: warna sangat terang di kertas terang tetap berakhir lolos", () => {
    const res = safeTextColor("#fefefe", "#ffffff");
    expect(res.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("textOnAccent memilih putih/ink yang lebih kontras", () => {
    expect(textOnAccent("#0E3B30", "#22312A")).toBe("#ffffff"); // aksen gelap → putih
    expect(textOnAccent("#D8FF5F", "#101018")).toBe("#101018"); // aksen lime terang → ink
  });
});
