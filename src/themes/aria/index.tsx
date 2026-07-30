import { Jost, Karla } from "next/font/google";

import { WeddingLayout } from "@/themes/_shared/wedding-layout";
import type { ThemeComponentProps } from "@/themes/registry";

import "./aria.css";
import { L, WRONG_CATEGORY } from "./labels";

// Self-hosted (next/font). Jost = geometric sans (display, bobot ringan), Karla =
// humanist sans (teks). Monokrom modern — kontras dgn tema serif berornamen.
const display = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--ar-display",
  display: "swap",
});
const body = Karla({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ar-body",
  display: "swap",
});

/**
 * Tema "Aria" (wedding, minimalis, tier standard). Monokrom, sans-serif, banyak
 * ruang kosong, garis rambut tunggal — anti-ornamen. Orkestrasi wedding bersama;
 * identitas di `aria.css`.
 */
export default function Aria({ data }: ThemeComponentProps) {
  return (
    <WeddingLayout
      data={data}
      cx="ar"
      labels={L}
      rootClass={`ar ${display.variable} ${body.variable}`}
      wrongCategory={WRONG_CATEGORY}
    />
  );
}
