import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import type { CronJobName } from "./record";

/**
 * Status kesehatan scheduled job untuk panel admin (AUDIT-2026-10-01).
 *
 * Yang dijawab di sini bukan "apakah job gagal" — itu bagian yang mudah —
 * melainkan **"apakah job ini masih jalan sama sekali"**. Job yang dihapus dari
 * panel Easypanel, salah ketik perintahnya, atau mati setelah redeploy tidak
 * meninggalkan galat apa pun; ia hanya BERHENTI. Satu-satunya jejaknya adalah
 * `last_run_at` yang membasi.
 */

export type CronHealth = "ok" | "gagal" | "basi" | "belum-pernah";

export interface CronStatus {
  name: CronJobName;
  health: CronHealth;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  runs: number;
  failures: number;
}

/**
 * Jadwal yang diharapkan, dalam jam. Nilai ini HARUS cocok dengan perintah cron
 * di panel Easypanel (`docs/LAUNCH-CHECKLIST.md` Fase 3) — bila jadwalnya kelak
 * diubah di sana tanpa diubah di sini, panel akan menuduh job yang sehat.
 */
const JADWAL_JAM: Record<CronJobName, number> = {
  "expire-orders": 1,
  "expire-invitations": 24,
  "expiry-reminders": 24,
  "purge-expired": 24,
};

export const CRON_JOBS = Object.keys(JADWAL_JAM) as CronJobName[];

/**
 * Ambang basi = DUA kali jadwalnya. Sekali lewat masih bisa berarti jitter
 * penjadwal atau redeploy yang kebetulan bertepatan; dua kali berarti ada yang
 * salah. Lebih baik telat menuduh daripada memerahkan panel tiap minggu sampai
 * orang berhenti mempercayainya.
 */
export function hitungHealth(
  row: { last_run_at: string; ok: boolean } | undefined,
  name: CronJobName,
  nowMs: number,
): CronHealth {
  if (!row) return "belum-pernah";
  const umurJam = (nowMs - Date.parse(row.last_run_at)) / 3_600_000;
  if (umurJam > JADWAL_JAM[name] * 2) return "basi";
  return row.ok ? "ok" : "gagal";
}

export async function fetchCronStatus(
  admin: SupabaseClient<Database>,
  nowMs: number = Date.now(),
): Promise<CronStatus[]> {
  // Galat dibiarkan: panel admin tak boleh mati karena tabel jejaknya
  // bermasalah. Baris yang tak terbaca tampil sebagai "belum pernah", yang
  // memang perlu diperiksa manusia.
  const { data } = await admin
    .from("cron_runs")
    .select("name, last_run_at, last_ok_at, ok, last_error, runs, failures");

  const byName = new Map((data ?? []).map((r) => [r.name, r]));

  return CRON_JOBS.map((name) => {
    const row = byName.get(name);
    return {
      name,
      health: hitungHealth(row, name, nowMs),
      lastRunAt: row?.last_run_at ?? null,
      lastOkAt: row?.last_ok_at ?? null,
      lastError: row?.last_error ?? null,
      runs: row?.runs ?? 0,
      failures: row?.failures ?? 0,
    };
  });
}
