import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";

// Self-hosted (next/font) → tanpa request eksternal, aman untuk LCP & WebView WA.
// Bricolage Grotesque = display berkarakter; Hanken Grotesk = teks humanis.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--mrv-display",
  display: "swap",
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--mrv-body",
  display: "swap",
});

/**
 * Kelas variabel font marketing (`--mrv-display` + `--mrv-body`). Dipasang di
 * elemen pembungkus berkelas `.mrv` agar token font tersedia. Dideklarasikan
 * sekali di sini lalu dipakai ulang (MarketingShell, layout auth) → satu instans.
 */
export const mrvFontVars = `${display.variable} ${body.variable}`;
