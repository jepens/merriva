import { describe, expect, it } from "vitest";

import {
  CLOUDFLARE_CIDRS,
  CLOUDFLARE_IPV4,
  CLOUDFLARE_IPV6,
} from "@/lib/cloudflare-ips";
import {
  INTERNAL_CIDRS,
  ipInAny,
  ipInCidr,
  parseCidr,
  parseIp,
} from "@/lib/ip-cidr";

function ip(s: string) {
  const p = parseIp(s);
  if (!p) throw new Error(`gagal parse ${s}`);
  return p;
}

const bytes = (s: string) => Array.from(ip(s).bytes);

describe("parseIp — IPv4", () => {
  it("bentuk kanonik diterima", () => {
    expect(ip("203.0.113.7").version).toBe(4);
    expect(bytes("203.0.113.7")).toEqual([203, 0, 113, 7]);
    expect(bytes(" 0.0.0.0 ")).toEqual([0, 0, 0, 0]);
  });

  it("bentuk tak kanonik / liar DITOLAK (tak ditebak)", () => {
    for (const bad of [
      "",
      "   ",
      "unknown",
      "256.1.1.1",
      "1.2.3",
      "1.2.3.4.5",
      "01.2.3.4",
      "1.2.3.-4",
      "1e2.0.0.1",
      "1.2.3.4:80",
      "0x7f.0.0.1",
    ]) {
      expect(parseIp(bad), bad).toBeNull();
    }
  });
});

describe("parseIp — IPv6", () => {
  it("bentuk penuh, terkompresi, huruf besar, dan zone id", () => {
    expect(bytes("2001:db8::1")).toEqual([
      0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    ]);
    expect(bytes("2001:DB8:0:0:0:0:0:1")).toEqual(bytes("2001:db8::1"));
    expect(bytes("::")).toEqual(Array(16).fill(0));
    expect(ip("fe80::1%eth0").version).toBe(6);
  });

  it("IPv4-mapped (desimal maupun heksa) → dikembalikan sebagai IPv4", () => {
    expect(ip("::ffff:162.158.1.2")).toEqual(ip("162.158.1.2"));
    expect(ip("::ffff:a29e:102")).toEqual(ip("162.158.1.2"));
  });

  it("bentuk liar DITOLAK", () => {
    for (const bad of [
      "1:2:3:4:5:6:7:8:9",
      "1:2:3:4:5:6:7",
      "1::2::3",
      ":1:2:3:4:5:6:7",
      "1:2:3:4:5:6:7:",
      "1:2:3:4:5:6:7::8",
      "12345::",
      "g::1",
      "[::1]",
      "::ffff:999.1.1.1",
      "%eth0",
    ]) {
      expect(parseIp(bad), bad).toBeNull();
    }
  });
});

describe("parseCidr & ipInCidr", () => {
  it("batas prefix IPv4 tepat", () => {
    const c = parseCidr("104.16.0.0/13");
    expect(ipInCidr(ip("104.16.0.0"), c)).toBe(true);
    expect(ipInCidr(ip("104.23.255.255"), c)).toBe(true);
    expect(ipInCidr(ip("104.15.255.255"), c)).toBe(false);
    expect(ipInCidr(ip("104.24.0.0"), c)).toBe(false);
  });

  it("batas prefix IPv6 tepat (prefix bukan kelipatan 8)", () => {
    const c = parseCidr("2a06:98c0::/29");
    expect(ipInCidr(ip("2a06:98c0::1"), c)).toBe(true);
    expect(ipInCidr(ip("2a06:98c7:ffff:ffff::"), c)).toBe(true);
    expect(ipInCidr(ip("2a06:98c8::"), c)).toBe(false);
  });

  it("/0 cocok untuk versi yang sama saja; versi berbeda tak pernah cocok", () => {
    expect(ipInCidr(ip("8.8.8.8"), parseCidr("0.0.0.0/0"))).toBe(true);
    expect(ipInCidr(ip("2001:db8::1"), parseCidr("0.0.0.0/0"))).toBe(false);
    expect(ipInCidr(ip("8.8.8.8"), parseCidr("::/0"))).toBe(false);
  });

  it("CIDR tidak valid melempar", () => {
    for (const bad of [
      "1.2.3.4",
      "1.2.3.4/33",
      "::/129",
      "x/8",
      "1.2.3.4/-1",
      "1.2.3.4/08",
      "1.2.3.4/",
    ]) {
      expect(() => parseCidr(bad), bad).toThrow();
    }
  });
});

describe("rentang Cloudflare & jaringan internal", () => {
  it("seluruh daftar Cloudflare ter-parse", () => {
    expect(CLOUDFLARE_CIDRS).toHaveLength(
      CLOUDFLARE_IPV4.length + CLOUDFLARE_IPV6.length,
    );
  });

  it("edge Cloudflare nyata dikenali; alamat lain tidak", () => {
    for (const edge of [
      "162.158.12.34",
      "172.70.0.1",
      "104.16.1.1",
      "2400:cb00:2049:1::a29f:1804",
      "2a06:98c0:3600::103",
    ]) {
      expect(ipInAny(ip(edge), CLOUDFLARE_CIDRS), edge).toBe(true);
    }
    for (const other of ["8.8.8.8", "203.0.113.7", "10.0.0.1", "2001:db8::1"]) {
      expect(ipInAny(ip(other), CLOUDFLARE_CIDRS), other).toBe(false);
    }
  });

  it("jaringan internal dikenali; alamat publik tidak", () => {
    for (const internal of [
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "127.0.0.1",
      "169.254.1.1",
      "100.64.0.1",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
    ]) {
      expect(ipInAny(ip(internal), INTERNAL_CIDRS), internal).toBe(true);
    }
    for (const pub of ["172.32.0.0", "8.8.8.8", "162.158.1.2", "2001:db8::1"]) {
      expect(ipInAny(ip(pub), INTERNAL_CIDRS), pub).toBe(false);
    }
  });
});
