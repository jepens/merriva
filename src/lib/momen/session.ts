import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sesi tamu Album Momen — cookie ber-tanda-tangan HMAC-SHA256 (stateless, tanpa
 * tabel sesi). Diterbitkan `startMomenSessionAction` SETELAH Turnstile lolos;
 * mengikat `deviceId` + `guestName` + `albumId` sehingga saat unggah, identitas
 * tamu diambil dari cookie TER-TANDA-TANGAN (bukan dari field form yang bisa
 * dipalsukan tiap unggah → cegah impersonasi & lewati-Turnstile).
 *
 * Format token: `base64url(payloadJSON).base64url(hmac)`. Verifikasi memakai
 * `timingSafeEqual` (anti timing attack) lalu cek kedaluwarsa. Tamper apa pun →
 * null (fail-closed). Rahasia dari `MOMEN_SESSION_SECRET` (WAJIB di produksi).
 */

/** Masa berlaku sesi (durasi acara + buffer). */
export const MOMEN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface MomenSession {
  albumId: string;
  deviceId: string;
  guestName: string;
  /** Diterbitkan pada (epoch ms). */
  iat: number;
}

let warnedDevSecret = false;

/** Rahasia HMAC. Produksi WAJIB set; dev pakai konstanta (diperingatkan sekali). */
function resolveSecret(): string {
  const s = process.env.MOMEN_SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "MOMEN_SESSION_SECRET belum di-set — sesi tamu Album Momen tak bisa " +
        "ditandatangani dengan aman. Isi di env produksi.",
    );
  }
  if (!warnedDevSecret) {
    console.warn(
      "[momen] MOMEN_SESSION_SECRET belum di-set — memakai rahasia DEV (tak aman). Wajib diisi di produksi.",
    );
    warnedDevSecret = true;
  }
  return "dev-insecure-momen-session-secret";
}

function b64urlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

/** Tanda-tangani sesi → string cookie. `secret` bisa di-override untuk uji. */
export function signMomenSession(
  session: MomenSession,
  secret: string = resolveSecret(),
): string {
  const payloadB64 = b64urlEncode(JSON.stringify(session));
  return `${payloadB64}.${hmac(payloadB64, secret)}`;
}

/**
 * Verifikasi + parse token. Return sesi bila tanda tangan sah & belum
 * kedaluwarsa; null selainnya (bentuk salah, tanda tangan tak cocok, JSON rusak,
 * field hilang, kedaluwarsa). FAIL-CLOSED.
 */
export function verifyMomenSession(
  token: string | undefined | null,
  now: number = Date.now(),
  secret: string = resolveSecret(),
): MomenSession | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = hmac(payloadB64, secret);
  // Panjang harus sama sebelum timingSafeEqual (jika beda → pasti tak cocok).
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const s = parsed as Record<string, unknown>;
  if (
    typeof s.albumId !== "string" ||
    typeof s.deviceId !== "string" ||
    typeof s.guestName !== "string" ||
    typeof s.iat !== "number"
  ) {
    return null;
  }
  if (now - s.iat > MOMEN_SESSION_TTL_MS || now < s.iat - 60_000) return null;

  return {
    albumId: s.albumId,
    deviceId: s.deviceId,
    guestName: s.guestName,
    iat: s.iat,
  };
}
