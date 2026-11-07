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
  "backup-media": 24,
};

/**
 * Ambang basi = 2x jadwalnya — aturan yang sama dipakai panel admin. Sekali
 * lewat masih bisa berarti jitter penjadwal atau redeploy yang bertepatan.
 */
export const FAKTOR_BASI = 2;

/**
 * Angka di `cron_runs.stats` yang berarti "pekerjaannya TIDAK terjadi".
 *
 * Dipisah dari yang sekadar sinyal penyetelan karena akibatnya beda kelas.
 * `*Failed` dan `*NoOwner` berarti ada yang seharusnya dikerjakan tetapi tidak
 * — dan yang paling berat `purge-expired.storageFailed`: baris DB sudah
 * dibersihkan sementara objeknya tertinggal, jadi data pribadi yang menurut
 * UU PDP harus musnah tinggal di storage tanpa rujukan apa pun lagi.
 *
 * Kenapa ini perlu dibaca di sini: `recordCronRun` menandai run itu `ok: true`
 * (pekerjaan DB-nya memang berhasil), dan `ok: true` me-NULL-kan `last_error`
 * serta tidak menaikkan `failures`. Tanpa membaca `stats`, verifikator ini
 * melaporkan cron tersebut HIJAU selamanya.
 */
export const STATS_GAGAL = /(Failed|NoOwner)$/;
/** Sinyal penyetelan: pekerjaannya terjadi, kadensnya yang perlu ditinjau. */
export const STATS_PERHATIAN = new Set([
  "budgetHabis",
  "tanpaTxn",
  "backstop",
  "notifyTruncated",
]);

export function angkaStats(stats, cocok) {
  if (!stats || typeof stats !== "object") return [];
  return Object.entries(stats)
    .filter(([k, v]) => typeof v === "number" && v > 0 && cocok(k))
    .map(([k, v]) => `${k}=${v}`);
}
