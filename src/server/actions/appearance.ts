"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { parseAppearanceInput } from "@/lib/customizer/parse-appearance";
import { isUuid } from "@/lib/id";
import { toDbJson } from "@/lib/json";
import { reportHandledError } from "@/lib/observability";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, settingsSchema } from "@/lib/validation/content";
import { getEffectiveLimits } from "@/server/limits";
import { getThemeOptions } from "@/themes/theme-options-registry";

import { errorState, fieldErrorState, type ActionState } from "./types";

/**
 * Simpan kustomisasi tampilan (Fase G / CUSTOMIZER-SPEC §5). Pola wajib:
 * auth → cek kepemilikan (owner-scoped + RLS) → resolusi options tema →
 * **validasi Zod TERHADAP options schema + gating paket** (whitelist ketat;
 * accent hex & khusus Premium; sections permutasi valid; toggle:false wajib
 * tampil) → merge `custom` ke `settings` → simpan → `revalidatePath` halaman
 * publik (ISR berbasis path; konsisten dgn action lain).
 *
 * `custom` disimpan HANYA lewat jalur ini — jalur autosave konten mengabaikannya
 * (cegah bypass gating). Gating premium = `!limits.watermark` (penanda Basic).
 */
export async function updateInvitationAppearanceAction(
  id: string,
  input: unknown,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(copy.auth.genericAuthError);
  if (!isUuid(id)) return errorState(copy.common.error);

  // Kepemilikan: RLS + filter eksplisit user_id (defense-in-depth).
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, settings, theme_id, package_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!inv) return errorState(copy.common.error);

  const { data: theme, error: themeError } = await supabase
    .from("themes")
    .select("slug")
    .eq("id", inv.theme_id)
    .maybeSingle();
  // Galat DB ≠ "tema tak mendukung kustomisasi" (DECISIONS #45): dulu kedipan DB
  // dijawab pesan permanen yang keliru.
  if (themeError) {
    reportHandledError(themeError, "appearance.theme", { id });
    return errorState(copy.common.error);
  }
  const themeSlug = theme?.slug ?? null;
  if (!themeSlug || !getThemeOptions(themeSlug)) {
    return errorState(copy.appearance.unsupported);
  }

  // `getEffectiveLimits` MELEMPAR galat DB (DECISIONS #45) alih-alih pura-pura
  // Basic. Aksi membalas galat biasa — bukan menolak kustomisasi Premium milik
  // pemilik Premium hanya karena kedipan DB, dan bukan melempar ke klien.
  let premium: boolean;
  try {
    premium = !(await getEffectiveLimits(supabase, inv.package_id)).watermark;
  } catch (err) {
    // Ditangani → tak sampai `onRequestError`; laporkan sendiri.
    reportHandledError(err, "appearance.limits", { id });
    return errorState(copy.common.error);
  }
  const parsed = parseAppearanceInput(themeSlug, premium, input);
  if (!parsed.ok) {
    if (parsed.reason === "unsupported") {
      return errorState(copy.appearance.unsupported);
    }
    return fieldErrorState(parsed.fieldErrors ?? {}, copy.appearance.invalid);
  }

  const existing =
    settingsSchema.safeParse(inv.settings).data ?? DEFAULT_SETTINGS;
  const nextSettings = { ...existing, custom: parsed.custom };

  const { error } = await supabase
    .from("invitations")
    .update({ settings: toDbJson(nextSettings) })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return errorState(copy.appearance.error);

  // Segarkan cache ISR halaman publik (efektif saat aktif; no-op saat draft).
  revalidatePath(`/${inv.slug}`);
  revalidatePath(`/dashboard/undangan/${id}/tampilan`);
  return { status: "success", message: copy.appearance.saved };
}

/**
 * Reset tampilan ke bawaan tema (CUSTOMIZER-SPEC §7): buang `settings.custom`
 * → tema render default. Auth + kepemilikan sama seperti di atas.
 */
export async function resetInvitationAppearanceAction(
  id: string,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(copy.auth.genericAuthError);
  if (!isUuid(id)) return errorState(copy.common.error);

  const { data: inv } = await supabase
    .from("invitations")
    .select("slug, settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!inv) return errorState(copy.common.error);

  const existing =
    settingsSchema.safeParse(inv.settings).data ?? DEFAULT_SETTINGS;
  const nextSettings = { ...existing };
  delete nextSettings.custom;

  const { error } = await supabase
    .from("invitations")
    .update({ settings: toDbJson(nextSettings) })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return errorState(copy.appearance.error);

  revalidatePath(`/${inv.slug}`);
  revalidatePath(`/dashboard/undangan/${id}/tampilan`);
  return { status: "success", message: copy.appearance.saved };
}
