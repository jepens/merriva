/**
 * Parser IP & pencocok CIDR — MURNI, tanpa dependency.
 *
 * Dipakai `client-ip.ts` untuk memutuskan apakah `cf-connecting-ip` boleh
 * dipercaya (AUDIT-2026-09-04 KEA-1, DECISIONS #37). Sengaja KETAT: hanya
 * bentuk yang dihasilkan proxy (IPv4 desimal tanpa nol di depan, IPv6
 * heksadesimal dengan paling banyak satu `::`). Nilai yang tak dikenali →
 * `null`, dan pemanggil memperlakukannya sebagai tak tepercaya — BUKAN menebak.
 */

export interface ParsedIp {
  readonly version: 4 | 6;
  /** 4 byte (IPv4) atau 16 byte (IPv6), urutan jaringan. */
  readonly bytes: Uint8Array;
}

export interface Cidr extends ParsedIp {
  readonly prefix: number;
}

const OCTET = /^(0|[1-9]\d{0,2})$/;
const HEXTET = /^[0-9a-f]{1,4}$/;
const PREFIX = /^(0|[1-9]\d{0,2})$/;
const V4_MAPPED_PREFIX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff];

function parseIpv4(s: string): Uint8Array | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    const p = parts[i] ?? "";
    if (!OCTET.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out[i] = n;
  }
  return out;
}

function parseIpv6(input: string): Uint8Array | null {
  let s = input;
  const lastColon = s.lastIndexOf(":");
  if (lastColon === -1) return null;

  // IPv4 tertanam di ekor (mis. `::ffff:1.2.3.4`) → dua hextet.
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    const [a = 0, b = 0, c = 0, d = 0] = v4;
    s = `${s.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const groups = (x: string | undefined) => (x ? x.split(":") : []);
  const left = groups(halves[0]);
  const right = groups(halves[1]);
  const elided = halves.length === 2;
  const missing = 8 - left.length - right.length;
  if (elided ? missing < 1 : missing !== 0) return null;

  const all = [
    ...left,
    ...Array<string>(elided ? missing : 0).fill("0"),
    ...right,
  ];
  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const g = all[i] ?? "";
    if (!HEXTET.test(g)) return null;
    const n = parseInt(g, 16);
    out[2 * i] = n >> 8;
    out[2 * i + 1] = n & 0xff;
  }
  return out;
}

/**
 * Parse satu alamat IP. IPv4-mapped IPv6 (`::ffff:a.b.c.d`) dikembalikan
 * sebagai IPv4 agar rentang IPv4 tetap berlaku. Zone id (`%eth0`) dibuang.
 */
export function parseIp(raw: string): ParsedIp | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  if (!s.includes(":")) {
    const b = parseIpv4(s);
    return b ? { version: 4, bytes: b } : null;
  }

  const zone = s.indexOf("%");
  const b = parseIpv6(zone === -1 ? s : s.slice(0, zone));
  if (!b) return null;
  if (V4_MAPPED_PREFIX.every((v, i) => b[i] === v)) {
    return { version: 4, bytes: b.slice(12) };
  }
  return { version: 6, bytes: b };
}

/** Parse `alamat/prefix`. Melempar bila tidak valid — hanya untuk konstanta. */
export function parseCidr(cidr: string): Cidr {
  const slash = cidr.indexOf("/");
  const ip = slash === -1 ? null : parseIp(cidr.slice(0, slash));
  const prefixRaw = slash === -1 ? "" : cidr.slice(slash + 1);
  const prefix = PREFIX.test(prefixRaw) ? Number(prefixRaw) : -1;
  if (!ip || prefix < 0 || prefix > ip.bytes.length * 8) {
    throw new Error(`CIDR tidak valid: ${cidr}`);
  }
  return { ...ip, prefix };
}

export function ipInCidr(ip: ParsedIp, cidr: Cidr): boolean {
  if (ip.version !== cidr.version) return false;
  for (let i = 0, bits = cidr.prefix; bits > 0; i++, bits -= 8) {
    const mask = bits >= 8 ? 0xff : (0xff << (8 - bits)) & 0xff;
    if (((ip.bytes[i] ?? 0) & mask) !== ((cidr.bytes[i] ?? 0) & mask)) {
      return false;
    }
  }
  return true;
}

export function ipInAny(ip: ParsedIp, cidrs: readonly Cidr[]): boolean {
  return cidrs.some((c) => ipInCidr(ip, c));
}

/**
 * Jaringan internal: hop proxy/Docker di antara Traefik dan app, bukan klien
 * internet. Alamat ini tak pernah menjadi alamat sumber di internet publik,
 * jadi klien dari luar tak bisa tampil sebagai hop internal di ujung kanan XFF.
 */
export const INTERNAL_CIDRS: readonly Cidr[] = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "100.64.0.0/10",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
].map(parseCidr);
