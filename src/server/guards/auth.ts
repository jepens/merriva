import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";

import { SupabaseReadError } from "@/lib/supabase/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/types";
import type { Database } from "@/types/database";

/** User terautentikasi (terverifikasi via Supabase Auth), atau null bila belum login. */
export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Wajib login — redirect ke /masuk bila belum. Dipakai route dashboard/admin (M1+). */
export async function requireUser(next?: string) {
  const user = await getSessionUser();
  if (!user) {
    // `next` membawa tujuan yang SEDANG dituju pengunjung. Tanpa itu ia
    // mendarat di `/dashboard` setelah masuk — dan niat yang membawanya ke sini
    // (mis. tema yang baru ia pilih di katalog) hilang tanpa jejak.
    redirect(next ? `/masuk?next=${encodeURIComponent(next)}` : "/masuk");
  }
  return user;
}

/** Role profil user saat ini ('client' default), atau null bila belum login. */
export async function getCurrentRole(): Promise<ProfileRole | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: ProfileRole }>();

  return data?.role ?? "client";
}

/**
 * Admin & Pro tak pernah ditagih (DECISIONS #100). Dibaca dari `profiles.role`
 * — kolom yang tak bisa ditulis klien (grant kolom, init_schema §6b). Galat
 * baca DILEMPAR: menelannya berarti diam-diam mengirim admin ke pembayaran.
 *
 * Pemanggil WAJIB juga mensyaratkan undangan MILIK user: RLS memperlihatkan
 * semua undangan kepada admin.
 */
export async function isPaymentExempt(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new SupabaseReadError("profiles.role", error);
  return data?.role === "admin" || data?.role === "pro";
}

/**
 * Wajib admin (SPEC §4.9). Belum login → redirect `/masuk`; login tapi bukan
 * admin → `notFound()` (404) agar keberadaan route admin TAK terkonfirmasi ke
 * `client` ("role client tidak bisa membuka satu pun route/API admin"). Role
 * dibaca via RLS `profiles_select` (baris sendiri) → tak bisa dipalsukan klien.
 * Dipakai di layout `(admin)` + setiap Server Action admin (defense-in-depth di
 * atas middleware + RLS admin-ALL).
 */
export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: ProfileRole }>();
  if (data?.role !== "admin") notFound();
  return user;
}
