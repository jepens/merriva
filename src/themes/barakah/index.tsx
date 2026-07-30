import { Amiri, Cairo } from "next/font/google";

import { WeddingLayout } from "@/themes/_shared/wedding-layout";
import type { ThemeComponentProps } from "@/themes/registry";

import "./barakah.css";
import { L, WRONG_CATEGORY } from "./labels";

// Self-hosted (next/font). Amiri = serif Naskhi elegan (Latin + Arab) untuk nama
// & ornamen; Cairo = sans Arab-Latin bersih untuk teks. Tanpa request eksternal.
const display = Amiri({
  subsets: ["latin", "arabic"],
  weight: ["400", "700"],
  variable: "--bk-display",
  display: "swap",
});
const body = Cairo({
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600"],
  variable: "--bk-body",
  display: "swap",
});

/**
 * Tema "Barakah" (wedding, islami, tier premium). Geometri Islami: emerald +
 * emas + krem, ornamen bintang delapan & bismillah. Memakai orkestrasi wedding
 * bersama; identitas ada di `barakah.css`.
 */
export default function Barakah({ data }: ThemeComponentProps) {
  return (
    <WeddingLayout
      data={data}
      cx="bk"
      labels={L}
      rootClass={`bk ${display.variable} ${body.variable}`}
      wrongCategory={WRONG_CATEGORY}
    />
  );
}
