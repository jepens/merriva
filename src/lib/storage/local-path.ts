import { resolve } from "node:path";

import { AUDIO_MIME_EXT } from "@/lib/audio";
import {
  ENCODE_EXT,
  ENCODE_MIME,
  type EncodedFormat,
} from "@/lib/image/encode";

/**
 * Aturan path untuk driver storage `local` (SPEC §6.4) — MURNI, tanpa I/O.
 *
 * Dipakai DUA pihak yang harus tak pernah berbeda pendapat: driver yang menulis
 * berkas ke disk, dan route `/media/[...path]` yang menyajikannya. Bila
 * keduanya punya aturan sendiri-sendiri, celahnya muncul persis di selisihnya —
 * karena itu hanya ada satu berkas ini.
 *
 * Driver lain (`supabase`, `r2`) menitipkan keamanan path kepada vendor. Di
 * sini kita sendiri yang memegang filesystem, jadi path objek adalah input yang
 * menentukan BERKAS MANA yang terbaca: satu `..` yang lolos berarti isi
 * `/app/.env` bisa diunduh siapa pun.
 */

/**
 * Satu segmen path yang sah. Daftar-putih, bukan daftar-hitam: path objek di
 * produk ini hanya pernah berisi UUID, hash heksadesimal, dan nama varian
 * (`1600.webp`, `display.jpg`, `<hash>.mp3`) — jadi membatasi ke huruf, angka,
 * titik, strip, dan garis-bawah tidak menolak satu pun objek nyata, sementara
 * `/`, `\`, `%`, dan NUL tak punya jalan masuk.
 */
const SEGMEN_SAH = /^[A-Za-z0-9._-]+$/;

/**
 * Pecah path objek menjadi segmen yang sudah dipastikan aman, atau `null` bila
 * ada satu saja yang tidak.
 */
export function segmenObjek(path: string): string[] | null {
  const segmen = path.split("/").filter((s) => s.length > 0);
  if (segmen.length === 0) return null;
  for (const s of segmen) {
    // `.` dan `..` LOLOS dari SEGMEN_SAH (titik memang huruf yang sah di nama
    // berkas), jadi keduanya harus ditolak terpisah. Ini baris yang menahan
    // traversal; tanpanya daftar-putih di atas tak menolak apa pun.
    if (s === "." || s === "..") return null;
    if (!SEGMEN_SAH.test(s)) return null;
  }
  return segmen;
}

/**
 * Path objek → path berkas absolut di dalam `root`, atau `null` bila pathnya
 * tak sah. Hasilnya dijamin berada di dalam `root` karena setiap segmen sudah
 * lolos `segmenObjek` — tak ada segmen yang bisa naik satu tingkat.
 */
export function berkasObjek(root: string, path: string): string | null {
  const segmen = segmenObjek(path);
  return segmen ? resolve(root, ...segmen) : null;
}

/** `{ mime: ext }` → `{ ext: mime }`; entri PERTAMA menang (`audio/wav` sebelum
 * `audio/x-wav`) supaya nama tipe yang kanonik yang dipancarkan. */
function balik(peta: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [mime, ext] of Object.entries(peta)) {
    if (!(ext in out)) out[ext] = mime;
  }
  return out;
}

function ekstensiGambar(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of Object.keys(ENCODE_EXT) as EncodedFormat[]) {
    out[ENCODE_EXT[f]] = ENCODE_MIME[f];
  }
  return out;
}

/**
 * Ekstensi yang BOLEH keluar dari route penyaji, beserta tipe isinya. Diturunkan
 * dari dua sumber yang sudah ada (`lib/image/encode` untuk foto, `lib/audio`
 * untuk musik) supaya daftar ini tak bisa tertinggal saat format baru diterima
 * di sisi unggah.
 */
export const TIPE_ISI_PER_EKSTENSI: Readonly<Record<string, string>> = {
  ...balik(AUDIO_MIME_EXT),
  ...ekstensiGambar(),
};

/**
 * Tipe isi untuk path objek, atau `null` bila ekstensinya di luar daftar.
 *
 * Ini daftar-putih penyajian, bukan sekadar penebak tipe: berkas yang tak
 * dikenali dijawab 404 walau ada di disk. Yang ditahannya nyata — sisa unggah
 * gagal bernama `*.tmp` tak pernah bisa diunduh.
 */
export function tipeIsi(path: string): string | null {
  const titik = path.lastIndexOf(".");
  if (titik === -1) return null;
  const ext = path.slice(titik + 1).toLowerCase();
  if (!ext) return null;
  return TIPE_ISI_PER_EKSTENSI[ext] ?? null;
}
