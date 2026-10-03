import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Catat hasil satu eksekusi scheduled job (AUDIT-2026-10-01).
 *
 * Empat cron memegang kewajiban hukum (retensi UU PDP), komersial (aktivasi
 * order lunas), dan kontraktual (pengingat H-14) — tetapi kegagalannya hanya
 * jadi exit code curl di panel Easypanel, dan NON-EKSEKUSI tak meninggalkan
 * sinyal apa pun. Baris ini yang dibaca `/admin` untuk menandai job yang
 * berhenti jalan.
 *
 * **Best-effort dan TAK PERNAH melempar.** Jejak adalah pendamping, bukan efek
 * utama: kegagalan mencatat tidak boleh menggagalkan purge retensi yang sudah
 * berhasil. Konsekuensinya diterima sadar — bila DB-nya sendiri yang mati, baik
 * job maupun jejaknya sama-sama gagal, dan yang terlihat di panel adalah
 * `last_run_at` yang membasi. Itu justru sinyal yang benar.
 */

/** Nama job = segmen route-nya, supaya tak ada peta yang perlu dirawat. */
export type CronJobName =
  "expire-orders" | "expire-invitations" | "expiry-reminders" | "purge-expired";

export async function recordCronRun(
  name: CronJobName,
  ok: boolean,
  stats: Record<string, unknown> = {},
  error?: unknown,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    // Baca dulu untuk menaikkan penghitung: `orders`-style upsert tak bisa
    // menambah nilai lama tanpa RPC, dan satu RPC untuk ini tak sepadan.
    const { data: prev } = await admin
      .from("cron_runs")
      .select("runs, failures, last_ok_at")
      .eq("name", name)
      .maybeSingle();

    await admin.from("cron_runs").upsert(
      {
        name,
        last_run_at: now,
        last_ok_at: ok ? now : (prev?.last_ok_at ?? null),
        ok,
        stats: stats as never,
        // Pesan dipotong & TANPA detail baris: cron ini menyentuh data tamu,
        // dan pesan Postgres bisa memuat nilai kolom.
        last_error: ok ? null : ringkasGalat(error),
        runs: (prev?.runs ?? 0) + 1,
        failures: (prev?.failures ?? 0) + (ok ? 0 : 1),
      },
      { onConflict: "name" },
    );
  } catch {
    // Sengaja ditelan — lihat docblock.
  }
}

function ringkasGalat(error: unknown): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "unknown");
  return raw.slice(0, 300);
}
