import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  hashBodi,
  stempelWaktuWib,
  stringUntukDitandatangani,
  tandaTangani,
  TOLERANSI_WAKTU_MS,
  verifikasiTandaTangan,
  waktuMasukToleransi,
} from "@/lib/payment/binderpay-signature";

/**
 * Tanda tangan SNAP BinderPay, diuji SEPENUHNYA OFFLINE.
 *
 * Kenapa berkas ini ada sebelum sisa integrasinya: tanda tangan adalah bagian
 * yang paling mudah salah dan paling sulit didiagnosis. Server menolaknya
 * dengan pesan generik, dan "tanda tangan meleset satu karakter" tak bisa
 * dibedakan dari "kredensial salah". Mengunci bentuknya di sini berarti saat
 * sandbox menolak kita, kita tahu bukan ini sebabnya.
 *
 * Pasangan kunci dibuat di dalam test — tak ada kunci sungguhan, tak ada akun,
 * tak ada jaringan. Seluruh berkas ini tetap hijau sebelum pemilik punya
 * kredensial apa pun.
 */

// 2048-bit: di ATAS kunci produksi BinderPay yang ternyata 1023-bit (diperiksa
// dengan OpenSSL). Test memakai ukuran yang semestinya; kalau kelak mereka
// menaikkan kuncinya, kode kita sudah terbukti bekerja di sana.
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const { privateKey: kunciLain } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const BAHAN = {
  metode: "POST",
  path: "/v1.0/qr/qr-mpm-generate",
  bodi: '{"partnerReferenceNo":"MRV-8F3K2","amount":{"value":"99000.00","currency":"IDR"}}',
  waktu: "2026-10-25T21:04:11+07:00",
};

describe("string-to-sign", () => {
  it("bentuknya METHOD:path:sha256hex:waktu", () => {
    // Dikunci lewat regex, BUKAN `split(":")` — dan itu bukan selera.
    // Stempel waktunya sendiri memuat titik dua (`21:04:11`), jadi pemisah
    // string ini ambigu: memecahnya menghasilkan enam bagian, bukan empat.
    // Tak masalah bagi kita yang hanya MERAKIT, tetapi penting diketahui saat
    // membandingkan string ini dengan milik mereka ketika debugging.
    expect(stringUntukDitandatangani(BAHAN)).toMatch(
      /^POST:\/v1\.0\/qr\/qr-mpm-generate:[0-9a-f]{64}:2026-10-25T21:04:11\+07:00$/,
    );
  });

  it("metode di-UPPERCASE, karena itu yang ditandatangani", () => {
    expect(
      stringUntukDitandatangani({ ...BAHAN, metode: "post" }).startsWith(
        "POST:",
      ),
    ).toBe(true);
  });

  it("hashBodi = SHA-256 hex huruf kecil (vektor yang diketahui)", () => {
    expect(hashBodi("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("satu spasi beda di bodi mengubah hash — sebab paling umum tanda tangan ditolak", () => {
    // Inilah alasan modul ini menerima STRING, bukan objek: men-stringify ulang
    // objek yang sama bisa menghasilkan byte berbeda, dan tanda tangannya
    // "seharusnya benar" tetapi ditolak.
    expect(hashBodi('{"a":1}')).not.toBe(hashBodi('{"a": 1}'));
  });
});

describe("tanda tangan", () => {
  it("ditandatangani lalu diverifikasi — bolak-balik", () => {
    const t = tandaTangani(BAHAN, privateKey);
    expect(t).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64
    expect(verifikasiTandaTangan(BAHAN, t, publicKey)).toBe(true);
  });

  it.each([
    ["bodi diubah", { bodi: BAHAN.bodi.replace("99000", "10000") }],
    ["waktu diubah", { waktu: "2026-10-25T21:04:12+07:00" }],
    ["path diubah", { path: "/v1.0/qr/qr-mpm-query" }],
    ["metode diubah", { metode: "DELETE" }],
  ])("%s → verifikasi GAGAL", (_n, ubah) => {
    const t = tandaTangani(BAHAN, privateKey);
    expect(verifikasiTandaTangan({ ...BAHAN, ...ubah }, t, publicKey)).toBe(
      false,
    );
  });

  it("nominal yang dipalsukan tertangkap — ini inti pertahanannya", () => {
    // Penyerang menurunkan 99.000 jadi 10.000 pada callback. Tanda tangan
    // menutupi bodi, jadi perubahan apa pun memutuskannya.
    const asli = tandaTangani(BAHAN, privateKey);
    const palsu = { ...BAHAN, bodi: BAHAN.bodi.replace("99000.00", "1.00") };
    expect(verifikasiTandaTangan(palsu, asli, publicKey)).toBe(false);
  });

  it("ditandatangani kunci LAIN → gagal", () => {
    expect(
      verifikasiTandaTangan(BAHAN, tandaTangani(BAHAN, kunciLain), publicKey),
    ).toBe(false);
  });

  it.each([
    ["base64 rusak", "bukan-base64-!!!", undefined],
    ["tanda tangan kosong", "", undefined],
    ["PEM rusak", "AAAA", "bukan pem sama sekali"],
  ])("%s → false, BUKAN lemparan", (_n, tt, pem) => {
    // Jalur webhook tak boleh bisa dijatuhkan masukan karangan: `createVerify`
    // melempar pada Base64/PEM tak sah, dan 500 di webhook membuat gateway
    // mengulang kirim selamanya.
    expect(() =>
      verifikasiTandaTangan(BAHAN, tt, pem ?? publicKey),
    ).not.toThrow();
    expect(verifikasiTandaTangan(BAHAN, tt, pem ?? publicKey)).toBe(false);
  });
});

describe("gerbang waktu (anti ulang-kirim)", () => {
  const T = Date.parse("2026-10-25T14:04:11Z");

  it("di dalam toleransi → lolos", () => {
    expect(waktuMasukToleransi("2026-10-25T21:04:11+07:00", T)).toBe(true);
    expect(waktuMasukToleransi("2026-10-25T21:08:11+07:00", T)).toBe(true);
  });

  it("lebih dari 5 menit, KEDUA arah → ditolak", () => {
    // Tanda tangan BinderPay tak memuat nonce. Tanpa gerbang ini, satu callback
    // sah yang pernah tertangkap bisa diputar ulang selamanya.
    expect(waktuMasukToleransi("2026-10-25T20:58:10+07:00", T)).toBe(false);
    expect(waktuMasukToleransi("2026-10-25T21:09:12+07:00", T)).toBe(false);
  });

  it("waktu tak terbaca → ditolak, bukan dianggap sah", () => {
    expect(waktuMasukToleransi("kemarin sore", T)).toBe(false);
    expect(waktuMasukToleransi("", T)).toBe(false);
  });

  it("toleransinya memang 5 menit", () => {
    expect(TOLERANSI_WAKTU_MS).toBe(300_000);
  });
});

describe("stempel waktu WIB", () => {
  it("bentuknya persis contoh dokumentasi: beroffset, tanpa milidetik", () => {
    // `toISOString()` memberi `2026-10-25T14:04:11.000Z` — zona lain, ada
    // milidetik, huruf Z. Ketiganya mengubah string yang ditandatangani.
    expect(stempelWaktuWib(Date.parse("2026-10-25T14:04:11Z"))).toBe(
      "2026-10-25T21:04:11+07:00",
    );
  });

  it("menyeberang tanggal dengan benar", () => {
    expect(stempelWaktuWib(Date.parse("2026-10-25T17:30:00Z"))).toBe(
      "2026-10-26T00:30:00+07:00",
    );
  });

  it("hasilnya tetap sah dibaca ulang oleh gerbang waktunya sendiri", () => {
    const now = Date.parse("2026-10-25T14:04:11Z");
    expect(waktuMasukToleransi(stempelWaktuWib(now), now)).toBe(true);
  });
});
