import { NextResponse } from "next/server";

import { getMediaBaseUrl, getStorageDriver } from "@/lib/env";
import {
  type MasalahMedia,
  periksaPasanganMedia,
} from "@/lib/storage/konfigurasi";

// Selalu dievaluasi per request (tanpa cache) — health harus mencerminkan kondisi terkini.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DB_TIMEOUT_MS = 2500;

type DbStatus = "up" | "down" | "not_configured";

/**
 * Probe reachability Supabase (PostgREST) tanpa ketergantungan skema.
 * - `not_configured`: env Supabase belum di-set (mis. build/CI) → app tetap dianggap hidup.
 * - `up`: endpoint REST merespons OK.
 * - `down`: tidak terjangkau / timeout / error.
 */
async function checkDatabase(): Promise<DbStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // WAJIB service_role: Supabase membatasi `GET /rest/v1/` (spec OpenAPI) hanya
  // untuk service_role — anon dijawab 401 "Only the `service_role` API key can
  // be used for this endpoint". Dengan anon, health SELALU 503, `HEALTHCHECK`
  // Docker menandai container unhealthy, Swarm membunuhnya (exit 143), dan
  // deployment terjebak restart loop tanpa satu pun galat di log aplikasi.
  // Route ini server-only (`runtime = "nodejs"`), jadi kunci tak pernah ke klien.
  // `||`, bukan `??`: di panel deployment variabel kerap ADA tetapi bernilai
  // kosong — `??` akan meneruskan string kosong itu sebagai kunci dan probe
  // dijawab 401, persis kegagalan yang hendak dicegah.
  const probeKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !probeKey) return "not_configured";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/`, {
      headers: { apikey: probeKey, Authorization: `Bearer ${probeKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok ? "up" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Pasangan `STORAGE_DRIVER` (runtime) × `NEXT_PUBLIC_MEDIA_URL` (build-time).
 *
 * Diperiksa DI SINI, bukan saat render: melempar di `getMediaBaseUrl()` akan
 * mengubah halaman yang terdegradasi menjadi 500 bagi setiap tamu (insiden
 * DECISIONS #82), dan karena lazy ia tak akan pernah menggagalkan healthcheck.
 * Di health, image yang tak cocok ditolak SEBELUM menerima trafik.
 *
 * Dibungkus try/catch karena `getMediaBaseUrl()` sengaja melempar saat
 * NEXT_PUBLIC_MEDIA_URL kosong di produksi — itu kondisi tak sehat yang
 * berbeda, dan health tetap harus menjawab alih-alih ikut mati.
 */
function periksaMedia(): MasalahMedia | null {
  try {
    return periksaPasanganMedia({
      driver: getStorageDriver(),
      mediaBaseUrl: getMediaBaseUrl(),
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    });
  } catch (err) {
    return {
      kode: "media-env-invalid",
      pesan:
        err instanceof Error ? err.message : "konfigurasi media tak terbaca",
    };
  }
}

/**
 * Basis media yang BENAR-BENAR terpasang di image ini.
 *
 * Bukan rahasia: nilainya muncul di `src` setiap gambar pada setiap undangan.
 * Dipancarkan karena ia satu-satunya build-arg yang tak terverifikasi di mana
 * pun — `NEXT_PUBLIC_MEDIA_URL` hanya dibaca `getMediaBaseUrl()`, yang seluruh
 * pemanggilnya adalah driver `server-only`, sehingga nilainya TIDAK PERNAH
 * sampai ke chunk peramban dan tak bisa dipindai seperti DSN Sentry atau
 * sitekey Turnstile. Tanpa ini, `pnpm ops:verify` terpaksa menebak host media
 * dan akan salah tepat setelah cutover.
 */
function basisMedia(): string {
  try {
    return getMediaBaseUrl();
  } catch {
    return "";
  }
}

export async function GET() {
  const db = await checkDatabase();
  const media = periksaMedia();
  const healthy = db !== "down" && media === null;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      db,
      media: media ? media.kode : "ok",
      ...(media ? { mediaPesan: media.pesan } : {}),
      mediaBase: basisMedia(),
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
