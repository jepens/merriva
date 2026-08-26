import { describe, expect, it } from "vitest";

import {
  ENCODE_EXT,
  ENCODE_MIME,
  extForFormat,
  isWebpBlob,
  JPEG_FALLBACK_QUALITY,
  mimeForFormat,
} from "./encode";

/**
 * Uji logika KEPUTUSAN fallback (murni). `encodeCanvas` sendiri butuh Canvas
 * (diuji di HP nyata, DoD §8); di sini kita kunci invarian yang menentukan kapan
 * fallback JPEG dipakai dan pemetaan format→mime/ext yang dipakai server.
 */
describe("isWebpBlob — dasar keputusan fallback", () => {
  it("hanya true untuk image/webp asli", () => {
    expect(isWebpBlob("image/webp")).toBe(true);
  });

  it("false untuk PNG diam-diam iOS & tipe lain (memicu fallback JPEG)", () => {
    for (const t of [
      "image/png", // fallback senyap iOS untuk toBlob webp
      "image/jpeg",
      "image/gif",
      "",
      undefined,
      null,
    ]) {
      expect(isWebpBlob(t)).toBe(false);
    }
  });
});

describe("pemetaan format → mime/ext (server & penamaan path)", () => {
  it("webp", () => {
    expect(mimeForFormat("webp")).toBe("image/webp");
    expect(extForFormat("webp")).toBe("webp");
  });

  it("jpeg (ekstensi jpg, bukan jpeg)", () => {
    expect(mimeForFormat("jpeg")).toBe("image/jpeg");
    expect(extForFormat("jpeg")).toBe("jpg");
  });

  it("tabel konsisten & lengkap (webp+jpeg)", () => {
    expect(Object.keys(ENCODE_MIME).sort()).toEqual(["jpeg", "webp"]);
    expect(Object.keys(ENCODE_EXT).sort()).toEqual(["jpeg", "webp"]);
  });
});

describe("JPEG_FALLBACK_QUALITY", () => {
  it("0.82 sesuai kontrak (§3 MOMEN-SPEC)", () => {
    expect(JPEG_FALLBACK_QUALITY).toBe(0.82);
  });
});
