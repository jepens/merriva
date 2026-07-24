/**
 * Teks UI berbahasa Indonesia, terpusat (persiapan i18n). Lihat SPEC §9.
 * Seluruh string yang tampil ke pengguna sebaiknya berasal dari sini.
 */
export const copy = {
  brand: {
    name: "Merriva",
    tagline: "Undangan digital untuk setiap momen bahagia.",
  },
  common: {
    loading: "Memuat…",
    error: "Terjadi kesalahan. Silakan coba lagi.",
    save: "Simpan",
    cancel: "Batal",
  },
} as const;

export type Copy = typeof copy;
