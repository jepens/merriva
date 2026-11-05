"use client";

import { useEffect } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasIsi } from "@/themes/_shared/fit-names";

/**
 * Klien Lumina (tier Craft — tanpa gsap/canvas). Satu tugas: nama mempelai di
 * dua kolom `.lm-principals` yang lebih lebar dari kolomnya pada ukuran desain
 * terdorong keluar layar — kecilkan HANYA nama itu (_shared/fit-names.ts).
 * Tanpa masker: wadah yang diukur = elemen nama itu sendiri.
 */
export function LuminaFx() {
  const { rootRef } = useCoverGate();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const names = Array.from(
      root.querySelectorAll<HTMLElement>(".lm-principals .lm-principal__name"),
    );
    if (names.length === 0) return;
    return pasangPengepasIsi(
      root,
      () => names.map((el) => [el, el] as const),
      names.map((el) => el.textContent ?? "").join(""),
    );
  }, [rootRef]);

  return null;
}
