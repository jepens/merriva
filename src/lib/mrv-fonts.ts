import localFont from "next/font/local";

/**
 * Font marketing & auth — berkasnya ADA DI REPO (`src/fonts/*.woff2`).
 *
 * KENAPA BUKAN `next/font/google`: varian itu sudah self-hosted bagi PERAMBAN
 * (berkas disajikan dari domain sendiri), tetapi Next mengunduhnya dari Google
 * **saat build**. Artinya setiap `pnpm build` — di CI DAN di Docker build yang
 * menjadi deploy Easypanel — bergantung pada `fonts.googleapis.com` bisa
 * dihubungi. Ketergantungan itu BENAR-BENAR gagal pada 2026-10-04:
 * "Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'"
 * memerahkan CI pada commit yang tak menyentuh satu pun berkas font, dan lolos
 * pada re-run tanpa perubahan apa pun. Di CI akibatnya satu re-run; di deploy
 * produksi akibatnya deploy gagal — kemungkinan tepat saat perbaikan mendesak
 * perlu dikirim. `next/font/local` menghapus jaringan dari jalur build.
 *
 * Keduanya FONT VARIABEL, subset `latin` saja (produk berbahasa Indonesia;
 * blok latin-ext/vietnamese/cyrillic menambah berat tanpa dipakai) — rentang
 * bobotnya sama dengan yang dulu diminta dari Google: display 600–700, teks
 * 400–600. Satu berkas per keluarga, ~112 KB total.
 *
 * Memperbarui berkasnya (jarang): ambil CSS dari
 * `https://fonts.googleapis.com/css2?family=...&display=swap` dengan User-Agent
 * peramban modern, ambil URL `.woff2` dari blok komentar `/* latin *\/` saja,
 * lalu timpa berkas di `src/fonts/`.
 */

// Bricolage Grotesque — display berkarakter.
const mrvDisplay = localFont({
  src: "../fonts/bricolage-grotesque-latin.woff2",
  weight: "600 700",
  style: "normal",
  variable: "--mrv-display",
  display: "swap",
});

// Hanken Grotesk — teks humanis.
const mrvBody = localFont({
  src: "../fonts/hanken-grotesk-latin.woff2",
  weight: "400 600",
  style: "normal",
  variable: "--mrv-body",
  display: "swap",
});

/**
 * Kelas variabel font marketing (`--mrv-display` + `--mrv-body`). Dipasang di
 * elemen pembungkus berkelas `.mrv` agar token font tersedia. Dideklarasikan
 * sekali di sini lalu dipakai ulang (MarketingShell, layout auth) → satu instans.
 */
export const mrvFontVars = `${mrvDisplay.variable} ${mrvBody.variable}`;
