import { describe, expect, it } from "vitest";

import { ipNetworkKey, resolveClientIp } from "@/lib/client-ip";

describe("resolveClientIp", () => {
  it("cf-connecting-ip menang (otoritatif, ditimpa Cloudflare)", () => {
    expect(
      resolveClientIp({
        cfConnectingIp: "203.0.113.7",
        xForwardedFor: "9.9.9.9, 203.0.113.7",
        xRealIp: "9.9.9.9",
      }),
    ).toBe("203.0.113.7");
  });

  it("TIDAK memakai entri KIRI XFF yang dapat dipalsukan klien", () => {
    // Klien menaruh '9.9.9.9' palsu di kiri; proxy tepercaya menambah IP asli di kanan.
    expect(resolveClientIp({ xForwardedFor: "9.9.9.9, 203.0.113.7" })).toBe(
      "203.0.113.7",
    );
  });

  it("x-real-ip dipakai bila tak ada cf-connecting-ip", () => {
    expect(
      resolveClientIp({ xRealIp: "203.0.113.7", xForwardedFor: "9.9.9.9" }),
    ).toBe("203.0.113.7");
  });

  it("XFF entri tunggal (dev/socket) dipakai apa adanya", () => {
    expect(resolveClientIp({ xForwardedFor: "127.0.0.1" })).toBe("127.0.0.1");
  });

  it("fallback 'unknown' bila tak ada header valid", () => {
    expect(resolveClientIp({})).toBe("unknown");
    expect(resolveClientIp({ xForwardedFor: "  ,  " })).toBe("unknown");
    expect(resolveClientIp({ cfConnectingIp: "   " })).toBe("unknown");
  });
});

describe("ipNetworkKey", () => {
  it("IPv4 → /24 (rotasi oktet ke-4 berbagi bucket)", () => {
    expect(ipNetworkKey("203.0.113.7")).toBe("v4:203.0.113");
    expect(ipNetworkKey("203.0.113.250")).toBe("v4:203.0.113");
    expect(ipNetworkKey("203.0.114.7")).not.toBe(ipNetworkKey("203.0.113.7"));
  });

  it("IPv6 → /64 (rotasi dalam satu blok berbagi bucket)", () => {
    const a = ipNetworkKey("2001:db8:abcd:1234:1:2:3:4");
    const b = ipNetworkKey("2001:db8:abcd:1234:ffff:ffff:ffff:ffff");
    expect(a).toBe("v6:2001:db8:abcd:1234");
    expect(b).toBe(a); // /64 sama → bucket sama (menutup bypass rotasi IPv6)
    expect(ipNetworkKey("2001:db8:abcd:9999::1")).not.toBe(a);
  });

  it("IPv6 terkompresi diekspansi sebelum ambil /64", () => {
    expect(ipNetworkKey("2001:db8::1")).toBe("v6:2001:db8:0:0");
    expect(ipNetworkKey("::1")).toBe("v6:0:0:0:0");
  });

  it("IPv4-mapped IPv6 diperlakukan sebagai IPv4", () => {
    expect(ipNetworkKey("::ffff:203.0.113.7")).toBe("v4:203.0.113");
  });

  it("'unknown'/kosong dikembalikan apa adanya", () => {
    expect(ipNetworkKey("unknown")).toBe("unknown");
    expect(ipNetworkKey("  ")).toBe("unknown");
  });
});
