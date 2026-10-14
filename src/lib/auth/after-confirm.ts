import "server-only";

import { cookies } from "next/headers";

import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Tujuan yang dititipkan MELINTASI konfirmasi email.
 *
 * KENAPA LEWAT COOKIE, BUKAN LEWAT TAUTAN EMAIL. Tautan konfirmasi TIDAK
 * dibangun kode ini. Ia dibangun templat email di dasbor Supabase, dan
 * templatnya (`docs/AUTH-SETUP.md` §2) memakai `{{ .SiteURL }}`:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
 *
 * Artinya `emailRedirectTo` di `signUpAction` TIDAK memengaruhi tautan itu sama
 * sekali — ia hanya divalidasi GoTrue terhadap daftar izin. Menitipkan tujuan
 * lewat `emailRedirectTo` tak akan sampai ke mana pun, dan menitipkannya lewat
 * templat berarti menggantungkan fitur produk pada satu kolom teks di dasbor
 * yang tak terjangkau test mana pun (DECISIONS #80).
 *
 * KETERBATASAN YANG DISENGAJA: cookie hanya ada di peramban tempat pendaftaran
 * dimulai. Bila tautan dibuka di perangkat lain — mendaftar di laptop, membuka
 * email di ponsel — tujuannya hilang dan pengguna mendarat di `/dashboard`,
 * persis seperti sebelum perubahan ini. Jadi ini peningkatan untuk kasus yang
 * bisa ditingkatkan, bukan jaminan. Jalur pemulihannya pun wajar: temanya tetap
 * bisa dipilih lagi di form buat-undangan.
 */

/** `path` dipersempit ke `/auth`: hanya route konfirmasi yang perlu membacanya. */
const COOKIE = "mrv_after_confirm";
const COOKIE_PATH = "/auth";

/**
 * Dua jam. Cukup untuk "cek email sebentar lagi", pendek untuk niat yang sudah
 * basi — tujuan dari kemarin bukan lagi tujuan yang pengguna ingat.
 */
const MAX_AGE = 2 * 60 * 60;

/** Titipkan tujuan sebelum pengguna pergi membuka emailnya. */
export async function stashNextForConfirm(next: unknown): Promise<void> {
  // `safeNextPath` dengan fallback KOSONG: tanpa tujuan khusus, jangan menulis
  // cookie sama sekali — `/dashboard` sudah menjadi perilaku bawaan.
  const path = safeNextPath(typeof next === "string" ? next : null, "");
  if (!path) return;

  const store = await cookies();
  store.set(COOKIE, path, {
    path: COOKIE_PATH,
    maxAge: MAX_AGE,
    httpOnly: true,
    // `lax` BUKAN `strict`: tautan email adalah navigasi tingkat-atas dari
    // konteks luar, dan `strict` akan menahan cookie justru pada satu-satunya
    // permintaan yang membutuhkannya.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Ambil tujuan itu SEKALI lalu buang. Dibaca ulang & disanitasi lagi di sini:
 * cookie berasal dari peramban, dan nilai yang pernah aman saat ditulis tetap
 * harus diperlakukan sebagai masukan saat dibaca.
 */
export async function takeNextForConfirm(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  store.delete({ name: COOKIE, path: COOKIE_PATH });
  return safeNextPath(raw, "") || null;
}
