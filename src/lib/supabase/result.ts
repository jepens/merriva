/**
 * Galat bacaan Supabase yang DILEMPAR oleh `dataOrThrow` (DECISIONS #45).
 *
 * postgrest-js (tanpa `.throwOnError()`) mengembalikan `error` sebagai OBJEK
 * POLOS `{message, details, hint, code}`, bukan `Error`. Dilempar apa adanya,
 * Next membungkusnya menjadi `Error(JSON)` bertumpukan internal Next — di Sentry
 * ketujuh bacaan halaman publik tak bisa dibedakan. Kelas ini dibuat DI TITIK
 * PANGGIL (tumpukan menunjuk bacaan yang gagal), pesannya memuat label bacaan,
 * dan galat aslinya disimpan di `cause`.
 */
export class SupabaseReadError extends Error {
  readonly code: string | undefined;

  constructor(label: string, original: unknown) {
    const raw = (original ?? {}) as { message?: unknown; code?: unknown };
    const message =
      typeof raw.message === "string" && raw.message
        ? raw.message
        : String(original);
    super(`${label}: ${message}`, { cause: original });
    this.name = "SupabaseReadError";
    this.code = typeof raw.code === "string" ? raw.code : undefined;
  }
}

/**
 * Data hasil query Supabase, atau MELEMPAR `SupabaseReadError` (DECISIONS #45).
 *
 * Untuk jalur yang TIDAK BOLEH merender data kosong palsu saat DB bermasalah —
 * terutama halaman undangan ISR `/{slug}`, tempat `data ?? []` akan DI-CACHE
 * sebagai isi undangan (jadwal/galeri kosong) bagi semua tamu. Render yang
 * melempar tak pernah di-cache: pada revalidasi berbasis waktu Next tetap
 * menyajikan versi baik terakhir; sesudah `revalidatePath` (pemilik menyimpan)
 * render berjalan blocking, dan kegagalannya menjadi halaman galat sementara
 * yang tak di-cache (`app/global-error.tsx`) lalu pulih pada permintaan
 * berikutnya.
 *
 * @param label nama bacaan (mis. tabelnya) — muncul di pesan & Sentry.
 */
export function dataOrThrow<T>(
  result: { data: T; error: unknown },
  label: string,
): T {
  if (result.error) throw new SupabaseReadError(label, result.error);
  return result.data;
}
