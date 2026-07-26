import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { resolveClientIp } from "@/lib/client-ip";

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
 * Kunci rate-limit ter-hash untuk sebuah aksi. Meng-hash IP (SHA-256, dipotong)
 * agar TIDAK menyimpan IP mentah di memori (selaras UU PDP: minimalkan PII).
 */
export async function clientRateKey(action: string): Promise<string> {
  const ip = await getClientIp();
  const hash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
  return `${action}:${hash}`;
}
