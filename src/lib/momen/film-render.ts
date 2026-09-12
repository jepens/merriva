/**
 * Pipeline bake filter film — matematika piksel MURNI di atas Uint8ClampedArray
 * (format RGBA seperti ImageData.data). Tidak menyentuh DOM/canvas sehingga
 * teruji unit di Node; di browser dipanggil dengan `ctx.getImageData(...).data`
 * lalu `putImageData` — sengaja TANPA `ctx.filter` (Safari tidak andal).
 *
 * Urutan operasi (MOMEN-SPEC §3): white balance (temp/tint) → brightness →
 * contrast → saturasi/mono → fade (angkat hitam) → halation → vignette → grain.
 * Grain deterministik (mulberry32) supaya hasil reproducible & teruji.
 */

import type { FilmParams } from "./film-presets";

/** PRNG deterministik kecil (mulberry32) — cukup untuk grain visual. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Luma Rec.601 (0–255). */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Box blur 1 kanal (Float32Array, nilai 0..1) — dipakai untuk masker halation.
 * Dua pass (horizontal+vertikal), radius piksel bulat. Murni & teruji.
 * Mengalokasikan buffer baru; jalur panas memakai `boxBlur1Into`.
 */
export function boxBlur1(
  src: Float32Array,
  w: number,
  h: number,
  radius: number,
): Float32Array {
  const out = new Float32Array(src.length);
  boxBlur1Into(src, w, h, radius, new Float32Array(src.length), out);
  return out;
}

/**
 * Varian TANPA alokasi dari `boxBlur1`: hasil ditulis ke `out`, `tmp` dipakai
 * sebagai scratch dan isinya ditimpa penuh. `src`, `tmp`, dan `out` WAJIB tiga
 * buffer berbeda. `tmp` ditulis seluruhnya pada pass horizontal sebelum dibaca
 * pass vertikal, jadi satu buffer scratch aman dipakai ulang antar-panggilan.
 *
 * Ada karena halation dulu memanggil `boxBlur1(boxBlur1(mask))` → lima buffer
 * Float32 seukuran foto hidup bersamaan (≈38 MB pada 1600×1200, preset `senja`)
 * — berisiko crash tab di HP RAM 2 GB. Kini tiga (≈23 MB) dengan hasil
 * BYTE-IDENTIK, dikunci golden hash (AUDIT-2026-09-04 PER-6).
 */
export function boxBlur1Into(
  src: Float32Array,
  w: number,
  h: number,
  radius: number,
  tmp: Float32Array,
  out: Float32Array,
): void {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) {
    out.set(src);
    return;
  }
  const win = 2 * r + 1;
  // Horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++)
      acc += src[row + Math.min(w - 1, Math.max(0, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / win;
      const add = Math.min(w - 1, x + r + 1);
      const sub = Math.max(0, x - r);
      acc += src[row + add]! - src[row + sub]!;
    }
  }
  // Vertikal
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++)
      acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      const add = Math.min(h - 1, y + r + 1);
      const sub = Math.max(0, y - r);
      acc += tmp[add * w + x]! - tmp[sub * w + x]!;
    }
  }
}

export interface RenderOptions {
  /** Seed grain — default 1 (deterministik). Produksi boleh pakai hash id foto. */
  seed?: number;
}

/**
 * Terapkan preset film ke buffer RGBA in-place. `data.length === w*h*4`.
 * Mengembalikan buffer yang sama untuk chaining.
 */
export function applyFilmToPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: FilmParams,
  opts: RenderOptions = {},
): Uint8ClampedArray {
  if (data.length !== w * h * 4) {
    throw new Error(`ukuran buffer ${data.length} ≠ ${w}×${h}×4`);
  }
  const n = w * h;

  // --- Masker halation dihitung dari luma ASLI (sebelum grading) ---
  let glow: Float32Array | null = null;
  if (p.halation > 0) {
    const mask = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      const L = luma(data[j]!, data[j + 1]!, data[j + 2]!) / 255;
      // Hanya area sangat terang (lampu, kilau) yang memendar.
      mask[i] = L > 0.82 ? (L - 0.82) / 0.18 : 0;
    }
    const radius = Math.max(2, Math.round(Math.min(w, h) / 60));
    // Dua pass blur memakai ulang buffer: mask → blurred → mask. Tiga buffer,
    // bukan lima; hasil byte-identik dengan boxBlur1(boxBlur1(mask)).
    const scratch = new Float32Array(n);
    const blurred = new Float32Array(n);
    boxBlur1Into(mask, w, h, radius, scratch, blurred);
    boxBlur1Into(blurred, w, h, radius, scratch, mask);
    glow = mask;
  }

  // --- Grading per piksel ---
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
  const tempR = 1 + 0.16 * p.temp;
  const tempB = 1 - 0.2 * p.temp;
  const tintG = 1 - 0.12 * p.tint;
  const fadeLift = 46 * p.fade;
  const rand = mulberry32(opts.seed ?? 1);
  const grainAmp = 26 * p.grain;

  for (let i = 0; i < n; i++) {
    const j = i * 4;
    let r = data[j]!;
    let g = data[j + 1]!;
    let b = data[j + 2]!;

    // White balance
    r *= tempR;
    b *= tempB;
    g *= tintG;

    // Brightness
    r *= p.bright;
    g *= p.bright;
    b *= p.bright;

    // Contrast (di sekitar 128)
    r = (r - 128) * p.contrast + 128;
    g = (g - 128) * p.contrast + 128;
    b = (b - 128) * p.contrast + 128;

    // Saturasi / mono
    if (p.mono) {
      const L = luma(r, g, b);
      r = g = b = L;
    } else if (p.saturate !== 1) {
      const L = luma(r, g, b);
      r = L + (r - L) * p.saturate;
      g = L + (g - L) * p.saturate;
      b = L + (b - L) * p.saturate;
    }

    // Fade: angkat hitam, bayangan terangkat lebih banyak dari highlight
    if (fadeLift > 0) {
      r += fadeLift * (1 - r / 255);
      g += fadeLift * (1 - g / 255);
      b += fadeLift * (1 - b / 255);
    }

    // Halation: pendar merah-oranye (screen blend) dari masker blur
    if (glow) {
      const q = glow[i]! * p.halation;
      if (q > 0) {
        r = 255 - ((255 - r) * (255 - 255 * q * 1.0)) / 255;
        g = 255 - ((255 - g) * (255 - 255 * q * 0.45)) / 255;
        b = 255 - ((255 - b) * (255 - 255 * q * 0.25)) / 255;
      }
    }

    // Vignette: redup radial ke sudut
    if (p.vignette > 0) {
      const x = i % w;
      const y = (i - x) / w;
      const dx = (x - cx) / maxDist;
      const dy = (y - cy) / maxDist;
      const d = Math.sqrt(dx * dx + dy * dy); // 0 pusat → 1 sudut
      const v = 1 - p.vignette * d * d * 1.15;
      r *= v;
      g *= v;
      b *= v;
    }

    // Grain: luma-modulated (paling tampak di midtone), deterministik
    if (grainAmp > 0) {
      const gn = (rand() - 0.5) * 2 * grainAmp;
      const L = luma(r, g, b) / 255;
      const mod = 1 - Math.abs(2 * L - 1) * 0.6; // midtone lebih kuat
      r += gn * mod;
      g += gn * mod;
      b += gn * mod;
    }

    data[j] = clamp255(r);
    data[j + 1] = clamp255(g);
    data[j + 2] = clamp255(b);
    // alpha (j+3) dibiarkan
  }
  return data;
}
