import { Jost, Playfair_Display } from "next/font/google";

import { WeddingLayout } from "@/themes/_shared/wedding-layout";
import type { ThemeComponentProps } from "@/themes/registry";

import "./noir.css";
import { L, WRONG_CATEGORY } from "./labels";

// Self-hosted (next/font). Playfair Display = serif Didone dramatis (display),
// Jost = geometric sans (teks). Nuansa malam glamor. Tanpa request eksternal.
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--nr-display",
  display: "swap",
});
const body = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--nr-body",
  display: "swap",
});

/**
 * Tema "Noir" (wedding dark-luxe, tier premium). Charcoal + emas + gading;
 * serif Didone dramatis, aksen emas. Orkestrasi wedding bersama; identitas di
 * `noir.css`.
 */
export default function Noir({ data }: ThemeComponentProps) {
  return (
    <WeddingLayout
      data={data}
      cx="nr"
      labels={L}
      rootClass={`nr ${display.variable} ${body.variable}`}
      wrongCategory={WRONG_CATEGORY}
    />
  );
}
