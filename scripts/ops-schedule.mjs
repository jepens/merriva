/**
 * Bagian MURNI `pnpm ops:verify` — jadwal cron yang diharapkan, tanpa I/O.
 *
 * Dipisah dari `ops-verify.mjs` karena berkas itu punya top-level await dan
 * `process.exit`: mengimpornya dari sebuah test berarti MENJALANKAN
 * verifikatornya. Pola yang sama dipakai `theme-scaffold.mjs` (murni) vs
 * `new-theme.mjs` (entri).
 *
 * Angka di sini menduplikasi `JADWAL_JAM` di `src/server/cron/status.ts`, yang
 * private di modul `server-only` sehingga tak bisa diimpor skrip Node biasa.
 * Duplikasi yang menyimpang adalah bagaimana panel admin mulai menuduh job yang
 * sehat (dan sebaliknya) — karena itu `tests/unit/ops-schedule.test.ts` menguji
 * angka ini terhadap `hitungHealth` yang sesungguhnya, bukan terhadap salinan.
 */

/** Jadwal yang diharapkan, dalam jam. Kunci = nama job di `cron_runs.name`. */
export const JADWAL_JAM = {
  "expire-orders": 1,
  "expire-invitations": 24,
  "expiry-reminders": 12,
  "purge-expired": 12,
};

/**
 * Ambang basi = 2x jadwalnya — aturan yang sama dipakai panel admin. Sekali
 * lewat masih bisa berarti jitter penjadwal atau redeploy yang bertepatan.
 */
export const FAKTOR_BASI = 2;
