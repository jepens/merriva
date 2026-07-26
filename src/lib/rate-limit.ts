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

/**
 * Catat 1 percobaan untuk `key` dan putuskan boleh/tidak. Jendela geser: hanya
 * timestamp dalam `windowMs` terakhir yang dihitung. Saat penuh → `ok:false`
 * dengan `retryAfterMs` = kapan slot tertua kadaluarsa.
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  const { max, windowMs } = opts;
  const cutoff = now - windowMs;

  let hits = buckets.get(key);
  if (!hits) {
    if (buckets.size >= MAX_KEYS) buckets.clear(); // proteksi memori (kasar)
    hits = [];
    buckets.set(key, hits);
  }

  // Buang timestamp yang sudah keluar jendela.
  while (hits.length > 0 && hits[0] <= cutoff) hits.shift();

  if (hits.length >= max) {
    const retryAfterMs = Math.max(hits[0] + windowMs - now, 0);
    return { ok: false, remaining: 0, retryAfterMs };
  }

  hits.push(now);
  return { ok: true, remaining: max - hits.length, retryAfterMs: 0 };
}

/** Hanya untuk test — kosongkan seluruh state. */
export function __resetRateLimit(): void {
  buckets.clear();
}
