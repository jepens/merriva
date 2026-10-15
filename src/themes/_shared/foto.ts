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
 *
 * TANPA PERBESARAN, kuncinya DIHILANGKAN — bukan diisi `undefined`.
 * Peramban memperlakukan keduanya sama, jadi perbedaannya tak terlihat di tema.
 * Tetapi helper ini kini dipakai juga oleh `/api/og`, dan satori MELEMPAR pada
 * `transform: undefined` ("Invalid `transform` value"). Karena `zoom: 1` adalah
 * nilai bawaan setiap foto yang baru diunggah, bentuk lama membuat pratinjau
 * tautan gagal 500 justru pada kasus yang paling sering. Ditemukan probe
 * 15 Okt 2026, sebelum sempat terbit.
 */
export function fotoStyle(
  f: Pick<PhotoView, "x" | "y" | "zoom">,
): CSSProperties {
  const pos = `${f.x * 100}% ${f.y * 100}%`;
  const dasar: CSSProperties = { objectFit: "cover", objectPosition: pos };
  // Tanpa `scale(1)` juga: tema tanpa perbesaran tak perlu membuat lapisan
  // komposit baru di halaman yang mengejar LCP < 2,5 dtk.
  if (f.zoom === 1) return dasar;
  return { ...dasar, transform: `scale(${f.zoom})`, transformOrigin: pos };
}
