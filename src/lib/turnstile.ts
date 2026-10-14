import "server-only";

import { appUrl } from "@/lib/env";
import { reportHandledError } from "@/lib/observability";

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
 * Kode `error-codes` siteverify yang berarti **kita** salah pasang, bukan
 * pengunjung yang gagal. Dipisahkan karena volumenya berbeda jauh: penolakan
 * bot itu wajar dan terjadi terus-menerus, sedangkan secret yang salah membuat
 * SETIAP form di situs gagal — dan keduanya terlihat sama dari luar.
 */
const KODE_SALAH_PASANG = new Set([
  "missing-input-secret",
  "invalid-input-secret",
  "bad-request",
  "internal-error",
]);

/**
 * Host yang sah untuk token Turnstile, diturunkan dari `NEXT_PUBLIC_APP_URL`
 * (+ varian www). Site key bersifat publik → tanpa cek hostname, token yang
 * di-solve dari origin pihak ketiga bisa lolos. NULL bila appUrl tak
 * valid/kosong (dev) → cek hostname dilewati.
 *
 * `localhost` dan `127.0.0.1` HANYA di luar produksi. Keduanya dulu ada tanpa
 * syarat, dan itu membatalkan gerbang ini justru di satu-satunya tempat ia
 * dibutuhkan: site key kita memang publik, jadi siapa pun bisa menyajikan
 * widget di `http://localhost:8080` miliknya sendiri, menyelesaikan tantangan,
 * lalu mengirim tokennya ke Server Action produksi — siteverify menjawab
 * `hostname: "localhost"`, dan daftar lama MENERIMANYA (DECISIONS #78).
 *
 * `base` ada demi test: ia menguji apex↔www dan kedua cabang produksi tanpa
 * perlu membangun ulang modul hanya untuk mengganti satu variabel env.
 */
export function allowedTurnstileHosts(
  base: string = appUrl,
): Set<string> | null {
  try {
    const host = new URL(base).hostname.toLowerCase();
    const set = new Set([host]);
    set.add(host.startsWith("www.") ? host.slice(4) : `www.${host}`);
    if (process.env.NODE_ENV !== "production") {
      set.add("localhost");
      set.add("127.0.0.1");
    }
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
      // Gagal-tutup itu benar, tetapi SENYAP: yang dialami pengunjung adalah
      // "Verifikasi anti-bot gagal" di RSVP, buku ucapan, amplop, Album Momen,
      // dan pendaftaran — serentak, tanpa satu pun jejak. Dilaporkan DAN
      // di-console: Sentry adalah jejak yang bertahan begitu DSN diisi, console
      // satu-satunya yang berfungsi sebelum itu (pola sama seperti
      // `email.receipt` di notify.ts).
      reportHandledError(
        new Error("TURNSTILE_SECRET_KEY kosong di produksi"),
        "security.turnstile.secret-unset",
      );
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
      "error-codes"?: string[];
    };
    if (data.success !== true) {
      // Hanya kelas SALAH PASANG yang dilaporkan. Melaporkan setiap penolakan
      // akan membanjiri Sentry dengan bot yang memang sedang ditolak — persis
      // kebisingan yang membuat orang berhenti membaca laporannya.
      const salahPasang = (data["error-codes"] ?? []).filter((c) =>
        KODE_SALAH_PASANG.has(c),
      );
      if (salahPasang.length > 0) {
        reportHandledError(
          new Error(`siteverify: ${salahPasang.join(",")}`),
          "security.turnstile.verify",
          { errorCodes: salahPasang },
        );
      }
      return false;
    }

    // Defense-in-depth: token harus berasal dari host aplikasi (bukan origin
    // pihak ketiga yang menyematkan widget dgn site key publik kita).
    const allowed = allowedTurnstileHosts();
    if (allowed && data.hostname && !allowed.has(data.hostname.toLowerCase())) {
      // Dua sebab yang sangat berbeda bermuara ke sini, dan laporan inilah yang
      // membedakannya: token dari origin pihak ketiga (serangan), atau `appUrl`
      // kita sendiri menunjuk host yang salah (salah pasang — dan saat itu
      // SELURUH form situs gagal). Hostname bukan PII, jadi ia ikut agar yang
      // membaca Sentry tak perlu menebak mana dari keduanya.
      reportHandledError(
        new Error(`hostname token tak dikenal: ${data.hostname}`),
        "security.turnstile.host",
        { hostname: data.hostname, allowed: [...allowed] },
      );
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
