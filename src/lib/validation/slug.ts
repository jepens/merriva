import { z } from "zod";

/**
 * Slug undangan (SPEC §4.4 / DATA-MODEL §1): `merriva.id/{slug}`.
 * Aturan: lowercase `[a-z0-9-]{3,60}`, tanpa kata terlarang / rute sistem.
 * Ganti slug maks. 1× setelah aktif (ditegakkan di server action, bukan di sini).
 */

export const SLUG_PATTERN = /^[a-z0-9-]{3,60}$/;

/** Rute & subdomain sistem yang tidak boleh dipakai sebagai slug undangan. */
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "app",
  "dashboard",
  "masuk",
  "daftar",
  "keluar",
  "login",
  "logout",
  "register",
  "reset-password",
  "tema",
  "themes",
  "harga",
  "pricing",
  "demo",
  "undangan",
  "checkout",
  "bayar",
  "pembayaran",
  "webhooks",
  "cron",
  "og",
  "health",
  "www",
  "cdn",
  "static",
  "assets",
  "public",
  "_next",
  "favicon",
  "robots",
  "sitemap",
  "merriva",
  "support",
  "bantuan",
  "help",
  "tentang",
  "kontak",
  "privacy",
  "privasi",
  "terms",
  "kebijakan",
  "null",
  "undefined",
]);

/** Substring terlarang (kata kasar dasar). Daftar dapat diperluas. */
const BLOCKED_SUBSTRINGS = [
  "anjing",
  "bangsat",
  "kontol",
  "memek",
  "ngentot",
  "bajingan",
  "fuck",
  "shit",
  "bitch",
];

/** Ubah teks bebas menjadi kandidat slug (dipakai auto-suggest di editor). */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** True bila slug adalah kata terlarang / rute sistem / mengandung kata kasar. */
export function isReservedSlug(slug: string): boolean {
  const s = slug.toLowerCase();
  if (RESERVED_SLUGS.has(s)) return true;
  return BLOCKED_SUBSTRINGS.some((word) => s.includes(word));
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Alamat undangan minimal 3 karakter")
  .max(60, "Alamat undangan maksimal 60 karakter")
  .regex(SLUG_PATTERN, "Gunakan hanya huruf kecil, angka, dan tanda hubung")
  .refine(
    (s) => !isReservedSlug(s),
    "Alamat ini tidak tersedia, coba yang lain",
  );

export type Slug = z.infer<typeof slugSchema>;
