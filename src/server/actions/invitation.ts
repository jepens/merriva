"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { copy } from "@/lib/copy";
import { localToUtc } from "@/lib/datetime";
import { draftSlug, isUuid } from "@/lib/id";
import { toDbJson } from "@/lib/json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";
import {
  createInvitationSchema,
  saveDraftSchema,
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

/**
 * Autosave draft (SPEC §4.4). Pola: auth → validasi Zod longgar (draft) →
 * UPDATE `content/settings/event_date` (RLS + grant kolom §6b membatasi ke
 * baris sendiri; kolom lifecycle tak tersentuh). Jadwal & slug punya jalur
 * tersendiri (M1.3c/d).
 */
export async function saveInvitationDraftAction(
  id: string,
  patch: unknown,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(copy.auth.genericAuthError);
  if (!isUuid(id)) return errorState(copy.common.error);

  const parsed = saveDraftSchema.safeParse(patch);
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }
  const { content, settings, eventDate, events } = parsed.data;

  const { error } = await supabase
    .from("invitations")
    .update({
      content: toDbJson(content),
      settings: toDbJson(settings),
      event_date: eventDate ? eventDate : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return errorState(copy.common.error);

  // Jadwal: konversi waktu-lokal (settings.timezone) → UTC, ganti sesi atomik
  // via RPC (SECURITY INVOKER → RLS membatasi ke undangan sendiri).
  const tz = settings.timezone;
  const eventRows = events
    .map((e, i) => {
      const startUtc = e.startAt ? localToUtc(e.startAt, tz) : null;
      if (!startUtc) return null;
      return {
        name: e.name ?? "",
        start_at: startUtc,
        end_at: e.endAt ? localToUtc(e.endAt, tz) : null,
        venue_name: e.venueName ?? null,
        address: e.address ?? null,
        maps_url: e.mapsUrl ?? null,
        sort_order: i,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error: evError } = await supabase.rpc("replace_invitation_events", {
    inv_id: id,
    events: toDbJson(eventRows),
  });
  if (evError) return errorState(copy.common.error);

  return { status: "success" };
}
