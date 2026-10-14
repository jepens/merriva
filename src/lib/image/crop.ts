/**
 * Geometri pemangkasan foto — MURNI, tanpa DOM (DECISIONS #84).
 *
 * Keadaannya sengaja disimpan sebagai `zoom` + titik tengah ternormalisasi
 * (0..1), bukan sebagai kotak piksel. Alasannya: titik tengah tetap berarti
 * sama ketika zoom berubah, jadi memperbesar tidak menggeser wajah keluar
 * bingkai — kesalahan paling umum pada pemangkas buatan sendiri.
 */

/** Kotak sumber yang akan digambar ke kanvas keluaran. */
export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Perbesaran maksimum. Lebih dari ini, varian display jatuh di bawah lebar
 * wadah tema pada layar 3x dan fotonya terlihat pecah. */
export const MAX_ZOOM = 4;

function jepit(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Kotak pangkas untuk `zoom` dan titik tengah tertentu.
 *
 * `zoom = 1` berarti kotak TERBESAR dengan rasio `aspect` yang masih muat utuh
 * di dalam gambar — setara `object-fit: cover` pada bingkai. Titik tengah
 * dijepit agar kotaknya tak pernah keluar dari gambar, sehingga bingkai selalu
 * terisi penuh dan tak pernah muncul pita kosong.
 *
 * @param aspect lebar / tinggi bingkai (0,8 = 4:5 potret)
 */
export function cropFrom(
  bw: number,
  bh: number,
  aspect: number,
  zoom: number,
  cx: number,
  cy: number,
): CropRect {
  const z = jepit(zoom, 1, MAX_ZOOM);
  const baseW = Math.min(bw, bh * aspect);
  const baseH = baseW / aspect;
  const sw = baseW / z;
  const sh = baseH / z;
  return {
    sx: jepit(jepit(cx, 0, 1) * bw - sw / 2, 0, bw - sw),
    sy: jepit(jepit(cy, 0, 1) * bh - sh / 2, 0, bh - sh),
    sw,
    sh,
  };
}

/**
 * Titik tengah baru setelah digeser `dx`/`dy` piksel LAYAR pada bingkai selebar
 * `frameW`. Dikembalikan ternormalisasi dan belum dijepit — penjepitan terjadi
 * di `cropFrom`, satu tempat saja.
 */
export function geser(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  crop: CropRect,
  bw: number,
  bh: number,
  frameW: number,
  frameH: number,
): { cx: number; cy: number } {
  // Menyeret gambar ke kanan = kotak pangkas bergerak ke KIRI.
  return {
    cx: cx - (dx * (crop.sw / frameW)) / bw,
    cy: cy - (dy * (crop.sh / frameH)) / bh,
  };
}

/**
 * Ukuran kanvas keluaran untuk satu varian: sisi TERPANJANG dibatasi `maxLong`,
 * dan tak pernah memperbesar melebihi piksel sumber yang benar-benar dipangkas.
 * Memperbesar hanya akan menambah byte tanpa menambah detail.
 */
export function ukuranKeluaran(
  crop: CropRect,
  maxLong: number,
): { w: number; h: number } {
  const rasio = crop.sw / crop.sh;
  if (rasio >= 1) {
    const w = Math.max(1, Math.min(maxLong, Math.round(crop.sw)));
    return { w, h: Math.max(1, Math.round(w / rasio)) };
  }
  const h = Math.max(1, Math.min(maxLong, Math.round(crop.sh)));
  return { w: Math.max(1, Math.round(h * rasio)), h };
}
