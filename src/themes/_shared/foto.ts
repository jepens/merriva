import type { CSSProperties } from "react";

import type { PhotoView } from "@/types/invitation";

/**
 * Gaya untuk `<img>` foto bernama (THEME-CONTRACT §3) — SATU helper untuk
 * semua tema.
 *
 * Penyesuaian pemilik tidak dipanggang ke berkasnya; ia tiba sebagai angka dan
 * diterapkan di sini. Akibatnya rasio pangkas milik TEMA: wadah potret 4:5 dan
 * wadah lanskap 16:9 memangkas foto yang sama dengan benar, dan pemilik yang
 * berganti tema tak kehilangan apa pun.
 *
 * `transformOrigin` sengaja disamakan dengan `objectPosition`. Tanpa itu,
 * memperbesar menarik gambar ke arah TENGAH WADAH dan menggeser wajah keluar —
 * persis kesalahan yang membuat penyesuaian terasa "melompat".
 */
export function fotoStyle(
  f: Pick<PhotoView, "x" | "y" | "zoom">,
): CSSProperties {
  const pos = `${f.x * 100}% ${f.y * 100}%`;
  return {
    objectFit: "cover",
    objectPosition: pos,
    // `undefined` (bukan `scale(1)`) supaya tema tanpa perbesaran tak membuat
    // lapisan komposit baru di halaman yang mengejar LCP < 2,5 dtk.
    transform: f.zoom === 1 ? undefined : `scale(${f.zoom})`,
    transformOrigin: pos,
  };
}
