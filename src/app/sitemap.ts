import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/env";

/**
 * Sitemap halaman MARKETING saja (AUDIT-2026-10-12, DECISIONS #69).
 *
 * Sebelumnya `/sitemap.xml` menjawab 404 — bukan kebocoran, tetapi mesin pencari
 * tak punya daftar halaman publik. Yang TIDAK boleh masuk ke sini, dan sengaja
 * tidak ada:
 *
 *  * `/[slug]` — halaman undangan. Ia memang mengirim `robots: { index: false }`
 *    sendiri, tetapi mendaftarkannya di sitemap akan membatalkan maksud itu dan
 *    membocorkan daftar klien beserta nama mempelainya ke indeks publik.
 *  * `/[slug]/momen`, `/preview/*`, `/dashboard/*`, `/admin/*`, `/auth/*` —
 *    sama, atau butuh sesi.
 *
 * `lastModified` SENGAJA dikosongkan. Isi `/harga` dan `/tema` datang dari tabel
 * `packages`/`themes` yang bisa berubah tanpa deploy, jadi tanggal apa pun yang
 * bisa dihitung saat build akan menjadi klaim yang salah; `new Date()` lebih
 * buruk lagi — ia berubah setiap build tanpa ada yang benar-benar berubah.
 */
const HALAMAN = [
  "", // beranda
  "/harga",
  "/tema",
  "/faq",
  "/syarat",
  "/privasi",
  "/refund",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl.replace(/\/$/, "");
  return HALAMAN.map((path) => ({
    url: `${base}${path}`,
    // Beranda jadi pintu masuk; sisanya setara. Nilai `priority` memang hanya
    // petunjuk lemah bagi crawler — dicantumkan agar urutannya eksplisit, bukan
    // karena ia menentukan peringkat.
    priority: path === "" ? 1 : 0.7,
  }));
}
