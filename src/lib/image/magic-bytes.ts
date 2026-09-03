/**
 * Sniff format gambar dari MAGIC BYTES header — MURNI (server & klien). Dipakai
 * server sebagai defense-in-depth: `Blob.type`/nama file dapat dipalsukan klien,
 * jadi sebelum menyimpan objek kita verifikasi byte awal cocok dengan format yang
 * dideklarasikan. HANYA webp & jpeg yang sah (PNG/GIF/SVG/lainnya ditolak —
 * selaras enum `momenUploadMetaSchema.format`). Tidak men-decode gambar (tetap
 * "pemrosesan gambar hanya di browser" — ini hanya cek header byte).
 */

export type SniffedImageFormat = "webp" | "jpeg" | null;

function u8(buf: ArrayBuffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

/**
 * Kembalikan format terdeteksi dari header, atau null bila bukan webp/jpeg.
 * JPEG: `FF D8 FF`. WebP: `RIFF....WEBP` (byte 0–3 = "RIFF", 8–11 = "WEBP").
 */
export function sniffImageFormat(
  buf: ArrayBuffer | Uint8Array,
): SniffedImageFormat {
  const b = u8(buf);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "jpeg";
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && // R
    b[1] === 0x49 && // I
    b[2] === 0x46 && // F
    b[3] === 0x46 && // F
    b[8] === 0x57 && // W
    b[9] === 0x45 && // E
    b[10] === 0x42 && // B
    b[11] === 0x50 // P
  ) {
    return "webp";
  }
  return null;
}

/** True bila byte header cocok dengan format yang dideklarasikan klien. */
export function matchesDeclaredFormat(
  buf: ArrayBuffer | Uint8Array,
  format: "webp" | "jpeg",
): boolean {
  return sniffImageFormat(buf) === format;
}
