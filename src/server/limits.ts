import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { BASIC_LIMITS, resolveLimits, type PackageLimits } from "@/lib/limits";
import { dataOrThrow } from "@/lib/supabase/result";
import { isPaymentExempt } from "@/server/guards/auth";
import type { Database } from "@/types/database";

/**
 * Batas paket efektif untuk sebuah undangan (sisi baca — watermark, penghitung
 * kuota di dashboard, halaman publik M2). Draft tanpa paket → lantai Basic,
 * KECUALI draft milik admin/Pro → batas paket teratas (DECISIONS #115):
 * paket itulah yang mereka dapat gratis saat aktivasi (§4.8), jadi mengunci
 * fitur Premium selama draft hanya menyuruh mereka "membeli" yang sudah gratis.
 * `ownerId` = `invitations.user_id`, BUKAN user sesi: admin yang membuka draft
 * pelanggan tetap melihat lantai Basic pelanggan itu.
 *
 * OTORITAS penegakan tetap di DB (RPC atomik). Fungsi ini hanya membaca paket
 * untuk RESOLUSI/TAMPILAN — cerminnya `invitation_effective_limits` (migrasi
 * 20261105160000) yang menegakkan kuota foto & tamu dengan aturan yang sama.
 * Memakai client terikat sesi (RLS): bila paket tak terlihat (nonaktif / tak
 * ada) → lantai Basic yang aman (watermark = true).
 *
 * Galat DB DILEMPAR, bukan dianggap "tak ada paket" (DECISIONS #45): dulu satu
 * kedipan DB saat halaman ISR `/{slug}` dirender meng-cache undangan Premium
 * sebagai Basic (watermark tampil) sampai simpanan berikutnya.
 */
export async function getEffectiveLimits(
  supabase: SupabaseClient<Database>,
  packageId: string | null,
  ownerId?: string | null,
): Promise<PackageLimits> {
  if (!packageId) {
    if (!ownerId || !(await isPaymentExempt(supabase, ownerId))) {
      return BASIC_LIMITS;
    }
    // Paket teratas = yang ditawarkan aktivasi gratis (halaman aktifkan:
    // paket undangan aktif, urut harga naik, ambil yang terakhir).
    const top = dataOrThrow(
      await supabase
        .from("packages")
        .select("limits")
        .eq("is_active", true)
        .eq("kind", "invitation")
        .order("price_idr", { ascending: false })
        // Pemecah seri yang sama dengan halaman aktifkan & DB: harga sama →
        // urutan tak dijamin, dan draft bisa memakai paket lain dari yang
        // diberikan "Aktifkan gratis".
        .order("code", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "packages",
    );
    return resolveLimits(top?.limits);
  }

  const data = dataOrThrow(
    await supabase
      .from("packages")
      .select("limits")
      .eq("id", packageId)
      .maybeSingle(),
    "packages",
  );

  return resolveLimits(data?.limits);
}
