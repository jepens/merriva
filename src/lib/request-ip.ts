import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { ipNetworkKey, resolveClientIp } from "@/lib/client-ip";

/**
 * IP klien dari header proxy (logika pemilihan murni & teruji di `client-ip.ts`).
 * Memprioritaskan `cf-connecting-ip` (otoritatif di balik Cloudflare) — TIDAK
 * memakai entri kiri `x-forwarded-for` yang dapat dipalsukan klien.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return resolveClientIp({
    cfConnectingIp: h.get("cf-connecting-ip"),
    xRealIp: h.get("x-real-ip"),
    xForwardedFor: h.get("x-forwarded-for"),
  });
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
