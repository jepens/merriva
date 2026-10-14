/**
 * Tujuan tombol "Gunakan tema ini" — satu sumber untuk katalog tema, showcase,
 * dan halaman buat-undangan yang membacanya kembali.
 *
 * KENAPA SATU MODUL UNTUK TIGA BARIS. Sebelumnya kedua tombol menunjuk
 * `/daftar` begitu saja: tema yang baru saja dipilih pengunjung DIBUANG, dan
 * pengguna yang sudah login dipantulkan `/daftar` ke `/dashboard` — berakhir di
 * dasbor kosong tanpa penjelasan, setelah menyatakan dengan jelas tema apa yang
 * ia mau. Begitu temanya dibawa lewat query string, nama parameternya menjadi
 * kontrak antara dua komponen penaut dan satu halaman pembaca; salah ketik di
 * salah satunya tidak menimbulkan galat apa pun, ia hanya diam-diam kembali
 * membuang pilihan pengguna — kegagalan yang sama, hanya lebih sulit dilihat.
 */

import type { InvitationCategory } from "@/types";

/** Nama parameter query. Dipakai penaut DAN pembaca; jangan ditulis manual. */
export const THEME_PARAM = "tema";

/** Halaman tujuan; `createInvitationAction` yang kelak melempar ke editor. */
export const CREATE_PATH = "/dashboard/undangan/baru";

/** Tautan "Gunakan tema ini" untuk sebuah slug tema. */
export function themeCtaHref(slug: string): string {
  return `${CREATE_PATH}?${THEME_PARAM}=${encodeURIComponent(slug)}`;
}

/**
 * Bersihkan nilai `?tema=` menjadi slug yang aman dipakai kembali di URL.
 *
 * Nilainya berasal dari bilah alamat dan diputar ULANG ke dalam `?next=` saat
 * pengunjung diminta masuk, jadi ia harus dibatasi SEBELUM disambung: hanya
 * huruf kecil, angka, dan tanda hubung. Ini bukan pengganti pemeriksaan
 * sebenarnya — slug yang lolos di sini tetap harus dicocokkan dengan katalog
 * tema aktif, karena tema nonaktif pun lolos saringan bentuk.
 */
export function themeFromParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return /^[a-z0-9-]{1,64}$/.test(raw) ? raw : null;
}

/** Bentuk minimum yang dibutuhkan dari katalog tema aktif. */
interface TemaKatalog {
  slug: string;
  categories: InvitationCategory[];
}

/**
 * Terjemahkan `?tema=` menjadi nilai awal form — atau `null` bila tak layak.
 *
 * Dicocokkan dengan katalog AKTIF, bukan hanya bentuknya: tema yang
 * dinonaktifkan lolos saringan bentuk, dan memilihnya akan menghasilkan form
 * dengan pilihan hantu yang tak ada di daftar.
 *
 * `category` ikut dikembalikan — bukan dibiarkan pada bawaan "wedding" — karena
 * pemilih tema di form DISARING oleh kategori. Tema korporat/keluarga yang
 * terpilih akan lenyap dari daftar, dan pengguna melihat form yang tampak
 * mengabaikan pilihan yang baru saja ia buat. "wedding" diutamakan bila tema
 * mendukungnya supaya kasus terbanyak tidak berpindah tab tanpa alasan.
 */
export function preselectFromCatalog(
  themes: readonly TemaKatalog[],
  slug: string | null,
): { themeSlug: string; category: InvitationCategory } | null {
  if (!slug) return null;
  const tema = themes.find((t) => t.slug === slug);
  if (!tema) return null;
  const category = tema.categories.includes("wedding")
    ? "wedding"
    : tema.categories[0];
  return category ? { themeSlug: tema.slug, category } : null;
}
