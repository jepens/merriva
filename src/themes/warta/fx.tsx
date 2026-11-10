"use client";

import { useEffect } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasIsi } from "@/themes/_shared/fit-names";

/**
 * Pengepas nama di ISI koran (klien, tier Craft — tanpa library): nama lengkap
 * mempelai (Playfair kapital) dan tanda tangan penutup (Great Vibes) yang satu
 * katanya melampaui kolom dikecilkan, bukan meluap (_shared/fit-names.ts). Elemen
 * bertanda `data-wt-fit` sekaligus wadahnya (blok selebar kolom).
 */
export function WartaFx() {
  const { rootRef } = useCoverGate();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ambil = () =>
      Array.from(root.querySelectorAll<HTMLElement>("[data-wt-fit]")).map(
        (el) => [el, el] as const,
      );
    const teks = ambil()
      .map(([el]) => el.textContent ?? "")
      .join(" ");
    return pasangPengepasIsi(root, ambil, teks);
  }, [rootRef]);

  return null;
}
