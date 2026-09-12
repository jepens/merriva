import { themeCssHrefs } from "./theme-css.generated";

/**
 * Emit stylesheet HANYA untuk tema yang benar-benar dipakai.
 *
 * WAJIB dirender berdampingan dengan komponen tema — CSS tema sengaja TIDAK
 * lagi di-`import` dari `src/themes/{slug}/index.tsx`. Alasannya batas
 * framework: Next mengumpulkan seluruh CSS yang terjangkau dari graph modul
 * halaman ke `entryCSSFiles` dan meng-emit <link> untuk semuanya, sehingga
 * setiap undangan dulu mengunduh stylesheet KESEPULUH tema (AUDIT-2026-09-04
 * PER-2/PER-5; lihat `scripts/build-theme-css.mjs` dan DECISIONS #31).
 *
 * `precedence` membuat React menaikkan <link> ini ke <head>, men-dedup bila
 * dirender lebih dari sekali, dan MENUNGGU stylesheet termuat sebelum konten
 * ditampilkan — jadi tak ada kedipan tanpa gaya. Nilainya sengaja bukan
 * "default": React mengurutkan berdasarkan urutan kemunculan precedence, dan
 * gaya tema harus datang SESUDAH `globals.css`.
 *
 * Slug tak dikenal → tak merender apa pun (halaman tetap tampil dengan gaya
 * dasar) alih-alih melempar; pemilihan tema yang tak valid sudah ditangani
 * `getThemeLoader` di pemanggil.
 */
export function ThemeStyles({ slug }: { slug: string }) {
  const href = themeCssHrefs[slug];
  if (!href) return null;
  return <link rel="stylesheet" href={href} precedence="theme" />;
}
