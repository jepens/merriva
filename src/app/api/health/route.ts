import { NextResponse } from "next/server";

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

export async function GET() {
  const db = await checkDatabase();
  const healthy = db !== "down";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
