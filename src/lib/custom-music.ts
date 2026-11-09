/**
 * Musik unggahan klien (DECISIONS #121) — satu sumber aturan untuk editor
 * (memeriksa berkas SEBELUM diunggah), route `POST /api/invitations/[id]/music`
 * (penegak), dan SPEC §4.4.
 *
 * Isomorfik: TANPA `node:crypto` — `lib/audio.ts` (pustaka admin) mengimpornya
 * sehingga tak bisa dipakai komponen klien. Sidik sha256 dihitung di route.
 *
 * Hanya MP3 (keputusan pemilik 8 Nov 2026): diputar di semua WebView WhatsApp
 * Android & iOS, dan di-cache Cloudflare secara bawaan (`.m4a` tidak).
 */

/**
 * Batas ukuran berkas yang DIUNGGAH. 10 MB (keputusan pemilik 9 Nov 2026,
 * naik dari 8 MB): lagu 7 menit masih muat pada 192 kbps. Sengaja terpisah
 * dari batas lagu pustaka admin (`AUDIO_MAX_BYTES`, 8 MB).
 */
export const CUSTOM_MUSIC_MAX_BYTES = 10 * 1024 * 1024;
export const CUSTOM_MUSIC_MIN_SECONDS = 10;
export const CUSTOM_MUSIC_MAX_SECONDS = 7 * 60;
/**
 * Toleransi atas batas durasi: durasi dihitung per frame (≈26 ms), jadi lagu
 * "7:00" bisa terbaca 420,03 dtk.
 */
const DURATION_TOLERANCE_SECONDS = 1;

/**
 * Unggahan per undangan per 24 jam — dihitung dari tabel `music_uploads`
 * (bertahan melewati deploy, berbeda dengan rate limit di memori). Satu lagu
 * per undangan; lima cukup untuk mencoba-ganti beberapa kali, dan membatasi
 * objek yang menunggu disapu cron (≤ 5 × 10 MB per undangan).
 */
export const CUSTOM_MUSIC_UPLOADS_PER_DAY = 5;

/**
 * Versi teks pernyataan hak (`copy.editor.customMusic.attest`).
 * NAIKKAN setiap kali teksnya berubah — angka ini yang dicatat di
 * `music_uploads.attest_version` sebagai versi yang dicentang pemilik.
 */
export const CUSTOM_MUSIC_ATTEST_VERSION = 1;
/** Header yang membawa versi pernyataan yang dicentang di editor. */
export const CUSTOM_MUSIC_ATTEST_HEADER = "x-merriva-attest";

/** Nilai atribut `accept` input berkas di editor. */
export const CUSTOM_MUSIC_ACCEPT_ATTR = "audio/mpeg,.mp3";

export type CustomMusicFileIssue = "empty" | "type" | "size";

/**
 * Pemeriksaan yang bisa dilakukan tanpa membaca isi (nama, tipe, ukuran).
 * Isi berkas tetap diperiksa `parseMp3` — di editor untuk pesan cepat, di
 * server sebagai penegak.
 */
export function validateCustomMusicFile(file: {
  name: string;
  type: string;
  size: number;
}): CustomMusicFileIssue | null {
  if (!(file.size > 0)) return "empty";
  const type = file.type.toLowerCase();
  const mp3Type = type === "audio/mpeg" || type === "audio/mp3";
  // Pengelola berkas Android kadang melaporkan MIME kosong/octet-stream.
  const genericType = type === "" || type === "application/octet-stream";
  if (!mp3Type && !(genericType && /\.mp3$/i.test(file.name))) return "type";
  if (file.size > CUSTOM_MUSIC_MAX_BYTES) return "size";
  return null;
}

export type CustomMusicDurationIssue = "short" | "long";

export function validateCustomMusicDuration(
  seconds: number,
): CustomMusicDurationIssue | null {
  if (!Number.isFinite(seconds) || seconds < CUSTOM_MUSIC_MIN_SECONDS)
    return "short";
  if (seconds > CUSTOM_MUSIC_MAX_SECONDS + DURATION_TOLERANCE_SECONDS)
    return "long";
  return null;
}

// -----------------------------------------------------------------------------
// Parser MP3 (MPEG-1/2 Layer III) — tanpa dependensi
// -----------------------------------------------------------------------------

/**
 * Jendela pencarian frame pertama sesudah tag ID3v2. Byte di depannya (padding
 * nol, sampah encoder, atau isi poliglot) DIBUANG — tidak ikut disimpan.
 */
const SYNC_SEARCH_BYTES = 64 * 1024;
/**
 * Sisa byte sesudah frame terakhir yang masih diterima (dan dibuang): tag
 * ID3v1 (128 B), APEv2, Lyrics3, atau frame terakhir yang terpotong. Lebih dari
 * ini berarti rantai frame putus di tengah lagu — berkasnya rusak, atau bukan
 * MP3 yang kebetulan memuat dua header palsu berurutan.
 */
const MAX_TAIL_BYTES = 256 * 1024;

const BITRATE_V1 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const BITRATE_V2 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];
const SAMPLE_RATE_V1 = [44100, 48000, 32000];
const SAMPLE_RATE_V2 = [22050, 24000, 16000];

type FrameHeader = {
  /** MPEG-1 (true) atau MPEG-2 (false). MPEG-2.5 ditolak. */
  v1: boolean;
  sampleRate: number;
  /** Panjang frame dalam byte (termasuk header) — selalu > 0. */
  length: number;
  samples: number;
};

function readFrameHeader(b: Uint8Array, i: number): FrameHeader | null {
  if (i < 0 || i + 4 > b.length) return null;
  const b1 = b[i + 1]!;
  const b2 = b[i + 2]!;
  if (b[i] !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
  const version = (b1 >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = 2.5, 1 = reserved
  if (version !== 3 && version !== 2) return null;
  if (((b1 >> 1) & 3) !== 1) return null; // Layer III
  const bitrateIndex = b2 >> 4;
  const sampleRateIndex = (b2 >> 2) & 3;
  // 0 = free format (panjang frame tak bisa dihitung), 15 = terlarang.
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3)
    return null;
  if ((b[i + 3]! & 3) === 2) return null; // emphasis "reserved"
  const v1 = version === 3;
  const kbps = (v1 ? BITRATE_V1 : BITRATE_V2)[bitrateIndex]!;
  const sampleRate = (v1 ? SAMPLE_RATE_V1 : SAMPLE_RATE_V2)[sampleRateIndex]!;
  const padding = (b2 >> 1) & 1;
  const length =
    Math.floor(((v1 ? 144000 : 72000) * kbps) / sampleRate) + padding;
  return { v1, sampleRate, length, samples: v1 ? 1152 : 576 };
}

export type Mp3ParseResult =
  | {
      ok: true;
      /** Byte audio yang DISIMPAN = `bytes.subarray(start, end)`. */
      start: number;
      end: number;
      frames: number;
      durationSec: number;
    }
  | { ok: false; reason: "format" | "corrupt" };

/**
 * Telusuri berkas sebagai rantai frame MP3 dari awal sampai akhir.
 *
 * Yang disimpan server HANYA rentang frame audio (`start..end`): tag ID3v2
 * (gambar sampul, sisipan GEOB apa pun), byte di depan frame pertama, dan ekor
 * sesudah frame terakhir dibuang. Jadi berkas yang menumpangkan isi lain DI
 * LUAR rantai frame (arsip ZIP di ekor, HTML di depan, sampul) kehilangan
 * tumpangannya. Isi BADAN frame tidak diperiksa (itu data audio terkompresi):
 * seseorang bisa menyelipkan byte sembarang di sana, tetapi hasilnya tetap
 * disajikan sebagai `audio/mpeg` + `nosniff`, terpotong-potong oleh header
 * frame setiap ratusan byte, dan tak bisa dibuka alat biasa sebagai berkas
 * lain. Durasi dihitung dari jumlah frame yang sama — penegak batas durasi di
 * server, bukan metadata kiriman klien.
 *
 * - `format`: tak ada dua frame Layer III berurutan di awal berkas (bukan MP3,
 *   atau MP3 berformat yang tak didukung: MPEG-2.5 / free format).
 * - `corrupt`: tag ID3 rusak, atau rantai frame putus jauh sebelum akhir berkas.
 */
export function parseMp3(bytes: Uint8Array): Mp3ParseResult {
  const n = bytes.length;
  let off = 0;

  // Tag ID3v2 (bisa lebih dari satu). Ukurannya syncsafe 28-bit.
  while (
    off + 10 <= n &&
    bytes[off] === 0x49 &&
    bytes[off + 1] === 0x44 &&
    bytes[off + 2] === 0x33
  ) {
    const major = bytes[off + 3]!;
    if (major < 2 || major > 4 || bytes[off + 4] === 0xff)
      return { ok: false, reason: "corrupt" };
    let size = 0;
    for (let k = 6; k < 10; k++) {
      const s = bytes[off + k]!;
      if (s & 0x80) return { ok: false, reason: "corrupt" };
      size = size * 128 + s;
    }
    const footer = major === 4 && bytes[off + 5]! & 0x10 ? 10 : 0;
    off += 10 + size + footer;
    if (off > n) return { ok: false, reason: "corrupt" };
  }

  // Frame pertama: header sah yang DIIKUTI header sah kedua di offset terhitung
  // (satu header saja terlalu mudah muncul kebetulan di data acak).
  let start = -1;
  let first: FrameHeader | null = null;
  const limit = Math.min(off + SYNC_SEARCH_BYTES, n - 4);
  for (let p = off; p <= limit; p++) {
    const h = readFrameHeader(bytes, p);
    if (!h) continue;
    const h2 = readFrameHeader(bytes, p + h.length);
    if (h2 && h2.v1 === h.v1 && h2.sampleRate === h.sampleRate) {
      start = p;
      first = h;
      break;
    }
  }
  if (start < 0 || !first) return { ok: false, reason: "format" };

  let pos = start;
  let frames = 0;
  let samples = 0;
  for (;;) {
    const h = readFrameHeader(bytes, pos);
    if (
      !h ||
      h.v1 !== first.v1 ||
      h.sampleRate !== first.sampleRate ||
      pos + h.length > n
    )
      break;
    pos += h.length;
    frames++;
    samples += h.samples;
  }

  // Header kedua yang sah tetapi frame-nya terpotong akhir berkas: hanya satu
  // frame utuh — sama dengan "tak ada dua frame berurutan".
  if (frames < 2) return { ok: false, reason: "format" };
  if (n - pos > MAX_TAIL_BYTES) return { ok: false, reason: "corrupt" };
  return {
    ok: true,
    start,
    end: pos,
    frames,
    durationSec: samples / first.sampleRate,
  };
}

// -----------------------------------------------------------------------------
// Kontrak route ↔ editor
// -----------------------------------------------------------------------------

/**
 * Alasan penolakan `POST /api/invitations/[id]/music`. Editor memetakan
 * masing-masing ke `copy.editor.customMusic.errors[...]`.
 */
export type CustomMusicUploadError =
  | "invalid" // id/asal/header/Content-Length/body tak sah
  | "attest" // pernyataan hak tak dicentang / versinya usang
  | "size" // lebih dari CUSTOM_MUSIC_MAX_BYTES
  | "auth"
  | "rate"
  | "plan" // bukan Premium
  | "locked" // dikunci admin sesudah takedown
  | "quota" // > CUSTOM_MUSIC_UPLOADS_PER_DAY dalam 24 jam
  | "format"
  | "corrupt"
  | "short"
  | "long"
  | "server";

/**
 * Hasil route unggah. Seperti video, route TIDAK menulis `content`: editor
 * menaruh `{ path, name }` ke `content.customMusic` dan AUTOSAVE yang
 * menyimpannya. (Route menulis baris `music_uploads` — catatan unggah.)
 */
export type CustomMusicUploadResult =
  | { status: "success"; path: string; url: string; durationSec: number }
  | { status: "error"; reason: CustomMusicUploadError };
