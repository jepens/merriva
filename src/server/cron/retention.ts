import "server-only";

/**
 * Aritmetika retensi — SATU definisi, dipakai fase PERINGATAN dan fase PURGE
 * (AUDIT-2026-10-01 B7).
 *
 * Sebelumnya `retentionCutoffIso` hidup di dalam route purge. Begitu fase
 * peringatan butuh tanggal yang sama, menyalin rumusnya akan membuat dua
 * definisi yang bisa berbeda diam-diam — dan "beda diam-diam" di sini berarti
 * email berbunyi "masih 7 hari" untuk data yang sudah terhapus.
 */

export const DAY_MS = 86_400_000;

/**
 * Cutoff retensi: 6 bulan kalender sebelum `now` (UTC). Baris dengan
 * `active_until < cutoff` sudah jatuh tempo purge.
 *
 * `setUTCMonth(m - 6)` MELUBER untuk tanggal yang tak ada: 31 Agustus − 6 bulan
 * → 31 Februari → 3 Maret. Itu disengaja dibiarkan apa adanya — yang penting
 * SELURUH produk memakai rumus yang sama, bukan rumus yang "benar" menurut
 * selera. Karena itu jangan pernah menghitung tanggal purge dengan
 * `active_until + 6 bulan`: penjumlahan TIDAK simetris dengan pengurangan ini.
 */
export function retentionCutoffIso(now: Date): string {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  return cutoff.toISOString();
}

/**
 * Cutoff seandainya hari ini `d` hari lagi — kunci seluruh penjadwalan
 * peringatan.
 *
 * Alih-alih menghitung tanggal purge per baris (yang menuntut aritmetika
 * terbalik yang tak simetris, dan tak bisa diekspresikan sebagai filter
 * PostgREST), arahnya DIBALIK: geser `now` ke depan lalu pakai fungsi yang sama.
 *
 *   baris jatuh tempo purge dalam ≤ d hari  ⟺  active_until < dueWithinIso(now, d)
 *
 * Dengan begitu peringatan dan purge selalu memakai garis yang persis sama, dan
 * mustahil bergeser satu terhadap yang lain.
 */
export function dueWithinIso(now: Date, days: number): string {
  return retentionCutoffIso(new Date(now.getTime() + days * DAY_MS));
}

/** Hari pertama ketika `activeUntil` jatuh tempo purge — untuk isi email. */
export function purgeDueMs(activeUntilIso: string): number | null {
  const au = Date.parse(activeUntilIso);
  if (Number.isNaN(au)) return null;
  // Cari hari D terkecil di mana `retentionCutoffIso(D) > activeUntil`, mulai
  // dari tebakan +6 bulan lalu geser maksimal beberapa hari. Dicari, bukan
  // dihitung, justru karena pengurangannya meluber.
  const tebakan = new Date(au);
  tebakan.setUTCMonth(tebakan.getUTCMonth() + 6);
  for (let geser = -4; geser <= 4; geser += 1) {
    const d = new Date(tebakan.getTime() + geser * DAY_MS);
    if (Date.parse(retentionCutoffIso(d)) > au) return d.getTime();
  }
  return tebakan.getTime();
}

/** Sisa hari sampai purge, minimal 1 — tak pernah "0 hari lagi". */
export function daysUntilPurge(activeUntilIso: string, nowMs: number): number {
  const due = purgeDueMs(activeUntilIso);
  if (due === null) return 1;
  return Math.max(1, Math.ceil((due - nowMs) / DAY_MS));
}

export type PurgeStage = "final" | "first";

export interface WarnRow {
  active_until: string;
  purge_warned_at: string | null;
  purge_final_warned_at: string | null;
}

/**
 * Apakah penanda ini milik SIKLUS yang sedang berjalan?
 *
 * Perpanjangan selalu MEMAJUKAN `active_until`, jadi penanda yang ditulis pada
 * siklus sebelumnya otomatis jatuh di belakangnya. Itu sebabnya tak perlu kolom
 * "siklus" tersendiri, dan — lebih penting — tak perlu satu pun RPC me-reset
 * penandanya: reset yang harus diingat di banyak tempat sudah terbukti membusuk
 * di repo ini (`reminder_sent_at` hilang dua kali, DECISIONS #65).
 *
 * Perbandingan memakai `Date.parse`, BUKAN string: PostgREST mengembalikan
 * `2027-03-01T00:00:00+00:00` sementara `toISOString()` menghasilkan `...Z`,
 * sehingga perbandingan leksikografis akan salah tanpa satu pun galat.
 */
function penandaSegar(penanda: string | null, activeUntilIso: string): boolean {
  if (!penanda) return false;
  const p = Date.parse(penanda);
  const au = Date.parse(activeUntilIso);
  if (Number.isNaN(p) || Number.isNaN(au)) return false;
  return p > au;
}

/**
 * Tahap peringatan yang PANTAS dikirim untuk baris ini, atau `null`.
 *
 * `final` didahulukan: baris yang masuk antrean terlambat (cron mati beberapa
 * hari, atau rilis pertama fitur ini) tak boleh menerima "30 hari lagi" padahal
 * sisanya 3 — dan tak boleh menerima DUA email dalam satu run.
 */
export function tahapPeringatan(
  row: WarnRow,
  now: Date,
  hariFinal = 7,
  hariPertama = 30,
): PurgeStage | null {
  const au = row.active_until;
  if (!au || Number.isNaN(Date.parse(au))) return null;
  const auMs = Date.parse(au);

  if (auMs < Date.parse(dueWithinIso(now, hariFinal))) {
    return penandaSegar(row.purge_final_warned_at, au) ? null : "final";
  }
  if (auMs < Date.parse(dueWithinIso(now, hariPertama))) {
    return penandaSegar(row.purge_warned_at, au) ? null : "first";
  }
  return null;
}

export type KeputusanPurge = "ya" | "backstop" | "tunggu-peringatan";

/**
 * Boleh dipurge sekarang?
 *
 * Data pribadi tak boleh dihapus permanen tanpa peringatan yang BENAR-BENAR
 * terkirim — itu janji `/syarat` dan `/privasi`. Tetapi pipeline email yang
 * rusak juga tak boleh menahan kewajiban retensi selamanya, karena menyimpan
 * data melewati batas adalah pelanggaran yang berlawanan arah. Karena itu ada
 * `backstop`: lewat ambangnya, purge jalan meski peringatannya tak pernah
 * terkirim — dan pemanggil menghitungnya terpisah supaya terlihat di `/admin`.
 */
export function bolehPurge(
  row: { active_until: string; purge_final_warned_at: string | null },
  now: Date,
  jedaHari = 7,
  backstopHari = 21,
): KeputusanPurge {
  const au = row.active_until;
  if (!au || Number.isNaN(Date.parse(au))) return "backstop";

  // Lewat jauh dari jatuh tempo → jangan tertahan lagi.
  if (Date.parse(au) < Date.parse(dueWithinIso(now, -backstopHari))) {
    return "backstop";
  }
  if (!penandaSegar(row.purge_final_warned_at, au)) return "tunggu-peringatan";

  // Peringatan terakhir harus sudah cukup lama untuk sempat ditindaklanjuti.
  const jedaCukup =
    now.getTime() - Date.parse(row.purge_final_warned_at as string) >=
    jedaHari * DAY_MS;
  return jedaCukup ? "ya" : "tunggu-peringatan";
}
