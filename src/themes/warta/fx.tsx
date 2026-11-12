"use client";

import { useEffect } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasIsi } from "@/themes/_shared/fit-names";

/**
 * Pengepas nama di ISI koran (klien, tier Craft — tanpa library), dua kelompok:
 *
 * - `data-wt-fit="nama"` — nama lengkap mempelai (Playfair kapital): boleh
 *   membungkus; hanya kata yang melampaui kolom yang dikecilkan.
 * - `data-wt-fit="ttd"` — tanda tangan penutup (Great Vibes): SATU baris
 *   (`white-space: nowrap` di warta.css), jadi seluruh barisnya dikecilkan
 *   sampai muat. Dulu ia ikut membungkus — satu baris di layar lebar, dua di
 *   layar sedikit lebih sempit (laporan pemilik 12 Nov).
 *
 * Kelompok TERPISAH karena pengepas memuat face pasangan PERTAMA saja lalu
 * mengukur ulang: satu kelompok gabungan menunggu Playfair (nama mempelai lebih
 * dulu di DOM), dan tanda tangan diukur dengan font cadangan bila Great Vibes
 * belum tiba — ukurannya meleset menurut kecepatan jaringan.
 */
export function WartaFx() {
  const { rootRef } = useCoverGate();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const pasang = (kelompok: "nama" | "ttd") => {
      const ambil = () =>
        Array.from(
          root.querySelectorAll<HTMLElement>(`[data-wt-fit="${kelompok}"]`),
        ).map((el) => [el, el] as const);
      const teks = ambil()
        .map(([el]) => el.textContent ?? "")
        .join(" ");
      return pasangPengepasIsi(root, ambil, teks);
    };
    const lepas = [pasang("nama"), pasang("ttd")];
    return () => lepas.forEach((f) => f());
  }, [rootRef]);

  return null;
}
