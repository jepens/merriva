import { beforeEach, describe, expect, it } from "vitest";

import {
  __rateLimitKeyCount,
  __resetRateLimit,
  checkRateLimit,
  checkRateLimitAll,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => __resetRateLimit());

  it("mengizinkan sampai batas lalu menolak", () => {
    const opts = { max: 3, windowMs: 1000 };
    const t0 = 1_000_000;
    expect(checkRateLimit("k", opts, t0).ok).toBe(true);
    expect(checkRateLimit("k", opts, t0).ok).toBe(true);
    expect(checkRateLimit("k", opts, t0).ok).toBe(true);
    const blocked = checkRateLimit("k", opts, t0);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);
  });

  it("jendela geser: slot pulih setelah windowMs", () => {
    const opts = { max: 1, windowMs: 1000 };
    const t0 = 2_000_000;
    expect(checkRateLimit("k", opts, t0).ok).toBe(true);
    expect(checkRateLimit("k", opts, t0 + 500).ok).toBe(false);
    expect(checkRateLimit("k", opts, t0 + 1001).ok).toBe(true);
  });

  it("kunci berbeda tak saling memengaruhi", () => {
    const opts = { max: 1, windowMs: 1000 };
    const t0 = 3_000_000;
    expect(checkRateLimit("a", opts, t0).ok).toBe(true);
    expect(checkRateLimit("b", opts, t0).ok).toBe(true);
    expect(checkRateLimit("a", opts, t0).ok).toBe(false);
  });

  it("remaining menurun sampai 0", () => {
    const opts = { max: 3, windowMs: 1000 };
    const t0 = 4_000_000;
    expect(checkRateLimit("k", opts, t0).remaining).toBe(2);
    expect(checkRateLimit("k", opts, t0).remaining).toBe(1);
    expect(checkRateLimit("k", opts, t0).remaining).toBe(0);
  });

  it("eviksi saat penuh MEMBUANG bucket kadaluarsa, bukan mereset yang aktif", () => {
    const opts = { max: 5, windowMs: 1000 };
    const now0 = 1000;
    // Isi hampir penuh dengan kunci yang AKAN kadaluarsa (hit di now0).
    const MAX_KEYS = 20_000;
    for (let i = 0; i < MAX_KEYS - 1; i += 1) {
      checkRateLimit(`old-${i}`, opts, now0);
    }
    // Korban AKTIF dua hit di jendela sekarang (now1 > now0 + window).
    const now1 = now0 + 1001;
    checkRateLimit("victim", opts, now1);
    checkRateLimit("victim", opts, now1); // count = 2 → size mencapai MAX_KEYS
    // Kunci baru memicu eviksi: sapu kunci kadaluarsa (old-*) → korban lolos.
    checkRateLimit("trigger", opts, now1);
    // Hit ke-3 korban: bila state di-clear total, remaining akan 4 (reset);
    // dengan eviksi bertahap, count terjaga → remaining = 5 - 3 = 2.
    expect(checkRateLimit("victim", opts, now1).remaining).toBe(2);
  });

  it("eviksi membuang bucket berasio isi TERENDAH dulu — penghitung yang sedang membatasi bertahan", () => {
    const t0 = 9_000_000;
    // Korban dibuat PALING AWAL dan sedang terkunci (3/3).
    const hot = { max: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i += 1) checkRateLimit("hot", hot, t0);
    expect(checkRateLimit("hot", hot, t0).ok).toBe(false);

    // Banjir kunci sampah AKTIF melampaui MAX_KEYS. Tiap kunci diisi 5 hit —
    // LEBIH banyak dari korban (3), tetapi rasio isinya jauh lebih rendah
    // (5/600): yang diukur rasio, bukan jumlah hit mentah.
    const junk = { max: 600, windowMs: 60_000 };
    for (let i = 0; i < 21_000; i += 1) {
      for (let j = 0; j < 5; j += 1) checkRateLimit(`junk-${i}`, junk, t0 + 1);
    }

    expect(__rateLimitKeyCount()).toBeLessThanOrEqual(20_000);
    // Dulu kunci TERTUA dibuang lebih dulu → korban ter-reset dan lolos lagi.
    expect(checkRateLimit("hot", hot, t0 + 2).ok).toBe(false);
  });

  it("sapu kedaluwarsa memakai jendela bucket MASING-MASING, bukan jendela pemicu", () => {
    const t0 = 10_000_000;
    const long = { max: 3, windowMs: 900_000 }; // mis. auth-reset-email
    for (let i = 0; i < 3; i += 1) checkRateLimit("long", long, t0);
    const short = { max: 5, windowMs: 1000 };
    for (let i = 0; i < 19_999; i += 1) checkRateLimit(`short-${i}`, short, t0);

    // 2 dtk kemudian: kunci berjendela 1 dtk kedaluwarsa, "long" BELUM. Dulu
    // pemicu berjendela 1 dtk ikut membuang "long" → email bisa dibom lagi.
    checkRateLimit("trigger", short, t0 + 2000);
    expect(checkRateLimit("long", long, t0 + 2000).ok).toBe(false);
  });

  it("bucket berjendela panjang yang penuh tak terbuang oleh sapu berjendela pendek", () => {
    const t0 = 14_000_000;
    const long = { max: 3, windowMs: 900_000 };
    for (let i = 0; i < 3; i += 1) checkRateLimit("long", long, t0);

    // 2 menit kemudian: banjir kunci AKTIF berjendela 60 dtk.
    const junk = { max: 600, windowMs: 60_000 };
    for (let i = 0; i < 20_500; i += 1) {
      checkRateLimit(`junk-${i}`, junk, t0 + 120_000);
    }

    expect(checkRateLimit("long", long, t0 + 120_000).ok).toBe(false);
  });

  it("bucket kedaluwarsa dibuang dulu walau 'penuh' — penghitung aktif yang baru terisi sebagian tetap utuh", () => {
    const t0 = 13_000_000;
    const live = { max: 3, windowMs: 900_000 };
    checkRateLimit("live", live, t0);
    checkRateLimit("live", live, t0);
    const short = { max: 1, windowMs: 1000 };
    for (let i = 0; i < 19_999; i += 1) checkRateLimit(`stale-${i}`, short, t0);

    checkRateLimit("pemicu", short, t0 + 5000);

    // Hit ke-3 masih boleh, ke-4 ditolak. Bila "live" (rasio 0,67) dibuang di
    // antara bucket basi yang tampak "penuh", penghitungnya ter-reset.
    expect(checkRateLimit("live", live, t0 + 5000).ok).toBe(true);
    expect(checkRateLimit("live", live, t0 + 5000).ok).toBe(false);
  });

  it("seri rasio isi: yang paling lama tak DIPERIKSA dibuang dulu — penghitung yang terus menolak dianggap aktif", () => {
    const t0 = 12_000_000;
    const one = { max: 1, windowMs: 60_000 };
    checkRateLimit("blocker", one, t0); // penuh sejak t0, dibuat PALING AWAL
    for (let i = 0; i < 19_998; i += 1)
      checkRateLimit(`full-${i}`, one, t0 + 1);

    // Penyalahguna terus mencoba: ditolak, tetapi tercatat sebagai aktivitas.
    expect(checkRateLimit("blocker", one, t0 + 5).ok).toBe(false);
    checkRateLimit("x1", one, t0 + 6);
    checkRateLimit("x2", one, t0 + 6); // memicu eviksi

    expect(checkRateLimit("blocker", one, t0 + 7).ok).toBe(false);
  });

  it("kunci milik request yang sedang diproses tidak ikut dibuang", () => {
    const t0 = 11_000_000;
    const self = { max: 10, windowMs: 60_000 };
    for (let i = 0; i < 5; i += 1) checkRateLimit("self", self, t0);
    const one = { max: 1, windowMs: 60_000 };
    for (let i = 0; i < 19_999; i += 1)
      checkRateLimit(`full-${i}`, one, t0 + 1);

    expect(
      checkRateLimitAll(
        [
          { key: "self", opts: self },
          { key: "baru", opts: one },
        ],
        t0 + 2,
      ).ok,
    ).toBe(true);

    // 5 + 1 hit → sisa 10 - 6 - 1 = 3. Bila "self" (rasio 0,5 — terendah) ikut
    // dibuang lalu dibuat ulang, sisanya menjadi 8.
    expect(checkRateLimit("self", self, t0 + 3).remaining).toBe(3);
  });

  it("eviksi menyisakan ruang ≥10% — sapu O(n) tak berjalan pada setiap kunci baru saat banjir", () => {
    const one = { max: 1, windowMs: 60_000 };
    for (let i = 0; i < 20_001; i += 1) {
      checkRateLimit(`k-${i}`, one, 15_000_000);
    }
    // Tanpa ruang sisa, Map berhenti tepat di 20.000 dan kunci baru berikutnya
    // memicu sapu + pengurutan ±20 ribu bucket SETIAP kali.
    expect(__rateLimitKeyCount()).toBeLessThanOrEqual(18_000);
  });
});

describe("checkRateLimitAll — semua-atau-tidak-sama-sekali", () => {
  beforeEach(() => __resetRateLimit());

  it("hit dicatat HANYA bila semua bucket lolos", () => {
    const t0 = 5_000_000;
    const a = { key: "a", opts: { max: 5, windowMs: 1000 } };
    const b = { key: "b", opts: { max: 1, windowMs: 1000 } };
    expect(checkRateLimitAll([a, b], t0)).toEqual({
      ok: true,
      remaining: 0,
      retryAfterMs: 0,
    });
    // `b` penuh → ditolak, dan `a` TIDAK ikut tercatat.
    expect(checkRateLimitAll([a, b], t0).ok).toBe(false);
    expect(checkRateLimitAll([a, b], t0).ok).toBe(false);
    expect(checkRateLimit("a", a.opts, t0).remaining).toBe(3);
  });

  it("hasil gagal membawa retryAfterMs dari bucket yang penuh", () => {
    const t0 = 6_000_000;
    checkRateLimit("b", { max: 1, windowMs: 1000 }, t0 - 400);
    expect(
      checkRateLimitAll(
        [
          { key: "a", opts: { max: 5, windowMs: 1000 } },
          { key: "b", opts: { max: 1, windowMs: 1000 } },
        ],
        t0,
      ),
    ).toEqual({ ok: false, remaining: 0, retryAfterMs: 600 });
  });

  it("request yang ditolak TIDAK membuat kunci baru", () => {
    const t0 = 7_000_000;
    const full = { key: "b", opts: { max: 1, windowMs: 1000 } };
    checkRateLimit(full.key, full.opts, t0);
    expect(__rateLimitKeyCount()).toBe(1);

    const res = checkRateLimitAll(
      [{ key: "fresh", opts: { max: 5, windowMs: 1000 } }, full],
      t0,
    );

    expect(res.ok).toBe(false);
    expect(__rateLimitKeyCount()).toBe(1);
  });

  it("dua kunci BARU saat Map hampir penuh: keduanya tetap tercatat (dilindungi dari eviksi)", () => {
    const t0 = 8_000_000;
    const opts = { max: 1, windowMs: 1000 };
    // 19.999 kunci AKTIF & penuh: dua kunci baru request ini dilindungi dan
    // dihitung sebagai `incoming`, jadi eviksi membuang kunci `live-*` lain.
    for (let i = 0; i < 19_999; i += 1) checkRateLimit(`live-${i}`, opts, t0);

    expect(
      checkRateLimitAll(
        [
          { key: "a", opts },
          { key: "b", opts },
        ],
        t0,
      ).ok,
    ).toBe(true);

    expect(checkRateLimit("a", opts, t0).ok).toBe(false);
    expect(checkRateLimit("b", opts, t0).ok).toBe(false);
  });
});
