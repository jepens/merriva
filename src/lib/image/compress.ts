import { MEDIA_VARIANTS } from "@/lib/media";

import { encodeCanvas } from "./encode";

/**
 * Kompresi foto di BROWSER klien (SPEC §4.4 / boundary CLAUDE.md): server tidak
 * pernah memproses gambar galeri. Satu file → 2 varian (display 1600px, thumb
 * 400px), **WebP atau JPEG** (fallback wajib Safari/iOS — lihat `encode.ts`).
 * Memakai Canvas bawaan (tanpa dependency) agar bundel dashboard tetap ramping.
 * EXIF orientation dihormati lewat `createImageBitmap`.
 */

export interface CompressedPhoto {
  display: Blob;
  thumb: Blob;
  /** Dimensi varian display (px) untuk rasio aspek di UI/tema. */
  width: number;
  height: number;
}

// HEIC/HEIF sengaja TIDAK diterima: `createImageBitmap` tak bisa mendekodenya di
// Chromium (WebView WhatsApp Android) → hanya menghasilkan error menyesatkan.
// iOS umumnya sudah mengonversi HEIC→JPEG saat memilih via <input>. Selaras
// dengan copy (JPG/PNG/WebP) → berkas tak didukung memicu pesan yang akurat.
const ACCEPTED = /^image\/(jpeg|png|webp)$/i;

/** True bila file bertipe gambar yang dapat dikompres di browser. */
export function isSupportedImage(file: File): boolean {
  return Boolean(file.type) && ACCEPTED.test(file.type);
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // `imageOrientation: 'from-image'` menghormati EXIF (foto potret dari HP);
  // fallback bila opsi tak didukung (Safari lama).
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

function scaledSize(
  w: number,
  h: number,
  maxW: number,
): { w: number; h: number } {
  if (w <= maxW) return { w, h };
  return { w: maxW, h: Math.max(1, Math.round((h * maxW) / w)) };
}

async function encodeVariant(
  bitmap: ImageBitmap,
  maxW: number,
  quality: number,
): Promise<{ blob: Blob; w: number; h: number }> {
  const { w, h } = scaledSize(bitmap.width, bitmap.height, maxW);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  // WebP → fallback JPEG q0.82 bila Safari/iOS tak dukung toBlob webp.
  const { blob } = await encodeCanvas(canvas, quality);
  return { blob, w, h };
}

/**
 * Kompres 1 file gambar → 2 varian (display 1600px + thumb 400px). Format tiap
 * varian WebP, atau JPEG bila WebP tak didukung (iOS) — server membaca
 * `blob.type` sebagai content-type. Nama diekspor tetap `compressToWebpVariants`
 * untuk kompatibilitas pemanggil galeri.
 */
export async function compressToWebpVariants(
  file: File,
): Promise<CompressedPhoto> {
  const bitmap = await loadBitmap(file);
  try {
    const display = await encodeVariant(
      bitmap,
      MEDIA_VARIANTS.display.maxWidth,
      MEDIA_VARIANTS.display.quality,
    );
    const thumb = await encodeVariant(
      bitmap,
      MEDIA_VARIANTS.thumb.maxWidth,
      MEDIA_VARIANTS.thumb.quality,
    );
    return {
      display: display.blob,
      thumb: thumb.blob,
      width: display.w,
      height: display.h,
    };
  } finally {
    bitmap.close();
  }
}
