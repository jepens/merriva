/**
 * Encode `<canvas>` → Blob dengan FALLBACK JPEG WAJIB untuk Safari/iOS.
 *
 * `canvas.toBlob('image/webp')` TIDAK didukung Safari/iOS (caniuse, verif. 26 Agu
 * 2026) — fallback diam-diam browser adalah PNG lossless RAKSASA (tanpa kompresi
 * lossy). Kontrak klien: coba WebP → cek `blob.type` → bila BUKAN `image/webp`,
 * encode ulang `image/jpeg` q0.82. Dipakai galeri undangan (`compress.ts`) DAN
 * Album Momen; server menolak selain webp/jpeg. Pemrosesan gambar HANYA di
 * browser klien (boundary CLAUDE.md) — util ini murni klien (Canvas).
 */

export type EncodedFormat = "webp" | "jpeg";

export const ENCODE_MIME: Record<EncodedFormat, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
};

export const ENCODE_EXT: Record<EncodedFormat, string> = {
  webp: "webp",
  jpeg: "jpg",
};

/** Kualitas encode JPEG saat fallback (Safari/iOS). */
export const JPEG_FALLBACK_QUALITY = 0.82;

/**
 * True bila hasil `toBlob('image/webp')` benar-benar WebP — bukan PNG yang
 * diam-diam dikembalikan iOS. Dasar keputusan fallback.
 */
export function isWebpBlob(type: string | undefined | null): boolean {
  return type === ENCODE_MIME.webp;
}

/** Content-type storage untuk format terdeklarasi (dipakai server: momen). */
export function mimeForFormat(format: EncodedFormat): string {
  return ENCODE_MIME[format];
}

/** Ekstensi berkas untuk format terdeklarasi (dipakai penamaan path). */
export function extForFormat(format: EncodedFormat): string {
  return ENCODE_EXT[format];
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Encode canvas → WebP; fallback JPEG q0.82 bila WebP tak didukung (iOS Safari
 * mengembalikan PNG untuk toBlob webp). Return blob + `format` AKTUAL agar
 * pemanggil menamai berkas & menetapkan content-type sesuai kenyataan (bukan
 * asumsi webp). Melempar bila kedua encode gagal.
 */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  webpQuality: number,
): Promise<{ blob: Blob; format: EncodedFormat }> {
  const webp = await canvasToBlob(canvas, ENCODE_MIME.webp, webpQuality);
  if (webp && isWebpBlob(webp.type)) return { blob: webp, format: "webp" };

  const jpeg = await canvasToBlob(
    canvas,
    ENCODE_MIME.jpeg,
    JPEG_FALLBACK_QUALITY,
  );
  if (jpeg) return { blob: jpeg, format: "jpeg" };

  throw new Error("Gagal meng-encode gambar (WebP & JPEG keduanya gagal).");
}
