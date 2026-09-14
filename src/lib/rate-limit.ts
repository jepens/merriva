/**
 * Rate limiter per-kunci berbasis memori (sliding window). Cukup untuk MVP
 * SATU instance (Easypanel 1 container = 1 proses Node → state modul bertahan
 * antar-request). Ganti ke Redis/Upstash saat multi-instance (M4+) lewat
 * antarmuka yang sama. TIDAK menyimpan IP mentah — pemanggil memberi kunci
 * ter-hash (lihat `lib/request-ip.ts`). Fungsi menerima `now` agar dapat diuji.
 */

interface Bucket {
  /** Timestamp hit dalam jendela, urut naik. */
  hits: number[];
  max: number;
  windowMs: number;
  /** Terakhir DIPERIKSA — diterima maupun ditolak. */
  lastSeen: number;
}

const buckets = new Map<string, Bucket>();
// Batas kasar agar Map tak tumbuh tanpa henti bila banyak kunci unik.
const MAX_KEYS = 20_000;

/** Buang timestamp yang sudah keluar jendela. */
function pruneHits(hits: number[], cutoff: number): void {
  while (hits.length > 0 && hits[0] <= cutoff) hits.shift();
}

/** Seberapa dekat bucket ke plafonnya: 0 = kosong, 1 = sedang membatasi. */
function fillRatio(bucket: Bucket): number {
  return bucket.hits.length / Math.max(bucket.max, 1);
}

/**
 * Reklamasi memori saat Map akan melampaui `MAX_KEYS` (DECISIONS #39) — TIDAK
 * me-reset semua bucket sekaligus:
 *  1) buang bucket yang kedaluwarsa menurut jendelanya MASING-MASING (bukan
 *     jendela request pemicu — dulu bucket 15 menit ikut terbuang oleh pemicu
 *     berjendela 60 detik);
 *  2) bila ruang kosong masih <10%, buang bucket berasio isi TERENDAH dulu
 *     (seri → yang paling lama tak DIPERIKSA) sampai 90% kapasitas.
 *
 * Membuang penghitung = me-resetnya, dan kerugiannya sebanding dengan seberapa
 * dekat ia ke plafon. Kunci sampah dari banjir terbuang paling awal; penghitung
 * yang sedang membatasi seseorang bertahan. Seri diputus dengan `lastSeen`,
 * bukan hit terakhir yang diterima, supaya penghitung yang terus MENOLAK tetap
 * dianggap aktif. Menyisakan ≥10% ruang membuat sapu O(n) ini berjalan paling
 * banyak sekali tiap ±2 ribu kunci baru, juga saat banjir stabil. Kunci milik
 * request yang sedang diproses (`protect`) tak pernah dibuang.
 */
function evictIfFull(
  now: number,
  incoming: number,
  protect: ReadonlySet<string>,
): void {
  if (buckets.size + incoming <= MAX_KEYS) return;
  const target = Math.floor(MAX_KEYS * 0.9) - incoming;

  for (const [key, bucket] of buckets) {
    if (protect.has(key)) continue;
    pruneHits(bucket.hits, now - bucket.windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
  if (buckets.size <= target) return;

  const candidates = [...buckets].filter(([key]) => !protect.has(key));
  candidates.sort(
    ([, a], [, b]) => fillRatio(a) - fillRatio(b) || a.lastSeen - b.lastSeen,
  );
  for (const [key] of candidates) {
    if (buckets.size <= target) break;
    buckets.delete(key);
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
 * menambah hit di bucket mana pun dan tak membuat kunci baru, sehingga
 * penolakan di satu lapis tak menguras lapis lain (DECISIONS #38). Aman tanpa
 * kunci: Node menjalankannya sinkron dalam satu thread.
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
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.lastSeen = now;
      pruneHits(bucket.hits, now - opts.windowMs);
    }
    const hits = bucket?.hits;
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

  const protect = new Set(checks.map((c) => c.key));
  let incoming = 0;
  for (const key of protect) if (!buckets.has(key)) incoming += 1;
  evictIfFull(now, incoming, protect); // proteksi memori bertahap (bukan reset total)

  for (const { key, opts } of checks) {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        hits: [],
        max: opts.max,
        windowMs: opts.windowMs,
        lastSeen: now,
      };
      buckets.set(key, bucket);
    }
    bucket.max = opts.max;
    bucket.windowMs = opts.windowMs;
    bucket.lastSeen = now;
    bucket.hits.push(now);
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
