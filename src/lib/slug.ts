import { z } from "zod";

/**
 * Aturan slug undangan (alamat publik `merriva.id/{slug}`). Lantai DB adalah
 * `CHECK (slug ~ '^[a-z0-9-]{3,60}$')` + UNIQUE; lapisan aplikasi ini lebih
 * ketat (tanpa hubung di tepi/berurutan, tanpa kata terpesan) demi URL yang rapi
 * dan tak berbentrok dengan rute aplikasi. Keunikan lintas-pemilik dicek terpisah
 * (server action + admin client), karena RLS SELECT hanya melihat baris sendiri.
 */

export const SLUG_MIN = 3;
export const SLUG_MAX = 60;

/**
 * Kata terpesan: berbentrok dengan segmen rute di root domain (`merriva.id/…`).
 * Sebuah slug yang sama dengan rute nyata akan membuat undangan tak terjangkau
 * (rute statis menang atas `[slug]`), jadi tolak sejak awal.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // rute nyata saat ini
  "dashboard",
  "masuk",
  "daftar",
  "reset-password",
  "auth",
  "api",
  // sistem / aset Next.js
  "_next",
  "static",
  "assets",
  "public",
  "favicon",
  "robots",
  "sitemap",
  "og",
  // rute yang direncanakan / umum
  "admin",
  "app",
  "www",
  "root",
  "help",
  "bantuan",
  "support",
  "dukungan",
  "about",
  "tentang",
  "pricing",
  "harga",
  "blog",
  "docs",
  "status",
  "health",
  "login",
  "logout",
  "signin",
  "signup",
  "register",
  "keluar",
  "profil",
  "profile",
  "pengaturan",
  "settings",
  "akun",
  "account",
  "undangan",
  "tema",
  "themes",
  "demo",
  "preview",
  "pratinjau",
  "checkout",
  "pay",
  "bayar",
  "payment",
  "pembayaran",
  "order",
  "pesanan",
  "webhook",
  "webhooks",
  "callback",
  "confirm",
  "konfirmasi",
  "terms",
  "syarat",
  "privacy",
  "privasi",
  "kebijakan",
  "contact",
  "kontak",
  "merriva",
  "new",
  "baru",
  "edit",
  "null",
  "undefined",
  "true",
  "false",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** Slug sistem untuk draft yang belum diatur pemilik (lihat `lib/id.ts`). */
export function isDraftSlug(slug: string): boolean {
  return slug.startsWith("draft-");
}

const SLUG_CHARS = /^[a-z0-9-]+$/;

/**
 * Bentuk yang MUNGKIN ada di DB — sama dengan CHECK `^[a-z0-9-]{3,60}$`. Jalur
 * publik menolak slug mustahil SEBELUM query (DECISIONS #45): slug ribuan
 * karakter membuat URL PostgREST melampaui batas gateway (414), dan galat itu
 * kini dijawab 503 "coba lagi" + laporan Sentry per hit — padahal slug-nya
 * pasti tak ada (dulu ditelan jadi 404/gambar default).
 */
export function isPlausibleSlug(slug: string): boolean {
  return (
    slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && SLUG_CHARS.test(slug)
  );
}

/**
 * Skema slug: input di-normalisasi (trim + lowercase) lalu divalidasi. Dipakai
 * di klien (umpan balik format instan) dan server (validasi ulang) — `.data`
 * berisi bentuk ternormalisasi yang aman disimpan.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN, `Minimal ${SLUG_MIN} karakter`)
  .max(SLUG_MAX, `Maksimal ${SLUG_MAX} karakter`)
  .regex(/^[a-z0-9-]+$/, "Hanya huruf kecil, angka, dan tanda hubung (-)")
  .refine(
    (s) => !s.startsWith("-") && !s.endsWith("-"),
    "Tidak boleh diawali atau diakhiri tanda hubung",
  )
  .refine((s) => !s.includes("--"), "Tanda hubung tidak boleh berurutan")
  .refine((s) => !isDraftSlug(s), 'Awalan "draft-" digunakan sistem')
  .refine((s) => !isReservedSlug(s), "Alamat ini tidak tersedia");

export type SlugInput = z.infer<typeof slugSchema>;

/**
 * Ubah teks bebas (mis. nama panggilan) → kandidat slug valid. Sengaja tanpa
 * escape unicode: karakter non-ASCII apa pun menjadi tanda hubung lalu dirapikan.
 * Hasil kosong/terlalu pendek adalah tanggung jawab pemanggil untuk diabaikan.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}
