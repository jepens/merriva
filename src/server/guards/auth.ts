import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/types";

/** User terautentikasi (terverifikasi via Supabase Auth), atau null bila belum login. */
export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Wajib login — redirect ke /masuk bila belum. Dipakai route dashboard/admin (M1+). */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/masuk");
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
