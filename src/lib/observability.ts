import "server-only";

import * as Sentry from "@sentry/nextjs";

/**
 * Pelaporan error yang SUDAH DITANGANI (AUDIT-2026-09-04 KUA-4).
 *
 * Sentry hanya menangkap error TAK tertangani. Seluruh kegagalan yang sengaja
 * diubah menjadi pesan generik — termasuk kegagalan verifikasi pembayaran dan
 * unggah Album Momen — sebelumnya tidak terlihat di mana pun: bila Pakasir/R2/
 * Postgres bermasalah di hari-H, tim hanya menerima keluhan "Terjadi kesalahan"
 * tanpa satu pun sinyal. Penanganan error-nya sendiri sudah fail-closed dengan
 * benar; yang hilang murni jejak diagnostiknya.
 *
 * Server-only: mencegah SDK Sentry ikut terseret ke bundle klien. Tanpa DSN
 * (dev/CI) `captureException` adalah no-op, jadi aman dipanggil di mana saja.
 */

/** Normalkan nilai lempar apa pun (termasuk `PostgrestError`) menjadi `Error`. */
function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === "object" && "message" in err) {
    const e = new Error(String((err as { message: unknown }).message));
    // `code` ada pada PostgrestError/StorageError → berguna untuk grouping.
    const code = (err as { code?: unknown }).code;
    e.name =
      typeof code === "string" ? `SupabaseError:${code}` : "SupabaseError";
    return e;
  }
  return new Error(typeof err === "string" ? err : "unknown error");
}

/**
 * Laporkan error tertangani ke Sentry. `area` menjadi tag pencarian (mis.
 * `payment.verify`, `momen.upload`) — JANGAN memasukkan rahasia atau PII ke
 * `extra`; nilai di sini ikut terkirim ke Sentry.
 */
export function reportHandledError(
  err: unknown,
  area: string,
  extra?: Record<string, unknown>,
): void {
  Sentry.captureException(toError(err), { tags: { area }, extra });
}
