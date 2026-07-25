"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { copy } from "@/lib/copy";
import { draftSlug } from "@/lib/id";
import { toDbJson } from "@/lib/json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";
import {
  createInvitationSchema,
  type CreateInvitationInput,
} from "@/lib/validation/invitation";

import { errorState, fieldErrorState, type ActionState } from "./types";

/**
 * Buat draft undangan (SPEC Flow A langkah 3). Pola wajib: auth → validasi Zod
 * → cek tema mendukung kategori → INSERT draft (status default `draft`; kolom
 * lifecycle terkunci di level privilege, migrasi v4) → redirect ke editor.
 * Slug awal sementara (`draft-…`); pemilik menetapkan slug asli di editor.
 */
export async function createInvitationAction(
  input: CreateInvitationInput,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(copy.auth.genericAuthError);

  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }
  const { category, themeSlug } = parsed.data;

  const { data: theme } = await supabase
    .from("themes")
    .select("id, categories")
    .eq("slug", themeSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!theme || !theme.categories.includes(category)) {
    return errorState(copy.create.themeUnavailable);
  }

  const { data: inv, error } = await supabase
    .from("invitations")
    .insert({
      user_id: user.id,
      theme_id: theme.id,
      slug: draftSlug(),
      category,
      content: toDbJson(emptyContent(category)),
      settings: toDbJson(DEFAULT_SETTINGS),
    })
    .select("id")
    .single();

  if (error || !inv) return errorState(copy.common.error);

  revalidatePath("/dashboard");
  redirect(`/dashboard/undangan/${inv.id}/edit`);
}
