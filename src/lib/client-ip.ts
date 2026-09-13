import { CLOUDFLARE_CIDRS } from "@/lib/cloudflare-ips";
import { INTERNAL_CIDRS, ipInAny, parseIp } from "@/lib/ip-cidr";

/**
 * Asal nilai `ip` dari `resolveClientIpDetailed`:
 * - `cloudflare`: peer adalah edge Cloudflare → `cf-connecting-ip` (otoritatif);
 * - `peer`: peer publik yang ditambahkan Traefik;
 * - `cf-rejected`: seperti `peer`, tetapi request MEMBAWA `cf-connecting-ip`
 *   dari peer non-Cloudflare — header palsu (akses langsung ke origin) atau
 *   daftar rentang basi. Header itu diabaikan;
 * - `unverified`: peer tak bisa dipastikan (tanpa XFF, entri kanan internal
 *   atau tak dikenali) → urutan lama, asal koneksi TIDAK terbukti.
 */
export type ClientIpSource =
  "cloudflare" | "peer" | "cf-rejected" | "unverified";

/**
 * Pilih IP klien dari header proxy — MURNI & teruji (tanpa next/headers).
 *
 * Model kepercayaan (AUDIT-2026-09-04 KEA-1, DECISIONS #37):
 *
 * - Entri KIRI `x-forwarded-for` DAPAT DIPALSUKAN klien — proxy meng-APPEND,
 *   bukan menimpa. JANGAN PERNAH dipakai.
 * - Traefik (Easypanel) tersambung LANGSUNG ke kontainer app dan menambahkan
 *   alamat peer TCP-nya di ujung KANAN XFF; Next hanya mengisi XFF bila kosong.
 *   Jadi HANYA entri paling kanan yang tepercaya. Entri di kirinya — termasuk
 *   alamat internal — bisa ditulis klien bila Traefik mempercayai header masuk
 *   (`trustedIPs`/`insecure`), sehingga tak pernah ditelusuri.
 * - `cf-connecting-ip` hanya otoritatif bila peer itu ada di rentang IP
 *   Cloudflare. Tanpa cek ini, siapa pun yang menemukan IP origin bisa mengirim
 *   nilai acak per request → bucket rate limit baru per request.
 *   Cek ini PERLU TETAPI TIDAK CUKUP: pelanggan Cloudflare lain (Worker
 *   `connect()`, zona proxied milik mereka) juga datang dari rentang itu dan
 *   bisa menulis header sendiri → lolos sebagai `cloudflare`. Yang menutupnya
 *   hanya Authenticated Origin Pulls per-zona (LAUNCH-CHECKLIST Fase 6).
 *
 * Bila peer internal/tak ada (mis. IP sumber hilang di routing mesh Docker
 * Swarm mode ingress, atau `next dev`), app TIDAK bisa membuktikan asal koneksi
 * → urutan lama dipertahankan: `cf-connecting-ip` → `x-real-ip` → entri kanan
 * XFF → `"unknown"`, dengan sumber `unverified`. Sengaja BUKAN satu bucket
 * bersama: topologi yang salah pasang akan mengunci SELURUH pengunjung. Celah di
 * topologi itu ditutup lewat ops (LAUNCH-CHECKLIST Fase 6); `request-ip.ts`
 * mencatat peringatan agar kondisinya terlihat.
 */
export function resolveClientIpDetailed(h: {
  cfConnectingIp?: string | null;
  xRealIp?: string | null;
  xForwardedFor?: string | null;
}): { ip: string; source: ClientIpSource } {
  const hops = (h.xForwardedFor ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const last = hops[hops.length - 1];
  const peer = last ? parseIp(last) : null;
  const cf = h.cfConnectingIp?.trim();

  if (last && peer && !ipInAny(peer, INTERNAL_CIDRS)) {
    if (!cf) return { ip: last, source: "peer" };
    if (!ipInAny(peer, CLOUDFLARE_CIDRS)) {
      return { ip: last, source: "cf-rejected" };
    }
    return parseIp(cf)
      ? { ip: cf, source: "cloudflare" }
      : { ip: last, source: "peer" };
  }

  if (cf) return { ip: cf, source: "unverified" };

  const real = h.xRealIp?.trim();
  if (real) return { ip: real, source: "unverified" };

  return { ip: last ?? "unknown", source: "unverified" };
}

/** Nilai IP saja dari `resolveClientIpDetailed`. */
export function resolveClientIp(h: {
  cfConnectingIp?: string | null;
  xRealIp?: string | null;
  xForwardedFor?: string | null;
}): string {
  return resolveClientIpDetailed(h).ip;
}

/** Prefix /24 IPv4 (`v4:a.b.c`) dari string IP, atau null bila bukan IPv4. */
function ipv4Prefix(v: string): string | null {
  const o = v.split(".");
  if (o.length !== 4) return null;
  return `v4:${o[0]}.${o[1]}.${o[2]}`;
}

/**
 * Kunci JARINGAN dari IP untuk rate-limit: IPv4 → /24 (3 oktet pertama),
 * IPv6 → /64 (4 hextet pertama). Rotasi alamat DALAM satu blok (umum: satu VPS
 * memegang /64 IPv6, atau /24 IPv4) berbagi bucket → plafon per-"IP" tak bisa
 * dilewati dengan berganti-ganti alamat sumber. Bentuk tak dikenal / "unknown"
 * dikembalikan apa adanya (semua berbagi satu bucket). MURNI & teruji.
 */
export function ipNetworkKey(ip: string): string {
  const v = ip.trim().toLowerCase();
  if (!v || v === "unknown") return "unknown";

  // IPv4-mapped IPv6 (mis. ::ffff:1.2.3.4) → perlakukan sebagai IPv4.
  if (v.includes(":") && v.includes(".")) {
    const tail = v.slice(v.lastIndexOf(":") + 1);
    return ipv4Prefix(tail) ?? "unknown";
  }

  if (v.includes(":")) {
    // IPv6 → /64: ekspansi "::" menjadi 8 hextet, ambil 4 pertama.
    const zoneless = v.split("%")[0];
    const [head, tail] = zoneless.split("::");
    const headParts = head ? head.split(":").filter(Boolean) : [];
    const tailParts = tail !== undefined ? tail.split(":").filter(Boolean) : [];
    const fill = Math.max(0, 8 - headParts.length - tailParts.length);
    const full = [...headParts, ...Array(fill).fill("0"), ...tailParts];
    const prefix = full.slice(0, 4).map((h) => h || "0");
    return `v6:${prefix.join(":")}`;
  }

  return ipv4Prefix(v) ?? v;
}
