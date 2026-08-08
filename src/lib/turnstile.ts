import "server-only";

import { appUrl } from "@/lib/env";

/**
 * Verifikasi token Cloudflare Turnstile di server (SPEC §4.6 anti-spam).
 *
 * Bila `TURNSTILE_SECRET_KEY` belum diset (dev/lokal) → verifikasi DILEWATI
 * (return true) dengan peringatan sekali, sehingga form tetap bisa diuji tanpa
 * kredensial. **Produksi WAJIB** mengisi secret (dan `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
 * agar proteksi bot aktif — lihat `.env.example`. Bila secret ada tetapi token
 * kosong/verifikasi gagal → GAGAL-TUTUP (return false).
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let warnedMissingSecret = false;

/**
 * Host yang sah untuk token Turnstile, diturunkan dari `NEXT_PUBLIC_APP_URL`
 * (+ varian www + localhost dev). Site key bersifat publik → tanpa cek hostname,
 * token yang di-solve dari origin pihak ketiga bisa lolos. NULL bila appUrl tak
 * valid/kosong (dev) → cek hostname dilewati.
 */
function allowedTurnstileHosts(): Set<string> | null {
  try {
    const host = new URL(appUrl).hostname.toLowerCase();
    const set = new Set([host, "localhost", "127.0.0.1"]);
    set.add(host.startsWith("www.") ? host.slice(4) : `www.${host}`);
    return set;
  } catch {
    return null;
  }
}

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    // Produksi tanpa secret = salah konfigurasi → GAGAL-TUTUP (jangan diam-diam
    // menonaktifkan proteksi bot). Hanya dev yang boleh melewati verifikasi.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[turnstile] TURNSTILE_SECRET_KEY WAJIB di produksi — verifikasi GAGAL-TUTUP.",
      );
      return false;
    }
    if (!warnedMissingSecret) {
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY belum diset — verifikasi dilewati (hanya dev). Wajib diisi di produksi.",
      );
      warnedMissingSecret = true;
    }
    return true;
  }

  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as {
      success?: boolean;
      hostname?: string;
    };
    if (data.success !== true) return false;

    // Defense-in-depth: token harus berasal dari host aplikasi (bukan origin
    // pihak ketiga yang menyematkan widget dgn site key publik kita).
    const allowed = allowedTurnstileHosts();
    if (allowed && data.hostname && !allowed.has(data.hostname.toLowerCase())) {
      console.error(`[turnstile] hostname token tak dikenal: ${data.hostname}`);
      return false;
    }
    return true;
  } catch {
    return false; // gagal-tutup
  }
}

/** Apakah widget Turnstile perlu dirender di klien (site key tersedia). */
export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
