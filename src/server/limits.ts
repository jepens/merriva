import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { BASIC_LIMITS, resolveLimits, type PackageLimits } from "@/lib/limits";
import type { Database } from "@/types/database";

/**
 * Batas paket efektif untuk sebuah undangan (sisi baca — watermark, penghitung
 * kuota di dashboard, halaman publik M2). Draft tanpa paket → lantai Basic.
 *
 * OTORITAS penegakan tetap di DB (RPC atomik). Fungsi ini hanya membaca paket
 * untuk RESOLUSI/TAMPILAN. Memakai client terikat sesi (RLS): bila paket tak
 * terlihat (nonaktif / tak ada) → lantai Basic yang aman (watermark = true).
 */
export async function getEffectiveLimits(
  supabase: SupabaseClient<Database>,
  packageId: string | null,
): Promise<PackageLimits> {
  if (!packageId) return BASIC_LIMITS;

  const { data } = await supabase
    .from("packages")
    .select("limits")
    .eq("id", packageId)
    .maybeSingle();

  return resolveLimits(data?.limits);
}
