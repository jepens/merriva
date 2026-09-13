import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import {
  ipNetworkKey,
  resolveClientIpDetailed,
  type ClientIpSource,
} from "@/lib/client-ip";

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
 * Kunci rate-limit untuk sebuah aksi, per-JARINGAN klien (bukan per-IP penuh):
 * IPv6 /64, IPv4 /24 (lihat `ipNetworkKey`) → rotasi alamat dalam satu blok tak
 * bisa melewati plafon.
 */
export async function clientRateKey(action: string): Promise<string> {
  const ip = await getClientIp();
  return staticRateKey(action, ipNetworkKey(ip));
}

/**
 * Kunci rate-limit per-JARINGAN yang DIPERSEMPIT ke satu sumber daya (album,
 * undangan, dst).
 *
 * Tanpa `scope`, seluruh lalu lintas satu blok /24 berbagi SATU bucket: di WiFi
 * venue semua tamu tampak sebagai satu alamat publik, sehingga satu resepsi
 * ramai menghabiskan jatah dirinya sendiri — dan jatah acara lain yang kebetulan
 * sejaringan (AUDIT-2026-09-04 PER-3). Men-scope per sumber daya membuat plafon
 * bisa dinaikkan seukuran satu acara tanpa membuka pintu banjir lintas-acara.
 */
export async function scopedClientRateKey(
  action: string,
  scope: string,
): Promise<string> {
  const ip = await getClientIp();
  return staticRateKey(action, `${scope}|${ipNetworkKey(ip)}`);
}
