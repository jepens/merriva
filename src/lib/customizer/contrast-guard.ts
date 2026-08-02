/**
 * Penjaga kontras WCAG untuk warna aksen custom (CUSTOMIZER-SPEC §4).
 *
 * Aturan produk: warna aksen dipakai untuk TEKS di atas kertas tema →
 * rasio kontras wajib ≥ 4.5 (WCAG AA teks normal). Bila warna pilihan user
 * kurang, digelapkan bertahap sampai lolos; elemen dekoratif tetap memakai
 * warna asli. Modul ini murni (tanpa dependensi) — dipakai di editor (live)
 * DAN saat render publik (server) agar data apa pun yang tersimpan tetap aman.
 */

const HEX_RE = /^#([0-9a-f]{6})$/i;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse "#rrggbb" (case-insensitive). Melempar error untuk format lain. */
export function hexToRgb(hex: string): Rgb {
  if (!HEX_RE.test(hex)) throw new Error(`Warna hex tidak valid: ${hex}`);
  const v = hex.slice(1);
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Luminansi relatif per definisi WCAG 2.x. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rasio kontras WCAG antara dua warna (1..21). */
export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export interface SafeTextColorResult {
  /** Warna yang aman dipakai untuk teks di atas `background`. */
  color: string;
  /** true bila warna asli digelapkan (di-"snap") agar lolos ambang. */
  snapped: boolean;
  /** Rasio kontras akhir `color` terhadap `background`. */
  ratio: number;
}

/**
 * Versi aman-teks dari `accent` di atas `background` (kertas tema).
 * Menggelapkan bertahap (faktor 0.92) hingga rasio ≥ `minRatio` (default 4.5 AA)
 * atau iterasi habis (fallback terakhir: hitam murni — selalu lolos di kertas terang).
 */
export function safeTextColor(
  accent: string,
  background: string,
  minRatio = 4.5,
): SafeTextColorResult {
  let color = rgbToHex(hexToRgb(accent)); // normalisasi lowercase
  const bg = rgbToHex(hexToRgb(background));
  let snapped = false;

  for (let i = 0; i < 32; i++) {
    const ratio = contrastRatio(color, bg);
    if (ratio >= minRatio) return { color, snapped, ratio };
    const { r, g, b } = hexToRgb(color);
    color = rgbToHex({ r: r * 0.92, g: g * 0.92, b: b * 0.92 });
    snapped = true;
  }
  const black = "#000000";
  return { color: black, snapped: true, ratio: contrastRatio(black, bg) };
}

/**
 * Warna teks di ATAS elemen beraksen (mis. tombol berlatar aksen):
 * pilih putih atau `ink` — mana yang kontrasnya lebih tinggi terhadap aksen.
 */
export function textOnAccent(accent: string, ink: string): string {
  const white = "#ffffff";
  return contrastRatio(white, accent) >= contrastRatio(ink, accent)
    ? white
    : rgbToHex(hexToRgb(ink));
}
