import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `checkClientRateLimit` — lapis agregat IPv6 /48 (DECISIONS #38).
 *
 * Tanpa lapis ini satu blok /48 (gratis dari tunnel broker) berisi 65.536 blok
 * /64 = 65.536 bucket terpisah, sehingga login 10/menit menjadi ±655 ribu
 * percobaan/menit. Berkas ini memakai limiter & keying ASLI; `next/headers`
 * palsu hanya menyuplai alamat klien.
 */

const { ipRef } = vi.hoisted(() => ({ ipRef: { current: "203.0.113.7" } }));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(new Headers({ "cf-connecting-ip": ipRef.current })),
}));

import { __resetRateLimit } from "@/lib/rate-limit";
import { checkClientRateLimit, IPV6_AGGREGATE_FACTOR } from "@/lib/request-ip";

const LIMIT = { max: 2, windowMs: 60_000 };
const AGGREGATE_CAP = LIMIT.max * IPV6_AGGREGATE_FACTOR;

/** Alamat di /64 ke-`n` dari satu /48 yang sama. */
const in48 = (n: number) => `2001:470:1f00:${n.toString(16)}::1`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

async function attempt(ip: string, scope?: string): Promise<boolean> {
  ipRef.current = ip;
  return (await checkClientRateLimit("uji", LIMIT, scope)).ok;
}

/** Jumlah percobaan yang lolos: `perIp` percobaan untuk tiap alamat. */
async function countOk(
  ips: string[],
  perIp: number,
  scope?: string,
): Promise<number> {
  let ok = 0;
  for (const ip of ips) {
    for (let i = 0; i < perIp; i++) {
      if (await attempt(ip, scope)) ok++;
    }
  }
  return ok;
}

beforeEach(() => {
  __resetRateLimit();
});

describe("checkClientRateLimit — lapis jaringan", () => {
  it("satu /64 berhenti di plafonnya", async () => {
    expect(await countOk([in48(1)], 5)).toBe(LIMIT.max);
  });

  it("IPv4: /24 berbeda tak saling memengaruhi (tanpa lapis agregat)", async () => {
    const ips = range(40).map((i) => `198.51.${i}.9`);
    expect(await countOk(ips, LIMIT.max)).toBe(40 * LIMIT.max);
  });

  it("penulisan berbeda dari /64 yang sama tetap satu bucket", async () => {
    expect(await attempt("2001:470:1f00:1::1")).toBe(true);
    expect(await attempt("2001:0470:1F00:0001:0:0:0:2")).toBe(true);
    expect(await attempt("2001:470:1f00:1::3")).toBe(false);
  });
});

describe("checkClientRateLimit — agregat IPv6 /48", () => {
  it("merotasi /64 dalam satu /48 berhenti di plafon × faktor", async () => {
    // 40 blok /64 × 2 percobaan = 80, tetapi /48-nya hanya memberi 32.
    expect(await countOk(range(40).map(in48), LIMIT.max)).toBe(AGGREGATE_CAP);
  });

  it("/48 lain tidak ikut terkunci", async () => {
    await countOk(range(40).map(in48), LIMIT.max);
    expect(await attempt("2001:470:1f01:1::1")).toBe(true);
  });

  it("percobaan yang DITOLAK di /64 tak menguras jatah /48 tetangga", async () => {
    // Satu penyalahguna menghantam /64-nya 100×: hanya 2 yang dihitung ke /48.
    expect(await countOk([in48(1)], 100)).toBe(LIMIT.max);
    const neighbours = range(20).map((i) => in48(i + 2));
    expect(await countOk(neighbours, LIMIT.max)).toBe(
      AGGREGATE_CAP - LIMIT.max,
    );
  });

  it("scope mempersempit agregat: album lain di /48 yang sama tetap punya jatah", async () => {
    await countOk(range(40).map(in48), LIMIT.max, "album-a");
    expect(await attempt(in48(99), "album-b")).toBe(true);
    expect(await attempt(in48(99), "album-a")).toBe(false);
  });

  it("faktor agregat terkunci di 16 (nilai yang diputuskan DECISIONS #38)", () => {
    expect(IPV6_AGGREGATE_FACTOR).toBe(16);
  });

  it("satu /64 yang habis TIDAK mengunci /64 lain di /48 yang sama", async () => {
    // Faktor 1 (menyamakan /48 dengan /24) akan menggagalkan ini: dua pelanggan
    // seluler berbeda di satu /48 saling mengunci.
    expect(await countOk([in48(1)], 5)).toBe(LIMIT.max);
    expect(await attempt(in48(2))).toBe(true);
  });

  it("percobaan yang DITOLAK di /48 tak mengisi bucket /64 pemanggil; /48 pulih setelah jendela", async () => {
    vi.useFakeTimers();
    try {
      const t0 = 1_000_000;
      vi.setSystemTime(t0);
      await countOk(range(IPV6_AGGREGATE_FACTOR).map(in48), LIMIT.max);

      vi.setSystemTime(t0 + 50_000);
      const late = in48(500);
      ipRef.current = late;
      const rejected = await checkClientRateLimit("uji", LIMIT);
      expect(rejected.ok).toBe(false);
      expect(rejected.retryAfterMs).toBe(10_000);
      expect(await attempt(late)).toBe(false);

      // Jendela /48 lewat. Bila penolakan tadi tercatat di /64 `late`, bucket
      // itu masih penuh sampai t0 + 110 dtk dan dua percobaan ini ditolak.
      vi.setSystemTime(t0 + LIMIT.windowMs + 1);
      expect(await attempt(late)).toBe(true);
      expect(await attempt(late)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
