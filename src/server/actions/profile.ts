"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation/auth";

import { errorState, fieldErrorState, type ActionState } from "./types";

/**
 * Perbarui profil (nama + WhatsApp). Kolom `role` TIDAK bisa disentuh client
 * (hardening kolom migrasi v1 §6b) — update lewat authenticated client dan RLS
 * membatasi ke baris sendiri.
 */
export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorState(copy.auth.genericAuthError);
  }

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") ?? undefined,
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  const normalizedPhone = parsed.data.phone
    ? normalizeIndonesianPhone(parsed.data.phone)
    : null;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: normalizedPhone })
    .eq("id", user.id);

  if (error) {
    return errorState(copy.common.error);
  }

  revalidatePath("/dashboard/profil");
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: copy.dashboard.profileSaved };
}
