import { describe, expect, it } from "vitest";

import {
  ipNetworkKey,
  resolveClientIp,
  resolveClientIpDetailed,
} from "@/lib/client-ip";

/** IP edge Cloudflare nyata (162.158.0.0/15, 2400:cb00::/32). */
const CF_EDGE = "162.158.12.34";
const CF_EDGE_V6 = "2400:cb00:2049:1::a29f:1804";
/** Alamat publik di LUAR Cloudflare (blok dokumentasi RFC 5737). */
const ATTACKER = "198.51.100.9";
const VISITOR = "203.0.113.7";
/** Gateway bridge Docker — peer internal saat IP sumber hilang. */
const DOCKER_GW = "172.18.0.1";

describe("resolveClientIp — request lewat Cloudflare", () => {
  it("peer = edge Cloudflare → cf-connecting-ip otoritatif", () => {
    expect(
      resolveClientIpDetailed({
        cfConnectingIp: VISITOR,
        xForwardedFor: `${VISITOR}, ${CF_EDGE}`,
        xRealIp: CF_EDGE,
      }),
    ).toEqual({ ip: VISITOR, source: "cloudflare" });
  });

  it("edge Cloudflare IPv6 & IPv4-mapped juga dikenali", () => {
    for (const edge of [CF_EDGE_V6, `::ffff:${CF_EDGE}`]) {
      expect(
        resolveClientIpDetailed({
          cfConnectingIp: VISITOR,
          xForwardedFor: edge,
        }),
      ).toEqual({ ip: VISITOR, source: "cloudflare" });
    }
  });

  it("edge Cloudflare tanpa cf-connecting-ip yang valid → pakai peer, tak menebak", () => {
    expect(resolveClientIpDetailed({ xForwardedFor: CF_EDGE })).toEqual({
      ip: CF_EDGE,
      source: "peer",
    });
    expect(
      resolveClientIp({ cfConnectingIp: "bukan-ip", xForwardedFor: CF_EDGE }),
    ).toBe(CF_EDGE);
  });
});

describe("resolveClientIp — KEA-1: origin diakses langsung", () => {
  it("cf-connecting-ip PALSU dari peer non-Cloudflare DIABAIKAN & ditandai", () => {
    expect(
      resolveClientIpDetailed({
        cfConnectingIp: VISITOR,
        xForwardedFor: ATTACKER,
      }),
    ).toEqual({ ip: ATTACKER, source: "cf-rejected" });
  });

  it("merotasi cf-connecting-ip TIDAK menghasilkan bucket rate limit baru", () => {
    const keys = ["1.1.1.1", "8.8.4.4", "2001:db8::1", "45.1.2.3"].map((cf) =>
      ipNetworkKey(
        resolveClientIp({ cfConnectingIp: cf, xForwardedFor: ATTACKER }),
      ),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("menaruh IP Cloudflare di KIRI XFF tidak menolong", () => {
    expect(
      resolveClientIp({
        cfConnectingIp: VISITOR,
        xForwardedFor: `${CF_EDGE}, ${ATTACKER}`,
      }),
    ).toBe(ATTACKER);
  });

  it("x-real-ip palsu diabaikan bila peer publik terlihat", () => {
    expect(
      resolveClientIpDetailed({ xRealIp: VISITOR, xForwardedFor: ATTACKER }),
    ).toEqual({ ip: ATTACKER, source: "peer" });
  });

  it("TIDAK memakai entri KIRI XFF yang dapat dipalsukan klien", () => {
    expect(resolveClientIp({ xForwardedFor: `9.9.9.9, ${VISITOR}` })).toBe(
      VISITOR,
    );
  });
});

describe("resolveClientIp — entri di kiri peer internal TIDAK ditelusuri", () => {
  // Temuan review adversarial: bila peer Traefik internal dan Traefik
  // mempercayai header masuk, entri di kirinya ditulis KLIEN.
  it("entri kiri tak bisa dipakai merotasi bucket", () => {
    const keys = [1, 2, 3, 4].map((n) =>
      ipNetworkKey(
        resolveClientIp({ xForwardedFor: `9.${n}.${n}.1, ${DOCKER_GW}` }),
      ),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("entri kiri tak bisa meniru jaringan korban", () => {
    expect(
      resolveClientIp({ xForwardedFor: `203.0.113.200, ${DOCKER_GW}` }),
    ).toBe(DOCKER_GW);
  });

  it("IP Cloudflare palsu di kiri peer internal tak pernah menjadi `cloudflare`", () => {
    expect(
      resolveClientIpDetailed({
        cfConnectingIp: "77.1.2.3",
        xForwardedFor: `${CF_EDGE}, ${DOCKER_GW}`,
      }).source,
    ).toBe("unverified");
  });
});

describe("resolveClientIp — peer tak terlihat (urutan lama, unverified)", () => {
  it("tanpa XFF → cf-connecting-ip, lalu x-real-ip", () => {
    expect(
      resolveClientIpDetailed({ cfConnectingIp: VISITOR, xRealIp: "9.9.9.9" }),
    ).toEqual({ ip: VISITOR, source: "unverified" });
    expect(resolveClientIpDetailed({ xRealIp: VISITOR })).toEqual({
      ip: VISITOR,
      source: "unverified",
    });
  });

  it("peer internal (IP sumber hilang) → cf-connecting-ip; tak bisa dibuktikan di app", () => {
    expect(
      resolveClientIpDetailed({
        cfConnectingIp: VISITOR,
        xForwardedFor: "10.0.0.2",
      }),
    ).toEqual({ ip: VISITOR, source: "unverified" });
  });

  it("XFF entri tunggal loopback (dev) dipakai apa adanya", () => {
    expect(resolveClientIp({ xForwardedFor: "127.0.0.1" })).toBe("127.0.0.1");
    expect(resolveClientIp({ xForwardedFor: "::1" })).toBe("::1");
  });

  it("entri kanan tak dikenali → tak menebak peer di baliknya", () => {
    expect(
      resolveClientIpDetailed({
        xRealIp: VISITOR,
        xForwardedFor: `${ATTACKER}, bukan-ip`,
      }),
    ).toEqual({ ip: VISITOR, source: "unverified" });
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
