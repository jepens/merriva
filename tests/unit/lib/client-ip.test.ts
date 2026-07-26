import { describe, expect, it } from "vitest";

import { resolveClientIp } from "@/lib/client-ip";

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
