"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { toDbJson } from "@/lib/json";
import { reportHandledError } from "@/lib/observability";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  THEME_SLUG_RE,
  bolehGantiTema,
  settingsTanpaKustom,
  temaPremiumTerkunci,
} from "@/lib/theme-switch";
import { getEffectiveLimits } from "@/server/limits";
import { getThemeLoader } from "@/themes/registry";

import { errorState, type ActionState } from "./types";

/**
 * Ganti tema undangan (SPEC §4.4 "Ganti tema", DECISIONS #124). Pola wajib:
 * auth → kepemilikan (owner-scoped + RLS) → validasi (uuid, slug) → status
 * (bukan suspended/purged) → tema aktif, sekategori, kodenya terpasang →
 * aturan paket tema premium → SATU UPDATE `theme_id` + `settings` tanpa
 * `custom` → revalidasi. Trigger `enforce_theme_change` menegakkan aturan
 * tema sekali lagi (termasuk order `pending` berpaket non-Premium), dan
 * galatnya diterjemahkan ke pesan Indonesia di sini.
 */
export async function changeInvitationThemeAction(
  id: string,
  themeSlug: unknown,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(copy.auth.genericAuthError);
  if (!isUuid(id)) return errorState(copy.common.error);
  if (typeof themeSlug !== "string" || !THEME_SLUG_RE.test(themeSlug)) {
    return errorState(copy.themeSwitch.unavailable);
  }

  const { data: inv, error: invError } = await supabase
    .from("invitations")
    .select(
      "id, slug, status, category, settings, theme_id, package_id, purged_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (invError) {
    reportHandledError(invError, "theme-switch.invitation", { id });
    return errorState(copy.common.error);
  }
  if (!inv) return errorState(copy.common.error);
  if (!bolehGantiTema(inv)) return errorState(copy.themeSwitch.notAllowed);

  const { data: theme, error: themeError } = await supabase
    .from("themes")
    .select("id, slug, tier, categories, is_active")
    .eq("slug", themeSlug)
    .maybeSingle();
  // Galat DB ≠ "tema tak tersedia" (DECISIONS #45).
  if (themeError) {
    reportHandledError(themeError, "theme-switch.theme", { id });
    return errorState(copy.themeSwitch.error);
  }
  if (
    !theme ||
    !theme.is_active ||
    !theme.categories.includes(inv.category) ||
    // Baris katalog tanpa kode tema = tak bisa dirender (mis. seed mendahului
    // deploy). Jangan biarkan undangan aktif jatuh ke "tema belum tersedia".
    !getThemeLoader(theme.slug)
  ) {
    return errorState(copy.themeSwitch.unavailable);
  }
  if (theme.id === inv.theme_id) {
    return { status: "success", message: copy.themeSwitch.saved };
  }

  if (theme.tier === "premium") {
    let terkunci: boolean;
    try {
      const limits = await getEffectiveLimits(
        supabase,
        inv.package_id,
        user.id,
      );
      terkunci = temaPremiumTerkunci(theme.tier, inv, limits);
    } catch (err) {
      reportHandledError(err, "theme-switch.limits", { id });
      return errorState(copy.common.error);
    }
    if (terkunci) return errorState(copy.themeSwitch.needsPremium);
  }

  const { error } = await supabase
    .from("invitations")
    .update({
      theme_id: theme.id,
      settings: toDbJson(settingsTanpaKustom(inv.settings)),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    // Penolakan trigger (check_violation). Paket SUDAH lolos pemeriksaan di
    // atas, jadi tolakan "premium" di sini berarti ada order undangan Basic
    // yang masih menunggu bayar — bukan ajakan upgrade (upgrade tak tersedia
    // untuk draft/pending_payment/expired).
    if (error.code === "23514") {
      return errorState(
        /premium/i.test(error.message)
          ? copy.themeSwitch.pendingOrder
          : copy.themeSwitch.unavailable,
      );
    }
    reportHandledError(error, "theme-switch.update", { id });
    return errorState(copy.themeSwitch.error);
  }

  // Halaman publik (efektif saat aktif; no-op saat draft), pratinjau tautan
  // ikut `updated_at` baru, dan halaman pemilik yang menampilkan tema.
  revalidatePath(`/${inv.slug}`);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/undangan/${id}/edit`);
  revalidatePath(`/dashboard/undangan/${id}/tema`);
  revalidatePath(`/dashboard/undangan/${id}/tampilan`);
  return { status: "success", message: copy.themeSwitch.saved };
}
