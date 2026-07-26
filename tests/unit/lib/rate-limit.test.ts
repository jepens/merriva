import { beforeEach, describe, expect, it } from "vitest";

import { __resetRateLimit, checkRateLimit } from "@/lib/rate-limit";

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
});
