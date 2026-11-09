import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CUSTOM_MUSIC_MAX_BYTES,
  parseMp3,
  validateCustomMusicDuration,
  validateCustomMusicFile,
} from "@/lib/custom-music";

/**
 * Parser MP3 musik unggahan (DECISIONS #121) — penegak di server: yang disimpan
 * HANYA `bytes.subarray(start, end)`, dan durasi batas 10 dtk–7 menit dihitung
 * dari frame yang sama. Dua sumber uji:
 *
 *  - frame SINTETIS (header dibangun byte demi byte) untuk setiap cabang
 *    penolakan yang tak bisa dihasilkan encoder sungguhan;
 *  - fixture NYATA dari ffmpeg (`tests/fixtures/audio/README.md`) supaya
 *    parser diuji terhadap keluaran encoder, bukan hanya terhadap bayangan
 *    penulisnya sendiri tentang bentuk MP3.
 */

// Akar repo. BUKAN `import.meta.url`: environment test adalah jsdom.
const FIXTURE = join(process.cwd(), "tests", "fixtures", "audio");
const fixture = (nama: string) =>
  new Uint8Array(readFileSync(join(FIXTURE, nama)));

// -----------------------------------------------------------------------------
// Pembangun byte
// -----------------------------------------------------------------------------

type FrameOpts = {
  /** Bit versi: 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5, 1 = reserved. */
  version?: number;
  /** Bit layer: 1 = Layer III, 2 = Layer II, 3 = Layer I. */
  layer?: number;
  bitrateIndex?: number;
  sampleRateIndex?: number;
  padding?: 0 | 1;
  emphasis?: number;
};

const BR_V1 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const BR_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SR_V1 = [44100, 48000, 32000];
const SR_V2 = [22050, 24000, 16000];

/** Satu frame Layer III ber-payload nol (nol tak pernah membentuk sync palsu). */
function frame(opts: FrameOpts = {}): Uint8Array {
  const {
    version = 3,
    layer = 1,
    bitrateIndex = 9,
    sampleRateIndex = 0,
    padding = 0,
    emphasis = 0,
  } = opts;
  const v1 = version === 3;
  const kbps = (v1 ? BR_V1 : BR_V2)[bitrateIndex] ?? 128;
  const sr = (v1 ? SR_V1 : SR_V2)[sampleRateIndex] ?? 44100;
  const len =
    Math.floor(((v1 ? 144000 : 72000) * (kbps || 128)) / sr) + padding;
  const f = new Uint8Array(len);
  f[0] = 0xff;
  f[1] = 0xe0 | (version << 3) | (layer << 1) | 1;
  f[2] = (bitrateIndex << 4) | (sampleRateIndex << 2) | (padding << 1);
  f[3] = 0xc0 | emphasis; // mono
  return f;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function frames(n: number, opts: FrameOpts = {}): Uint8Array {
  return concat(...Array.from({ length: n }, () => frame(opts)));
}

function syncsafe(size: number): number[] {
  return [
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f,
  ];
}

/** Tag ID3v2 dengan isi `body` (bawaan: nol sepanjang `size`). */
function id3v2(
  major: number,
  size: number,
  opts: { footer?: boolean; sizeBytes?: number[]; body?: Uint8Array } = {},
): Uint8Array {
  const flags = opts.footer ? 0x10 : 0;
  const header = new Uint8Array([
    0x49,
    0x44,
    0x33,
    major,
    0,
    flags,
    ...(opts.sizeBytes ?? syncsafe(size)),
  ]);
  const body = opts.body ?? new Uint8Array(size);
  const footer = opts.footer
    ? new Uint8Array([0x33, 0x44, 0x49, major, 0, flags, ...syncsafe(size)])
    : new Uint8Array(0);
  return concat(header, body, footer);
}

const ascii = (s: string) => new TextEncoder().encode(s);

function id3v1(): Uint8Array {
  const t = new Uint8Array(128);
  t.set(ascii("TAGJudul Lagu"));
  return t;
}

/** Sampah tanpa byte 0xFF — tak bisa membentuk header frame palsu. */
function sampah(n: number): Uint8Array {
  return new Uint8Array(n).fill(0x41);
}

/** 128 kbps @ 44,1 kHz: 417 B per frame, 1152 sampel. */
const LEN_128 = 417;
const DETIK_PER_FRAME = 1152 / 44100;

function expectOk(r: ReturnType<typeof parseMp3>) {
  if (!r.ok) throw new Error(`diharapkan ok, dapat ${r.reason}`);
  return r;
}

// -----------------------------------------------------------------------------
// Fixture nyata
// -----------------------------------------------------------------------------

/**
 * Durasi acuan = `ffprobe -show_entries format=duration` (ffmpeg 8.1.2) atas
 * byte yang DISIMPAN (sesudah normalisasi). Untuk `id3-cover.mp3` ffprobe atas
 * berkas aslinya membaca 11,578 dtk karena memperkirakan dari bitrate termasuk
 * byte tag; atas byte ternormalisasi 11,546 dtk.
 *
 * Selisih VBR (≈0,09 dtk) = frame Xing (1 frame, 36 ms di 32 kHz) + jeda
 * encoder yang dipangkas ffprobe dari tag LAME tetapi masih frame audio
 * sungguhan — durasi parser = jumlah frame yang akan diputar peramban.
 */
const NYATA = [
  { nama: "cbr-mpeg1.mp3", ffprobe: 11.546, tag: 0, ekor: 0 },
  { nama: "vbr-xing.mp3", ffprobe: 11.5, tag: 0, ekor: 0 },
  { nama: "mpeg2-22k.mp3", ffprobe: 11.572333, tag: 0, ekor: 0 },
  { nama: "id3-cover.mp3", ffprobe: 11.546, tag: 412, ekor: 128 },
  { nama: "short-3s.mp3", ffprobe: 3.03025, tag: 0, ekor: 0 },
] as const;

describe("parseMp3 — fixture nyata ffmpeg", () => {
  it.each(NYATA)(
    "$nama: rantai frame utuh, durasi ±0,1 dtk dari ffprobe",
    ({ nama, ffprobe, tag, ekor }) => {
      const b = fixture(nama);
      const r = expectOk(parseMp3(b));
      expect(r.start).toBe(tag);
      expect(r.end).toBe(b.length - ekor);
      expect(Math.abs(r.durationSec - ffprobe)).toBeLessThanOrEqual(0.1);
      // Byte yang disimpan dimulai dengan sync frame, bukan tag.
      expect(b[r.start]).toBe(0xff);
      expect(b[r.start + 1]! & 0xe0).toBe(0xe0);
    },
  );

  it("VBR Xing: frame berukuran beragam tetap satu rantai, frame Xing ikut disimpan", () => {
    const b = fixture("vbr-xing.mp3");
    const r = expectOk(parseMp3(b));
    // Frame Xing (berisi daftar seek VBR) ada di frame pertama — dipertahankan
    // agar peramban tetap bisa menghitung durasi & melompat di lagu VBR.
    expect(
      new TextDecoder().decode(b.subarray(r.start, r.start + 64)),
    ).toContain("Xing");
    // VBR sungguhan: telusuri ulang secara mandiri (MPEG-1 32 kHz, tanpa
    // padding) — fixture-nya benar-benar memuat beberapa bitrate, dan rantai
    // parser berhenti di frame yang sama.
    const bitrates = new Set<number>();
    let pos = r.start;
    let n = 0;
    while (pos + 4 <= r.end) {
      const idx = b[pos + 2]! >> 4;
      bitrates.add(idx);
      pos +=
        Math.floor((144000 * BR_V1[idx]!) / 32000) + ((b[pos + 2]! >> 1) & 1);
      n++;
    }
    expect(bitrates.size).toBeGreaterThan(2);
    expect(pos).toBe(r.end);
    expect(n).toBe(r.frames);
  });

  it("ID3v2.3 + sampul APIC + ID3v1: tag & sampul dibuang, start tepat sesudah tag", () => {
    const b = fixture("id3-cover.mp3");
    const ukuranTag =
      10 + ((b[6]! << 21) | (b[7]! << 14) | (b[8]! << 7) | b[9]!);
    expect(new TextDecoder().decode(b.subarray(0, 3))).toBe("ID3");
    expect(b[3]).toBe(3);
    const r = expectOk(parseMp3(b));
    expect(r.start).toBe(ukuranTag);

    const disimpan = new TextDecoder("latin1").decode(
      b.subarray(r.start, r.end),
    );
    const asli = new TextDecoder("latin1").decode(b);
    expect(asli).toContain("APIC");
    expect(asli.slice(-128, -125)).toBe("TAG");
    expect(disimpan).not.toContain("APIC");
    expect(disimpan).not.toContain("Lagu Uji");
    expect(disimpan.slice(-128, -125)).not.toBe("TAG");
  });

  it.each([
    ["aac.m4a", "M4A/AAC"],
    ["vorbis.ogg", "OGG Vorbis"],
    ["short.wav", "WAV"],
  ])("%s (%s) → format", (nama) => {
    expect(parseMp3(fixture(nama))).toEqual({ ok: false, reason: "format" });
  });

  it("MP3 3 dtk diterima parser — durasinya ditolak validateCustomMusicDuration", () => {
    const r = expectOk(parseMp3(fixture("short-3s.mp3")));
    expect(validateCustomMusicDuration(r.durationSec)).toBe("short");
  });
});

// -----------------------------------------------------------------------------
// Frame sintetis — diterima
// -----------------------------------------------------------------------------

describe("parseMp3 — sintetis, diterima", () => {
  it("CBR MPEG-1 polos: durasi = frame × 1152 / 44100", () => {
    const b = frames(500);
    const r = expectOk(parseMp3(b));
    expect(r).toMatchObject({ start: 0, end: 500 * LEN_128, frames: 500 });
    expect(r.durationSec).toBeCloseTo(500 * DETIK_PER_FRAME, 9);
  });

  it("frame ber-padding (418 B) dihitung panjangnya dengan benar", () => {
    const b = concat(
      ...Array.from({ length: 40 }, (_, i) =>
        frame({ padding: (i % 3 === 0 ? 1 : 0) as 0 | 1 }),
      ),
    );
    const r = expectOk(parseMp3(b));
    expect(r.end).toBe(b.length);
    expect(r.frames).toBe(40);
  });

  it("VBR (bitrate berganti antar-frame) tetap satu rantai", () => {
    const idx = [9, 5, 14, 1, 11, 9, 3, 13];
    const b = concat(
      ...Array.from({ length: 64 }, (_, i) =>
        frame({ bitrateIndex: idx[i % idx.length]! }),
      ),
    );
    expect(expectOk(parseMp3(b))).toMatchObject({ end: b.length, frames: 64 });
  });

  it("MPEG-2 22,05 kHz: 576 sampel per frame", () => {
    const b = frames(100, { version: 2, bitrateIndex: 3, sampleRateIndex: 0 });
    const r = expectOk(parseMp3(b));
    expect(r.frames).toBe(100);
    expect(r.durationSec).toBeCloseTo((100 * 576) / 22050, 9);
  });

  it.each([
    [44100, 0],
    [48000, 1],
    [32000, 2],
  ])("MPEG-1 %i Hz", (sr, sampleRateIndex) => {
    const r = expectOk(parseMp3(frames(20, { sampleRateIndex })));
    expect(r.durationSec).toBeCloseTo((20 * 1152) / sr, 9);
  });

  it("ID3v2.3: start = 10 + ukuran tag", () => {
    const tag = id3v2(3, 5000);
    const r = expectOk(parseMp3(concat(tag, frames(30))));
    expect(r.start).toBe(5010);
    expect(r.frames).toBe(30);
  });

  it("sampul > 64 KiB di dalam tag tetap dilompati (bukan dicari sebagai sampah)", () => {
    const tag = id3v2(3, 100_000);
    const r = expectOk(parseMp3(concat(tag, frames(30))));
    expect(r.start).toBe(100_010);
  });

  it("pola sync palsu di dalam data sampul TIDAK dianggap audio", () => {
    // Data gambar bisa memuat byte yang kebetulan membentuk dua header frame
    // berurutan. Tag dilompati menurut ukurannya, jadi isinya tak pernah
    // dipindai — start tetap di frame sungguhan sesudah tag.
    const palsu = concat(new Uint8Array(500), frames(3), new Uint8Array(500));
    const tag = id3v2(3, palsu.length, { body: palsu });
    const r = expectOk(parseMp3(concat(tag, frames(30))));
    expect(r.start).toBe(tag.length);
    expect(r.frames).toBe(30);
  });

  it("satu header palsu di sampah depan dilewati — butuh DUA header berurutan", () => {
    const depan = concat(sampah(1000), frame().subarray(0, 4), sampah(1000));
    const r = expectOk(parseMp3(concat(depan, frames(30))));
    expect(r.start).toBe(depan.length);
    expect(r.frames).toBe(30);
  });

  it("ID3v2.4 dengan footer: footer 10 B ikut dilompati", () => {
    const tag = id3v2(4, 777, { footer: true });
    expect(tag.length).toBe(797);
    const r = expectOk(parseMp3(concat(tag, frames(30))));
    expect(r.start).toBe(797);
  });

  it("jendela 64 KiB dihitung SESUDAH tag + footer: tepat di batas diterima, lewat 1 B → format", () => {
    const tag = id3v2(4, 50, { footer: true });
    const pas = concat(tag, new Uint8Array(64 * 1024), frames(30));
    expect(expectOk(parseMp3(pas)).start).toBe(tag.length + 64 * 1024);
    const lewat = concat(tag, new Uint8Array(64 * 1024 + 1), frames(30));
    expect(parseMp3(lewat)).toEqual({ ok: false, reason: "format" });
  });

  it("flag footer di ID3v2.3 TIDAK berarti footer (hanya v2.4)", () => {
    // v2.3 tak punya footer: bit 0x10 di sana dipakai untuk hal lain.
    const tag = id3v2(3, 300);
    tag[5] = 0x10;
    const r = expectOk(parseMp3(concat(tag, frames(30))));
    expect(r.start).toBe(310);
  });

  it("beberapa tag ID3v2 berurutan semuanya dilompati", () => {
    const b = concat(id3v2(3, 100), id3v2(4, 200), frames(30));
    expect(expectOk(parseMp3(b)).start).toBe(110 + 210);
  });

  it("padding nol sesudah tag ID3 dibuang (start = frame pertama)", () => {
    const b = concat(id3v2(3, 100), new Uint8Array(3000), frames(30));
    expect(expectOk(parseMp3(b)).start).toBe(110 + 3000);
  });

  it("ID3v1 (128 B) di ekor dibuang", () => {
    const audio = frames(30);
    const b = concat(audio, id3v1());
    const r = expectOk(parseMp3(b));
    expect(r.end).toBe(audio.length);
    expect(b.length - r.end).toBe(128);
  });

  it("frame terakhir terpotong → masuk ekor, tidak ikut disimpan", () => {
    const b = concat(frames(30), frame().subarray(0, 200));
    const r = expectOk(parseMp3(b));
    expect(r.end).toBe(30 * LEN_128);
    expect(r.frames).toBe(30);
  });

  it("sampah ≤ 256 KiB sesudah frame diterima dan TIDAK ikut start..end", () => {
    const audio = frames(30);
    const b = concat(audio, sampah(256 * 1024));
    const r = expectOk(parseMp3(b));
    expect(r.start).toBe(0);
    expect(r.end).toBe(audio.length);
  });

  it("poliglot: HTML di depan (dalam 64 KiB) dibuang dari byte yang disimpan", () => {
    const html = ascii(
      `<!doctype html><html><body><script>alert(document.domain)</script>${"x".repeat(30_000)}</body></html>`,
    );
    const b = concat(html, frames(30), ascii("<script>ekor()</script>"));
    const r = expectOk(parseMp3(b));
    expect(r.start).toBe(html.length);
    const disimpan = new TextDecoder("latin1").decode(
      b.subarray(r.start, r.end),
    );
    expect(disimpan).not.toContain("<");
  });

  it("poliglot: arsip/HTML disisipkan di frame GEOB ID3 ikut terbuang", () => {
    const sisipan = concat(ascii("GEOB"), ascii("PK\u0003\u0004<html>"));
    const tag = id3v2(3, sisipan.length, { body: sisipan });
    const r = expectOk(parseMp3(concat(tag, frames(30))));
    expect(r.start).toBe(tag.length);
  });
});

// -----------------------------------------------------------------------------
// Frame sintetis — ditolak
// -----------------------------------------------------------------------------

describe("parseMp3 — sintetis, ditolak", () => {
  const FORMAT = { ok: false, reason: "format" } as const;
  const CORRUPT = { ok: false, reason: "corrupt" } as const;

  it("buffer kosong / sangat pendek → format", () => {
    expect(parseMp3(new Uint8Array(0))).toEqual(FORMAT);
    expect(parseMp3(new Uint8Array([0xff, 0xfb, 0x90]))).toEqual(FORMAT);
  });

  it("byte ukuran ID3 ≥ 0x80 (bukan syncsafe) → corrupt", () => {
    // Dibaca sebagai bilangan biasa, ukuran ini (128) MASIH di dalam buffer
    // dan berkasnya akan lolos — yang menolaknya hanya pemeriksaan bit 0x80.
    const tag = id3v2(3, 0, { sizeBytes: [0, 0, 0, 0x80] });
    expect(parseMp3(concat(tag, frames(30)))).toEqual(CORRUPT);
  });

  it("ukuran ID3 melewati akhir buffer → corrupt", () => {
    const tag = id3v2(3, 0, { sizeBytes: syncsafe(1_000_000) });
    expect(parseMp3(concat(tag, frames(30)))).toEqual(CORRUPT);
  });

  it.each([
    ["versi mayor 5", 5],
    ["versi mayor 1", 1],
  ])("ID3 %s → corrupt", (_n, major) => {
    expect(parseMp3(concat(id3v2(major, 10), frames(30)))).toEqual(CORRUPT);
  });

  it("revisi ID3 0xFF → corrupt", () => {
    const tag = id3v2(3, 10);
    tag[4] = 0xff;
    expect(parseMp3(concat(tag, frames(30)))).toEqual(CORRUPT);
  });

  it("hanya SATU frame sah lalu sampah → format (satu header bisa kebetulan)", () => {
    expect(parseMp3(concat(frame(), sampah(5000)))).toEqual(FORMAT);
  });

  it("satu frame utuh + header frame kedua yang terpotong → format", () => {
    // Header kedua sah (lolos pencarian sync) tetapi badannya melewati akhir
    // berkas: rantai hanya punya SATU frame utuh. Ditemukan fuzz mutasi.
    const b = concat(frame(), frame().subarray(0, 100));
    expect(parseMp3(b)).toEqual(FORMAT);
  });

  it("Layer II → format", () => {
    expect(parseMp3(frames(30, { layer: 2 }))).toEqual(FORMAT);
  });

  it("Layer I → format", () => {
    expect(parseMp3(frames(30, { layer: 3 }))).toEqual(FORMAT);
  });

  it("MPEG-2.5 → format", () => {
    expect(parseMp3(frames(30, { version: 0 }))).toEqual(FORMAT);
  });

  it("versi reserved → format", () => {
    expect(parseMp3(frames(30, { version: 1 }))).toEqual(FORMAT);
  });

  it.each([
    ["0 (free format)", 0],
    ["15 (terlarang)", 15],
  ])("bitrate index %s → format", (_n, bitrateIndex) => {
    expect(parseMp3(frames(30, { bitrateIndex }))).toEqual(FORMAT);
  });

  it("sample rate index 3 (reserved) → format", () => {
    expect(parseMp3(frames(30, { sampleRateIndex: 3 }))).toEqual(FORMAT);
  });

  it("emphasis reserved (2) → format", () => {
    expect(parseMp3(frames(30, { emphasis: 2 }))).toEqual(FORMAT);
  });

  it("ekor sampah > 256 KiB (rantai putus di tengah) → corrupt", () => {
    const b = concat(frames(30), sampah(256 * 1024 + 1));
    expect(parseMp3(b)).toEqual(CORRUPT);
  });

  it("sample rate berganti di tengah lagu → rantai putus → corrupt", () => {
    // Dua lagu berbeda yang disambung: sisa sesudah sambungan > 256 KiB.
    const b = concat(frames(30), frames(700, { sampleRateIndex: 1 }));
    expect(parseMp3(b)).toEqual(CORRUPT);
  });

  it("HTML di depan LEBIH dari 64 KiB → format (tak dicari sejauh itu)", () => {
    const b = concat(sampah(64 * 1024 + 1), frames(30));
    expect(parseMp3(b)).toEqual(FORMAT);
  });
});

// -----------------------------------------------------------------------------
// Fuzz
// -----------------------------------------------------------------------------

/** PRNG deterministik (mulberry32) — kegagalan fuzz selalu bisa diulang. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cekBentuk(b: Uint8Array, r: ReturnType<typeof parseMp3>) {
  if (r.ok) {
    expect(r.start).toBeGreaterThanOrEqual(0);
    expect(r.end).toBeGreaterThan(r.start);
    expect(r.end).toBeLessThanOrEqual(b.length);
    expect(r.frames).toBeGreaterThanOrEqual(2);
    expect(r.durationSec).toBeGreaterThan(0);
    expect(Number.isFinite(r.durationSec)).toBe(true);
  } else {
    expect(["format", "corrupt"]).toContain(r.reason);
  }
}

describe("parseMp3 — fuzz (seed tetap) tak pernah melempar", () => {
  it("600 buffer acak, sebagian berawalan ID3 / sync frame", () => {
    const rnd = mulberry32(0x6d657272);
    for (let i = 0; i < 600; i++) {
      const b = new Uint8Array(Math.floor(rnd() * 6000));
      for (let k = 0; k < b.length; k++) b[k] = Math.floor(rnd() * 256);
      const mode = i % 4;
      if (mode === 1 && b.length >= 10) b.set([0x49, 0x44, 0x33, 3, 0], 0);
      if (mode === 2 && b.length >= 4) b.set([0xff, 0xfb, 0x90, 0xc0], 0);
      if (mode === 3) {
        // Taburi header sah di posisi acak → menguji cabang rantai.
        for (let s = 0; s + 4 <= b.length; s += 1 + Math.floor(rnd() * 400))
          b.set([0xff, 0xfb, 0x90, 0xc0], s);
      }
      let r: ReturnType<typeof parseMp3> | undefined;
      expect(() => {
        r = parseMp3(b);
      }).not.toThrow();
      cekBentuk(b, r!);
    }
  });

  it("300 mutasi acak atas fixture nyata (byte dibalik/dipotong)", () => {
    const rnd = mulberry32(0x00c0ffee);
    const asal = [fixture("cbr-mpeg1.mp3"), fixture("id3-cover.mp3")];
    for (let i = 0; i < 300; i++) {
      const src = asal[i % 2]!;
      const b = src.slice(0, Math.max(1, Math.floor(rnd() * src.length)));
      const ubah = 1 + Math.floor(rnd() * 20);
      for (let k = 0; k < ubah; k++)
        b[Math.floor(rnd() * b.length)] = Math.floor(rnd() * 256);
      let r: ReturnType<typeof parseMp3> | undefined;
      expect(() => {
        r = parseMp3(b);
      }).not.toThrow();
      cekBentuk(b, r!);
    }
  });
});

// -----------------------------------------------------------------------------
// Validasi tanpa membaca isi
// -----------------------------------------------------------------------------

describe("validateCustomMusicFile", () => {
  const MB8 = CUSTOM_MUSIC_MAX_BYTES;

  it.each([
    ["audio/mpeg", "lagu.mp3"],
    ["audio/mp3", "lagu.mp3"],
    ["AUDIO/MPEG", "lagu.bin"],
    ["", "lagu.mp3"],
    ["", "LAGU.MP3"],
    ["application/octet-stream", "lagu.mp3"],
  ])("tipe %j + nama %s → diterima", (type, name) => {
    expect(validateCustomMusicFile({ name, type, size: 1000 })).toBeNull();
  });

  it.each([
    ["audio/mp4", "rekaman.m4a"],
    ["audio/mp4", "menyamar.mp3"],
    ["audio/x-m4a", "rekaman.m4a"],
    ["audio/wav", "lagu.wav"],
    ["audio/ogg", "lagu.ogg"],
    ["", "lagu.m4a"],
    ["application/octet-stream", "lagu.mp3.exe"],
    ["text/html", "lagu.mp3"],
  ])("tipe %j + nama %s → type", (type, name) => {
    expect(validateCustomMusicFile({ name, type, size: 1000 })).toBe("type");
  });

  it("0 byte / ukuran tak sah → empty", () => {
    const f = { name: "a.mp3", type: "audio/mpeg" };
    expect(validateCustomMusicFile({ ...f, size: 0 })).toBe("empty");
    expect(validateCustomMusicFile({ ...f, size: Number.NaN })).toBe("empty");
  });

  it("tepat 8 MB diterima, 8 MB + 1 → size", () => {
    const f = { name: "a.mp3", type: "audio/mpeg" };
    expect(MB8).toBe(8 * 1024 * 1024);
    expect(validateCustomMusicFile({ ...f, size: MB8 })).toBeNull();
    expect(validateCustomMusicFile({ ...f, size: MB8 + 1 })).toBe("size");
  });
});

describe("validateCustomMusicDuration", () => {
  it.each([
    [9.99, "short"],
    [10, null],
    [10.01, null],
    [180, null],
    [420, null],
    // Toleransi 1 dtk di atas: durasi per-frame membuat lagu "7:00" terbaca
    // sedikit lebih dari 420.
    [420.03, null],
    [421, null],
    [421.01, "long"],
    [3600, "long"],
  ] as const)("%f dtk → %s", (sec, hasil) => {
    expect(validateCustomMusicDuration(sec)).toBe(hasil);
  });

  it("tak terbaca (NaN / tak hingga) → ditolak", () => {
    expect(validateCustomMusicDuration(Number.NaN)).toBe("short");
    expect(validateCustomMusicDuration(Infinity)).not.toBeNull();
    expect(validateCustomMusicDuration(-1)).toBe("short");
  });
});
