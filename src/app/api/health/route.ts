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
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return "not_configured";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
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
