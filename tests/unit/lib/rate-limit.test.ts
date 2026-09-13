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

  it("dua kunci BARU saat Map hampir penuh: keduanya tetap tercatat meski eviksi membuang salah satunya", () => {
    const t0 = 8_000_000;
    const opts = { max: 1, windowMs: 1000 };
    // 19.999 kunci AKTIF: eviksi fase 1 hanya bisa membuang bucket kosong —
    // yakni kunci `a` yang baru saja dibuat untuk request ini.
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
