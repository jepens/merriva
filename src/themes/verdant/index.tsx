import { Fraunces, Mulish } from "next/font/google";

import { WeddingLayout } from "@/themes/_shared/wedding-layout";
import type { ThemeComponentProps } from "@/themes/registry";

import "./verdant.css";
import { L, WRONG_CATEGORY } from "./labels";

// Self-hosted (next/font). Fraunces = serif organik lembut (display), Mulish =
// humanist bulat (teks). Nuansa taman/botanikal. Tanpa request eksternal.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--vd-display",
  display: "swap",
});
const body = Mulish({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--vd-body",
  display: "swap",
});

/**
 * Tema "Verdant" (wedding botanikal, tier standard). Sage + olive + krem, aksen
 * blush; bingkai lengkung organik & ornamen daun. Orkestrasi wedding bersama;
 * identitas di `verdant.css`.
 */
export default function Verdant({ data }: ThemeComponentProps) {
  return (
    <WeddingLayout
      data={data}
      cx="vd"
      labels={L}
      rootClass={`vd ${display.variable} ${body.variable}`}
      wrongCategory={WRONG_CATEGORY}
    />
  );
}
