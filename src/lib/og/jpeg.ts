import { decode as decodePng } from "fast-png";
import { encode as encodeJpeg } from "jpeg-js";

/**
 * PNG keluaran `next/og` → JPEG untuk gambar pratinjau tautan (DECISIONS #119).
 *
 * `ImageResponse` (satori + resvg) HANYA bisa PNG, dan PNG berisi foto sampul
 * berukuran ~1,4 MB — di atas batas resmi WhatsApp (< 600 KB, dan komunitas
 * melaporkan < 300 KB sebagai ambang aman). JPEG gambar yang sama ±120 KB.
 * Pustakanya JS murni (tanpa binari native, tanpa WASM) supaya build standalone
 * di Docker tak bergantung pada platform; ±130 ms per render, diserap cache CDN.
 */

/** Kualitas awal: 1200×630 berfoto ±116 KB, tanpa artefak yang terlihat. */
export const OG_JPEG_QUALITY = 82;
/** Kualitas cadangan bila hasil awal masih di atas batas aman. */
export const OG_JPEG_QUALITY_FALLBACK = 65;
/** Batas aman pratinjau WhatsApp (batas resmi 600 KB; komunitas 300 KB). */
export const OG_JPEG_MAX_BYTES = 300_000;

/**
 * Konversi PNG 8-bit RGB/RGBA → JPEG. Piksel tembus pandang dikomposit ke atas
 * putih (JPEG tak punya alfa; tanpa komposit jpeg-js membuang alfanya begitu
 * saja). Melempar bila PNG di luar bentuk yang dihasilkan `next/og` — pemanggil
 * memutuskan cadangannya.
 */
export function pngToJpeg(png: Uint8Array): Uint8Array {
  const img = decodePng(png);
  if (img.depth !== 8 || (img.channels !== 3 && img.channels !== 4)) {
    throw new Error(
      `PNG tak didukung untuk JPEG: depth ${img.depth}, channels ${img.channels}`,
    );
  }

  const { width, height } = img;
  const src = img.data;
  const rgba = new Uint8Array(width * height * 4);
  const ch = img.channels;
  for (let i = 0, o = 0; i < src.length; i += ch, o += 4) {
    const a = ch === 4 ? src[i + 3] : 255;
    if (a === 255) {
      rgba[o] = src[i];
      rgba[o + 1] = src[i + 1];
      rgba[o + 2] = src[i + 2];
    } else {
      const k = a / 255;
      const putih = 255 * (1 - k);
      rgba[o] = Math.round(src[i] * k + putih);
      rgba[o + 1] = Math.round(src[i + 1] * k + putih);
      rgba[o + 2] = Math.round(src[i + 2] * k + putih);
    }
    rgba[o + 3] = 255;
  }

  let out = encodeJpeg({ data: rgba, width, height }, OG_JPEG_QUALITY).data;
  if (out.length > OG_JPEG_MAX_BYTES) {
    out = encodeJpeg(
      { data: rgba, width, height },
      OG_JPEG_QUALITY_FALLBACK,
    ).data;
  }
  return new Uint8Array(out.buffer, out.byteOffset, out.length);
}
