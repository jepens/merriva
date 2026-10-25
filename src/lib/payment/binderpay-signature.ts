import "server-only";

import { createHash, createSign, createVerify } from "node:crypto";

/**
 * Tanda tangan SNAP BinderPay (RSA-SHA256 asimetris).
 *
 * Dipisah dari driver gateway-nya karena INILAH bagian yang paling mudah salah
 * dan paling mahal bila salah: tanda tangan yang meleset satu karakter ditolak
 * server dengan pesan generik, dan tak ada cara membedakannya dari kredensial
 * yang salah. Berkas ini bisa diuji sepenuhnya OFFLINE dengan pasangan kunci
 * buatan sendiri — tanpa akun, tanpa sandbox, tanpa jaringan.
 *
 * STRING-TO-SIGN (dokumentasi BinderPay, bagian "Generate Signature"):
 *
 *     {METHOD}:{endpointPath}:{sha256hex(body)}:{timestamp}
 *
 * Empat bagian, dipisah titik dua. `body` di-hash SHA-256 lalu di-hex HURUF
 * KECIL. Hasil akhirnya ditandatangani RSA-SHA256 lalu di-Base64 dan dikirim
 * sebagai header `X-SIGNATURE`.
 *
 * TIGA JEBAKAN YANG SUDAH DIANTISIPASI DI SINI:
 *
 * 1. BODI YANG DI-HASH HARUS BODI YANG DIKIRIM, BYTE PER BYTE. Dokumennya
 *    menyebut "minified, tanpa escaped slashes" — itu istilah PHP
 *    (`JSON_UNESCAPED_SLASHES`). `JSON.stringify` memang tidak meng-escape
 *    garis miring, jadi di Node cocok secara kebetulan. Tetapi agar tak
 *    bergantung pada kebetulan, fungsi di sini menerima STRING bodi yang sudah
 *    jadi dan mengembalikannya — pemanggil mengirim string yang SAMA, bukan
 *    men-stringify ulang objeknya. Serialisasi dua kali adalah cara paling
 *    umum menghasilkan tanda tangan yang "seharusnya benar".
 *
 * 2. WAKTU memakai offset, bukan `Z`. Contoh dokumennya
 *    `2024-07-16T12:11:14+07:00` — ISO 8601 beroffset, TANPA milidetik.
 *    `Date.prototype.toISOString()` menghasilkan `...T05:11:14.000Z`: zona
 *    berbeda, ada milidetik, dan huruf Z. Ketiganya mengubah string yang
 *    ditandatangani. Container kita berjalan UTC (Dockerfile tak menyetel TZ),
 *    jadi bentuk WIB harus dirakit sendiri — lihat `stempelWaktuWib`.
 *
 * 3. CALLBACK di-hash dari BODI MENTAH, bukan hasil `req.json()`. Route
 *    webhook WAJIB membaca `await req.text()` lebih dulu dan mem-parse dari
 *    string itu. Membaca JSON lalu men-stringify ulang akan mengubah urutan
 *    kunci dan spasi, dan verifikasinya gagal untuk payload yang sah.
 *
 * Kunci publik produksi mereka saat ini 1023-bit (diperiksa dengan OpenSSL,
 * 25 Okt 2026) — di bawah ambang yang layak. Itu alasan tersendiri untuk TIDAK
 * menggantungkan aktivasi pada tanda tangan callback saja; arsitektur kita
 * memang sudah memverifikasi ulang lewat cek status (SPEC §4.8).
 */

/** Bagian-bagian string yang ditandatangani. */
export interface BahanTandaTangan {
  /** `POST` / `DELETE` — huruf besar. */
  metode: string;
  /** Path endpoint apa adanya, mis. `/v1.0/qr/qr-mpm-generate`. */
  path: string;
  /** Bodi permintaan PERSIS seperti yang akan dikirim. String, bukan objek. */
  bodi: string;
  /** ISO 8601 beroffset, mis. `2026-10-25T21:04:11+07:00`. */
  waktu: string;
}

/** SHA-256 → hex huruf kecil, bentuk yang diminta BinderPay. */
export function hashBodi(bodi: string): string {
  return createHash("sha256").update(bodi, "utf8").digest("hex");
}

/**
 * Rakit string-to-sign. Diekspor terpisah dari penandatanganannya supaya test
 * bisa mengunci BENTUKNYA tanpa perlu kunci — dan supaya saat server menolak
 * tanda tangan, string ini bisa dicetak dan dibandingkan apa adanya.
 */
export function stringUntukDitandatangani(b: BahanTandaTangan): string {
  return `${b.metode.toUpperCase()}:${b.path}:${hashBodi(b.bodi)}:${b.waktu}`;
}

/** Tanda tangan RSA-SHA256 ber-Base64 untuk header `X-SIGNATURE`. */
export function tandaTangani(
  b: BahanTandaTangan,
  kunciPrivatPem: string,
): string {
  const penanda = createSign("RSA-SHA256");
  penanda.update(stringUntukDitandatangani(b), "utf8");
  penanda.end();
  return penanda.sign(kunciPrivatPem, "base64");
}

/**
 * Verifikasi tanda tangan callback BinderPay.
 *
 * `false` untuk tanda tangan yang tak cocok DAN untuk kunci/tanda tangan yang
 * rusak bentuknya — pemanggil tak perlu membedakan keduanya, dan `createVerify`
 * melempar pada Base64 yang tak sah. Jalur webhook tak boleh bisa dijatuhkan
 * oleh masukan yang dikarang.
 */
export function verifikasiTandaTangan(
  b: BahanTandaTangan,
  tandaTanganBase64: string,
  kunciPublikPem: string,
): boolean {
  try {
    const pemeriksa = createVerify("RSA-SHA256");
    pemeriksa.update(stringUntukDitandatangani(b), "utf8");
    pemeriksa.end();
    return pemeriksa.verify(kunciPublikPem, tandaTanganBase64, "base64");
  } catch {
    return false;
  }
}

/** Toleransi kemiringan jam untuk `X-TIMESTAMP` callback — anjuran BinderPay. */
export const TOLERANSI_WAKTU_MS = 5 * 60 * 1000;

/**
 * Apakah `X-TIMESTAMP` callback masih dalam toleransi?
 *
 * Dipisah dan diekspor karena ini pertahanan ULANG-KIRIM (replay), bukan detail
 * format: tanda tangan BinderPay tidak memuat nonce, jadi tanpa gerbang waktu
 * satu callback sah yang pernah tertangkap bisa diputar ulang selamanya.
 */
export function waktuMasukToleransi(
  waktuHeader: string,
  sekarangMs: number,
): boolean {
  const t = Date.parse(waktuHeader);
  if (Number.isNaN(t)) return false;
  return Math.abs(sekarangMs - t) <= TOLERANSI_WAKTU_MS;
}

/**
 * Stempel waktu ISO 8601 beroffset WIB (+07:00), tanpa milidetik.
 *
 * Mengikuti bentuk contoh dokumentasi PERSIS. Tidak memakai
 * `toISOString()` (menghasilkan `Z` + milidetik) dan tidak bergantung pada zona
 * waktu host — container produksi berjalan UTC, dan nilai yang dihasilkan harus
 * sama apa pun zona mesinnya, karena ia ikut ditandatangani.
 */
export function stempelWaktuWib(sekarangMs: number): string {
  const OFFSET_WIB_MENIT = 7 * 60;
  const d = new Date(sekarangMs + OFFSET_WIB_MENIT * 60_000);
  const p = (n: number, lebar = 2) => String(n).padStart(lebar, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}` +
    `+07:00`
  );
}
