import { decode as decodePng, encode as encodePng } from "fast-png";
import { decode as decodeJpeg, encode as encodeJpeg } from "jpeg-js";
import { describe, expect, it } from "vitest";

import {
  OG_JPEG_MAX_BYTES,
  OG_JPEG_QUALITY,
  OG_JPEG_QUALITY_FALLBACK,
  pngToJpeg,
} from "@/lib/og/jpeg";

/**
 * PNG keluaran `next/og` → JPEG (DECISIONS #119). Pratinjau WhatsApp mensyaratkan
 * gambar < 600 KB (resmi) — PNG berfoto sampul ±1,4 MB, JPEG-nya ±120 KB. Yang
 * dijaga di sini: hasilnya JPEG sah berdimensi sama, alfa tak menjadi hitam,
 * dan gambar yang sulit dikompres turun ke kualitas cadangan.
 */

function png(
  width: number,
  height: number,
  channels: 3 | 4,
  isi: (x: number, y: number) => number[],
): Uint8Array {
  const data = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(isi(x, y), (y * width + x) * channels);
    }
  }
  return encodePng({ width, height, data, channels, depth: 8 });
}

const isJpeg = (b: Uint8Array) =>
  b[0] === 0xff && b[1] === 0xd8 && b.at(-2) === 0xff && b.at(-1) === 0xd9;

describe("pngToJpeg", () => {
  it("RGBA → JPEG sah (SOI…EOI) dengan dimensi yang sama", () => {
    const out = pngToJpeg(png(120, 63, 4, (x, y) => [x * 2, y * 4, 128, 255]));
    expect(isJpeg(out)).toBe(true);
    const back = decodeJpeg(out);
    expect([back.width, back.height]).toEqual([120, 63]);
  });

  it("RGB (3 kanal) juga didukung", () => {
    const out = pngToJpeg(png(40, 20, 3, () => [200, 100, 50]));
    expect(isJpeg(out)).toBe(true);
  });

  it("piksel tembus pandang dikomposit ke PUTIH, bukan hitam", () => {
    // Tanpa komposit, jpeg-js membuang alfa → RGB (0,0,0) tampil hitam pekat.
    const out = pngToJpeg(png(16, 16, 4, () => [0, 0, 0, 0]));
    const back = decodeJpeg(out);
    const [r, g, b] = back.data;
    expect(Math.min(r, g, b)).toBeGreaterThan(245);
  });

  it("gambar yang sulit dikompres turun ke kualitas cadangan", () => {
    // Derau acak: JPEG kualitas awal jauh di atas batas aman.
    let s = 7;
    const acak = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) & 255;
    const w = 1200;
    const h = 630;
    const sumber = png(w, h, 4, () => [acak(), acak(), acak(), 255]);

    const awal = pngToJpegQuality(sumber, OG_JPEG_QUALITY);
    expect(awal).toBeGreaterThan(OG_JPEG_MAX_BYTES);

    const out = pngToJpeg(sumber);
    expect(out.length).toBe(pngToJpegQuality(sumber, OG_JPEG_QUALITY_FALLBACK));
  });

  it("bentuk di luar keluaran next/og (16-bit) → melempar, pemanggil yang memutuskan cadangan", () => {
    const data = new Uint16Array(4 * 4 * 4).fill(65535);
    const p16 = encodePng({
      width: 4,
      height: 4,
      data,
      channels: 4,
      depth: 16,
    });
    expect(() => pngToJpeg(p16)).toThrow(/depth 16/);
  });
});

/** Ukuran JPEG dari PNG yang sama pada kualitas tertentu (pembanding). */
function pngToJpegQuality(source: Uint8Array, quality: number): number {
  // Alfa 255 → RGB apa adanya, jadi enkode langsung dari data PNG setara.
  const img = decodePng(source);
  return encodeJpeg(
    { data: img.data as Uint8Array, width: img.width, height: img.height },
    quality,
  ).data.length;
}
