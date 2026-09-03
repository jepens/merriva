import { describe, expect, it } from "vitest";

import {
  matchesDeclaredFormat,
  sniffImageFormat,
} from "@/lib/image/magic-bytes";

const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
// "RIFF" + 4 byte ukuran + "WEBP" + ...
const webpHeader = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56,
  0x50, 0x38,
]);
// PNG magic — harus DITOLAK (fallback diam-diam iOS = PNG raksasa).
const pngHeader = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("sniffImageFormat", () => {
  it("mengenali JPEG (FF D8 FF)", () => {
    expect(sniffImageFormat(jpegHeader)).toBe("jpeg");
  });
  it("mengenali WebP (RIFF....WEBP)", () => {
    expect(sniffImageFormat(webpHeader)).toBe("webp");
  });
  it("menolak PNG dan byte acak → null", () => {
    expect(sniffImageFormat(pngHeader)).toBeNull();
    expect(sniffImageFormat(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(sniffImageFormat(new Uint8Array())).toBeNull();
  });
  it("menerima ArrayBuffer maupun Uint8Array", () => {
    expect(sniffImageFormat(jpegHeader.buffer)).toBe("jpeg");
  });
  it("RIFF tanpa WEBP (mis. WAV) bukan webp", () => {
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(sniffImageFormat(wav)).toBeNull();
  });
});

describe("matchesDeclaredFormat", () => {
  it("cocok hanya bila header = format dideklarasikan", () => {
    expect(matchesDeclaredFormat(jpegHeader, "jpeg")).toBe(true);
    expect(matchesDeclaredFormat(jpegHeader, "webp")).toBe(false);
    expect(matchesDeclaredFormat(webpHeader, "webp")).toBe(true);
    expect(matchesDeclaredFormat(pngHeader, "jpeg")).toBe(false);
  });
});
