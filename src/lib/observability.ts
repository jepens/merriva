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
 * REM LEDAKAN PER-AREA.
 *
 * 105 pemanggil `reportHandledError` tersebar di 31 berkas, dan 24 area di
 * antaranya ada di jalur TAMU — dipanggil sekali per tamu, bukan sekali per
 * hari. Satu resepsi 300 tamu dengan storage bermasalah mengirim ratusan event
 * identik dalam hitungan menit. Dedupe bawaan Sentry tidak menolong: ia hanya
 * menyimpan SATU event sebelumnya, jadi dua area yang berselang-seling
 * melewatinya seluruhnya.
 *
 * Batasnya PER AREA, bukan `sampleRate` global: pemangkasan rata juga membuang
 * `payment.verify` dan `cron.purge-expired.storage` yang justru harus utuh —
 * keduanya jarang, jadi rem ini tak pernah menyentuhnya.
 *
 * Yang tertahan TIDAK hilang diam-diam: hitungannya menumpang event BERIKUTNYA
 * di area yang sama sebagai `tertahanSebelumnya`. Konsekuensi jujurnya — bila
 * ledakan itu kejadian terakhir di area tersebut, hitungannya baru muncul saat
 * area itu bersuara lagi. Itu ditukar sadar dengan tidak memasang timer di
 * proses server.
 *
 * Spike protection milik Sentry TIDAK menggantikan ini: ia membuang lintas
 * seluruh proyek tanpa pandang bulu. Keduanya saling melengkapi.
 */
const JENDELA_MS = 60_000;
const MAKS_PER_AREA = 5;
/** Batas Map sendiri — Map tak berbatas pada jalur galat adalah kebocoran. */
const MAKS_AREA = 200;

type Ember = { mulai: number; terkirim: number; tertahan: number };
const ember = new Map<string, Ember>();

/** `null` = tahan. Angka = kirim, dengan sekian event tertahan sebelumnya. */
function remBicara(area: string, kini: number): number | null {
  let e = ember.get(area);
  if (!e || kini - e.mulai >= JENDELA_MS) {
    const tertahan = e && kini - e.mulai >= JENDELA_MS ? e.tertahan : 0;
    e = { mulai: kini, terkirim: 1, tertahan: 0 };
    ember.set(area, e);
    if (ember.size > MAKS_AREA) {
      // Buang yang jendelanya paling tua — bukan yang paling sepi. Ember yang
      // sedang meledak justru yang harus bertahan.
      const tertua = [...ember.entries()].reduce((a, b) =>
        a[1].mulai <= b[1].mulai ? a : b,
      );
      if (tertua[0] !== area) ember.delete(tertua[0]);
    }
    return tertahan;
  }
  if (e.terkirim >= MAKS_PER_AREA) {
    e.tertahan += 1;
    return null;
  }
  e.terkirim += 1;
  return 0;
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
  const tertahan = remBicara(area, Date.now());
  if (tertahan === null) return;
  Sentry.captureException(toError(err), {
    tags: { area },
    extra: tertahan > 0 ? { ...extra, tertahanSebelumnya: tertahan } : extra,
  });
}
