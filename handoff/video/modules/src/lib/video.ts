/**
 * Aturan video undangan (FASE J) — satu sumber untuk editor (validasi klien),
 * aksi server (validasi ukuran/tipe), dan spec. Server TIDAK mentranskode;
 * berkas disajikan apa adanya, jadi batas di sini adalah pagar biaya storage
 * dan kuota data tamu (keputusan owner 5 Nov 2026: ≤60 dtk & ≤40 MB,
 * landscape).
 */

export const VIDEO_MAX_BYTES = 40 * 1024 * 1024;
/** Toleransi +1 dtk — metadata durasi container sering membulat ke atas. */
export const VIDEO_MAX_SECONDS = 61;

/** Container yang diputar <video> di seluruh target dukungan (SPEC §10). */
export const VIDEO_ACCEPTED_TYPES: ReadonlySet<string> = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

/** Nilai atribut `accept` input berkas di editor. */
export const VIDEO_ACCEPT_ATTR = "video/mp4,video/webm,video/quicktime";

export type VideoFileIssue = "type" | "size";
export type VideoMetaIssue = "duration" | "orientation" | "unreadable";

/** Validasi yang bisa dilakukan SEBELUM membaca metadata (tipe & ukuran). */
export function validateVideoFile(file: {
  type: string;
  size: number;
}): VideoFileIssue | null {
  if (!VIDEO_ACCEPTED_TYPES.has(file.type)) return "type";
  if (file.size > VIDEO_MAX_BYTES) return "size";
  return null;
}

/**
 * Validasi metadata (dibaca klien via elemen <video> — durasi & dimensi).
 * Landscape wajib: semua tema membingkai video mendatar; video potret pecah
 * dari bingkainya (keputusan owner — contoh referensi 1920×1080).
 */
export function validateVideoMeta(meta: {
  durationSec: number;
  width: number;
  height: number;
}): VideoMetaIssue | null {
  if (
    !Number.isFinite(meta.durationSec) ||
    meta.durationSec <= 0 ||
    !Number.isFinite(meta.width) ||
    !Number.isFinite(meta.height) ||
    meta.width <= 0 ||
    meta.height <= 0
  )
    return "unreadable";
  if (meta.durationSec > VIDEO_MAX_SECONDS) return "duration";
  if (meta.width <= meta.height) return "orientation";
  return null;
}
