import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import {
  ipAggregateKey,
  ipNetworkKey,
  resolveClientIpDetailed,
  type ClientIpSource,
} from "@/lib/client-ip";
import {
  checkRateLimitAll,
  type RateLimitCheck,
  type RateLimitOptions,
  type RateLimitResult,
} from "@/lib/rate-limit";

/**
 * IP klien dari header proxy (logika pemilihan murni & teruji di `client-ip.ts`).
 * `cf-connecting-ip` hanya dipercaya bila peer yang ditambahkan Traefik ada di
 * rentang IP Cloudflare (AUDIT-2026-09-04 KEA-1, DECISIONS #37).
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const { ip, source } = resolveClientIpDetailed({
    cfConnectingIp: h.get("cf-connecting-ip"),
    xRealIp: h.get("x-real-ip"),
    xForwardedFor: h.get("x-forwarded-for"),
  });
  if (process.env.NODE_ENV === "production") warnTopologyOnce(source);
  return ip;
}

const warned = new Set<ClientIpSource>();

/**
 * Sinyal topologi di production — sekali per proses dan TANPA nilai IP (UU PDP):
 * - `unverified`: peer tak terlihat atau internal → app tak bisa membuktikan
 *   request lewat Cloudflare. KEA-1 hanya benar-benar tertutup bila Traefik
 *   melihat IP sumber publik dan origin di-firewall ke rentang Cloudflare
 *   (LAUNCH-CHECKLIST Fase 6). Log ini seharusnya TIDAK PERNAH muncul.
 * - `cf-rejected`: `cf-connecting-ip` datang dari peer publik non-Cloudflare —
 *   percobaan langsung ke origin, atau daftar rentang Cloudflare basi.
 */
function warnTopologyOnce(source: ClientIpSource): void {
  if (warned.has(source)) return;
  if (source === "unverified") {
    warned.add(source);
    console.warn(
      "[client-ip] asal request tak bisa diverifikasi (peer X-Forwarded-For internal/tak ada) — cek mode publish port & forwardedHeaders Traefik (DECISIONS #37)",
    );
  } else if (source === "cf-rejected") {
    warned.add(source);
    console.warn(
      "[client-ip] cf-connecting-ip diabaikan: peer bukan Cloudflare — akses langsung ke origin, atau rentang di cloudflare-ips.json basi (DECISIONS #37)",
    );
  }
}

/**
 * Kunci rate-limit ter-hash dari sebuah nilai (SHA-256, dipotong) — agar TIDAK
 * menyimpan nilai mentah (IP/email) di memori (selaras UU PDP: minimalkan PII).
 */
export function staticRateKey(action: string, value: string): string {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${action}:${hash}`;
}

/**
 * Pengali plafon agregat IPv6 /48 terhadap plafon per-jaringan (/64).
 *
 * Membatasi penyalahguna pemilik satu /48 ke 16× plafon (bukan 65.536×). Sengaja
 * LEBIH longgar dari /24 IPv4: pelanggan operator seluler IPv6 yang berbeda bisa
 * berbagi satu /48, dan mereka tak boleh saling mengunci (DECISIONS #38).
 */
export const IPV6_AGGREGATE_FACTOR = 16;

/**
 * Rate limit per-JARINGAN klien untuk `action` — SATU-SATUNYA jalan membentuk
 * kunci jaringan (DECISIONS #28, #38):
 *  1) kunci jaringan: IPv4 /24, IPv6 /64 (`ipNetworkKey`), plafon `limit`;
 *  2) khusus IPv6: kunci agregat /48 (`ipAggregateKey`), plafon
 *     `limit.max × IPV6_AGGREGATE_FACTOR` — menutup rotasi /64 dalam satu /48.
 *
 * `scope` (album, undangan, …) mempersempit KEDUA kunci ke satu sumber daya
 * (AUDIT-2026-09-04 PER-3): di WiFi venue semua tamu tampak sebagai satu alamat
 * publik, jadi tanpa scope satu resepsi ramai menghabiskan jatahnya sendiri —
 * dan jatah acara lain yang kebetulan sejaringan.
 *
 * `identity` = kunci identitas tambahan (email, perangkat, …) yang ikut dicatat
 * dalam satu keputusan dengan lapis jaringan: kunci pilihan pemanggil hanya
 * tercipta bila batas jaringan lolos, sehingga tak bisa dibanjiri untuk
 * mendesak penghitung lain keluar dari memori limiter (DECISIONS #39).
 *
 * Kedua lapis dicatat SEMUA-ATAU-TIDAK (`checkRateLimitAll`): request yang
 * ditolak lapis mana pun tak mengubah bucket mana pun. Percobaan yang ditolak
 * di /64 tak menguras jatah tetangga sah di /48, dan percobaan yang ditolak di
 * /48 tak memperpanjang penguncian /64 pemanggil sendiri.
 */
export async function checkClientRateLimit(
  action: string,
  limit: RateLimitOptions,
  scope?: string,
  identity: readonly RateLimitCheck[] = [],
): Promise<RateLimitResult> {
  const ip = await getClientIp();
  const prefix = scope === undefined ? "" : `${scope}|`;

  const checks: RateLimitCheck[] = [
    { key: staticRateKey(action, `${prefix}${ipNetworkKey(ip)}`), opts: limit },
  ];
  const aggregateKey = ipAggregateKey(ip);
  if (aggregateKey) {
    checks.push({
      key: staticRateKey(action, `${prefix}${aggregateKey}`),
      opts: {
        max: limit.max * IPV6_AGGREGATE_FACTOR,
        windowMs: limit.windowMs,
      },
    });
  }
  return checkRateLimitAll([...checks, ...identity]);
}
