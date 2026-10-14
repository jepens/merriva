import { resolve, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TIPE_ISI_PER_EKSTENSI,
  berkasObjek,
  segmenObjek,
  tipeIsi,
} from "@/lib/storage/local-path";
import { parseRange } from "@/lib/storage/range";

/**
 * Driver `supabase` dan `r2` menitipkan keamanan path kepada vendor. Driver
 * `local` tidak: path objek menentukan BERKAS MANA di disk VPS yang terbaca,
 * dan route `/media/[...path]` tak punya autentikasi apa pun — memang tak boleh
 * punya, karena tamu undangan harus bisa melihat fotonya.
 *
 * Jadi yang dijaga di sini adalah satu-satunya hal yang memisahkan "penyaji
 * foto" dari "pengunduh berkas apa saja di server": daftar-putih segmen.
 */

const ROOT = resolve("/srv/media");

describe("segmenObjek — daftar-putih path", () => {
  it("menerima path objek nyata dari ketiga penulis", () => {
    expect(
      segmenObjek("inv/85d261d6-81ff-40e8-9d09-c4e9cbe132a6/abc/1600.webp"),
    ).toEqual([
      "inv",
      "85d261d6-81ff-40e8-9d09-c4e9cbe132a6",
      "abc",
      "1600.webp",
    ]);
    expect(segmenObjek("songs/858954bda1e7a6730b511cab436b86ca.mp3")).toEqual([
      "songs",
      "858954bda1e7a6730b511cab436b86ca.mp3",
    ]);
    expect(segmenObjek("momen/a/b/display.jpg")).toEqual([
      "momen",
      "a",
      "b",
      "display.jpg",
    ]);
  });

  it("mengabaikan garis miring berlebih, bukan menolaknya", () => {
    expect(segmenObjek("/inv//x/1600.webp")).toEqual(["inv", "x", "1600.webp"]);
  });

  it.each([
    ["naik satu tingkat", "inv/../../etc/passwd"],
    ["`..` sebagai segmen pertama", "../.env"],
    ["`.` sebagai segmen", "inv/./1600.webp"],
    ["hanya titik-titik", ".."],
    ["backslash Windows", "inv\\..\\.env"],
    ["persen (sisa encoding ganda)", "inv/%2e%2e/.env"],
    ["spasi", "inv/a b/1600.webp"],
    ["tilde home", "~/.ssh/id_ed25519"],
    ["kosong", ""],
    ["hanya garis miring", "///"],
    ["NUL", "inv/a\u0000.webp"],
  ])("menolak %s", (_nama, path) => {
    expect(segmenObjek(path)).toBeNull();
  });

  it("menolak `..` meski daftar-putih mengizinkan titik", () => {
    // Titik HARUS sah (nama berkas punya ekstensi), jadi regex sendirian tidak
    // menahan traversal — cek `..` yang terpisah itulah yang menahannya. Mutan
    // yang membuang cek itu harus membunuh test ini.
    expect(/^[A-Za-z0-9._-]+$/.test("..")).toBe(true);
    expect(segmenObjek("inv/..")).toBeNull();
  });
});

describe("berkasObjek", () => {
  it("selalu menghasilkan berkas DI DALAM akar", () => {
    const berkas = berkasObjek(ROOT, "inv/x/1600.webp");
    expect(berkas).toBe(resolve(ROOT, "inv", "x", "1600.webp"));
    expect(berkas?.startsWith(ROOT + sep)).toBe(true);
  });

  it("null bila path tak sah — tak pernah menghasilkan path di luar akar", () => {
    expect(berkasObjek(ROOT, "../../etc/passwd")).toBeNull();
  });
});

describe("tipeIsi — daftar-putih penyajian", () => {
  it("mengenali format yang benar-benar ditulis produk ini", () => {
    expect(tipeIsi("inv/x/1600.webp")).toBe("image/webp");
    expect(tipeIsi("momen/a/b/display.jpg")).toBe("image/jpeg");
    expect(tipeIsi("songs/abc.mp3")).toBe("audio/mpeg");
    expect(tipeIsi("songs/abc.m4a")).toBe("audio/mp4");
  });

  it("memilih nama tipe kanonik saat satu ekstensi punya dua mime", () => {
    // AUDIO_MIME_EXT memetakan `audio/wav` DAN `audio/x-wav` ke `wav`.
    expect(TIPE_ISI_PER_EKSTENSI.wav).toBe("audio/wav");
  });

  it("menolak sisa unggah gagal `*.tmp`", () => {
    // Driver menulis `<berkas>.<uuid>.tmp` sebelum rename. Bila penyaji
    // menebak tipe dari isi atau meloloskan ekstensi tak dikenal, berkas
    // separuh-terunggah ikut bisa diunduh.
    expect(tipeIsi("inv/x/1600.webp.9f.tmp")).toBeNull();
  });

  it.each([
    "",
    ".env",
    "berkas-tanpa-ekstensi",
    "x.php",
    "x.html",
    "x.",
    // Tanpa titik sama sekali, TAPI namanya kebetulan sebuah ekstensi yang
    // dikenal. Ini satu-satunya hal yang dijaga oleh penjaga `titik === -1`:
    // tanpanya, seluruh nama berkas dipakai sebagai ekstensi dan berkas bernama
    // `mp3` ikut tersaji.
    "mp3",
    "webp",
  ])("menolak %j", (path) => {
    expect(tipeIsi(path)).toBeNull();
  });

  it("tidak peka huruf besar-kecil pada ekstensi", () => {
    expect(tipeIsi("inv/x/1600.WEBP")).toBe("image/webp");
  });
});

describe("parseRange", () => {
  const SIZE = 1000;

  it("tanpa header → berkas utuh", () => {
    expect(parseRange(null, SIZE)).toBeNull();
  });

  it("bentuk yang tak dikenali diabaikan (200), bukan 416", () => {
    // RFC 9110 §14.2: Range yang tak dipahami boleh diabaikan. Menjawab 416 di
    // sini akan mematikan pemutar yang mengirim unit selain bytes.
    expect(parseRange("items=0-10", SIZE)).toBeNull();
    expect(parseRange("bytes=abc", SIZE)).toBeNull();
    expect(parseRange("bytes=-", SIZE)).toBeNull();
  });

  it("rentang biasa", () => {
    expect(parseRange("bytes=0-99", SIZE)).toEqual({ start: 0, end: 99 });
  });

  it("tanpa batas akhir → sampai byte terakhir", () => {
    expect(parseRange("bytes=900-", SIZE)).toEqual({ start: 900, end: 999 });
  });

  it("batas akhir melewati ukuran dijepit, bukan ditolak", () => {
    expect(parseRange("bytes=900-99999", SIZE)).toEqual({
      start: 900,
      end: 999,
    });
  });

  it("bentuk sufiks = N byte terakhir", () => {
    expect(parseRange("bytes=-100", SIZE)).toEqual({ start: 900, end: 999 });
  });

  it("sufiks lebih besar dari berkas → seluruh berkas", () => {
    expect(parseRange("bytes=-99999", SIZE)).toEqual({ start: 0, end: 999 });
  });

  it.each([
    ["mulai di luar ukuran", "bytes=1000-1100"],
    ["mulai > akhir", "bytes=500-100"],
    ["sufiks nol", "bytes=-0"],
  ])("%s → 416", (_nama, raw) => {
    expect(parseRange(raw, SIZE)).toBe("invalid");
  });
});
