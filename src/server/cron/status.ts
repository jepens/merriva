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
  // 12 jam, bukan 24 — alasannya sudah tertulis di docstring route-nya sendiri
  // (`src/app/api/cron/expiry-reminders/route.ts`) jauh sebelum angka ini dibuat:
  // "tandai hanya saat terkirim" bersifat at-least-once, jadi email yang berhasil
  // dikirim tetapi gagal menandai `reminder_sent_at` akan terpilih lagi — dan
  // satu-satunya penjaga kirim-ganda adalah `idempotencyKey` Resend yang HANYA
  // berlaku 24 jam. Kadens 24 jam menaruh retry-nya persis di tepi jendela itu.
  //
  // Angka ini sebelumnya 24 dan BERTENTANGAN dengan route-nya selama berbulan-
  // bulan; terlewat saat `purge-expired` dinaikkan (DECISIONS #67) walau
  // argumennya identik. Keduanya kini sejalan.
  "expiry-reminders": 12,
  // 12 jam, bukan 24: job ini kini juga mengirim peringatan pra-purge (B7),
  // dan `idempotencyKey` Resend hanya berlaku 24 jam — kadens di bawah itu
  // mencegah peringatan ganda bila penandaan gagal setelah email terkirim.
  "purge-expired": 12,
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
