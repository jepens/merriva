/**
 * Rate limiter per-kunci berbasis memori (sliding window). Cukup untuk MVP
 * SATU instance (Easypanel 1 container = 1 proses Node → state modul bertahan
 * antar-request). Ganti ke Redis/Upstash saat multi-instance (M4+) lewat
 * antarmuka yang sama. TIDAK menyimpan IP mentah — pemanggil memberi kunci
 * ter-hash (lihat `lib/request-ip.ts`). Fungsi menerima `now` agar dapat diuji.
 */

const buckets = new Map<string, number[]>();
// Batas kasar agar Map tak tumbuh tanpa henti bila banyak kunci unik.
const MAX_KEYS = 20_000;

/**
 * Reklamasi memori BERTAHAP saat Map penuh — TIDAK me-reset semua bucket
 * sekaligus (yang akan menolkan counter seluruh pengunjung sah). (1) buang
 * bucket yang seluruh timestamp-nya sudah keluar jendela; (2) bila masih penuh
 * (mis. serangan ledakan-kunci), buang yang TERTUA-dibuat sampai 90% kapasitas.
 * Terpadu dengan keying per-jaringan (request-ip.ts) yang memangkas ledakan
 * kunci di sumbernya.
 */
function evictIfFull(now: number, windowMs: number): void {
  if (buckets.size < MAX_KEYS) return;
  const cutoff = now - windowMs;
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || hits[hits.length - 1] <= cutoff)
      buckets.delete(key);
  }
  if (buckets.size >= MAX_KEYS) {
    const target = Math.floor(MAX_KEYS * 0.9);
    for (const key of buckets.keys()) {
      if (buckets.size <= target) break;
      buckets.delete(key); // Map = urutan penyisipan → tertua dulu
    }
  }
}

export interface RateLimitOptions {
  /** Maksimum aksi dalam jendela. */
  max: number;
  /** Panjang jendela (ms). */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimitCheck {
  key: string;
  opts: RateLimitOptions;
}

/**
 * Periksa beberapa bucket sekaligus secara SEMUA-ATAU-TIDAK-SAMA-SEKALI: hit
 * hanya dicatat bila SETIAP bucket masih punya slot. Request yang ditolak tak
 * mengubah bucket mana pun dan tak membuat kunci baru, sehingga penolakan di
 * satu lapis tak menguras lapis lain (DECISIONS #38). Aman tanpa kunci: Node
 * menjalankannya sinkron dalam satu thread.
 *
 * Jendela geser: hanya timestamp dalam `windowMs` terakhir yang dihitung. Hasil
 * gagal = bucket PERTAMA yang penuh (`retryAfterMs` = kapan slot tertuanya
 * kadaluarsa); hasil sukses = `remaining` terkecil.
 */
export function checkRateLimitAll(
  checks: readonly RateLimitCheck[],
  now: number = Date.now(),
): RateLimitResult {
  let remaining = Infinity;
  for (const { key, opts } of checks) {
    const hits = buckets.get(key);
    if (hits) {
      const cutoff = now - opts.windowMs;
      while (hits.length > 0 && hits[0] <= cutoff) hits.shift();
    }
    const count = hits?.length ?? 0;
    if (count >= opts.max) {
      const oldest = hits?.[0];
      const retryAfterMs =
        oldest === undefined
          ? opts.windowMs
          : Math.max(oldest + opts.windowMs - now, 0);
      return { ok: false, remaining: 0, retryAfterMs };
    }
    remaining = Math.min(remaining, opts.max - count - 1);
  }

  for (const { key, opts } of checks) {
    if (!buckets.has(key)) {
      evictIfFull(now, opts.windowMs); // proteksi memori bertahap (bukan reset total)
      buckets.set(key, []);
    }
  }
  for (const { key } of checks) {
    let hits = buckets.get(key);
    if (!hits) {
      // Sempat terbuang oleh eviksi kunci lain di atas (hanya saat Map penuh).
      hits = [];
      buckets.set(key, hits);
    }
    hits.push(now);
  }
  return { ok: true, remaining, retryAfterMs: 0 };
}

/**
 * Catat 1 percobaan untuk `key` dan putuskan boleh/tidak. Saat penuh →
 * `ok:false` dengan `retryAfterMs` = kapan slot tertua kadaluarsa.
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  return checkRateLimitAll([{ key, opts }], now);
}

/** Hanya untuk test — kosongkan seluruh state. */
export function __resetRateLimit(): void {
  buckets.clear();
}

/** Hanya untuk test — jumlah kunci yang sedang disimpan. */
export function __rateLimitKeyCount(): number {
  return buckets.size;
}
