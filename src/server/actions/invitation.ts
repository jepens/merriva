"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { copy } from "@/lib/copy";
import { localToUtc } from "@/lib/datetime";
import { draftSlug, isUuid } from "@/lib/id";
import { toDbJson } from "@/lib/json";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/request-ip";
import { slugSchema } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_SETTINGS,
  emptyContent,
  settingsSchema,
} from "@/lib/validation/content";
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

  // `settings.custom` (kustomisasi tampilan, Fase G) DIMILIKI EKSKLUSIF oleh
  // `updateInvitationAppearance`. Jalur autosave ini MENGABAIKAN `custom` dari
  // klien (cegah bypass gating Premium lewat skema base yang permisif) dan
  // MEMPERTAHANKAN nilai milik server (cegah kehilangan kustomisasi saat pemilik
  // mengedit konten).
  const settingsSansCustom = { ...settings };
  delete settingsSansCustom.custom;
  const { data: current } = await supabase
    .from("invitations")
    .select("settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const serverCustom = settingsSchema.safeParse(current?.settings).data?.custom;
  const settingsToWrite = serverCustom
    ? { ...settingsSansCustom, custom: serverCustom }
    : settingsSansCustom;

  const { data: saved, error } = await supabase
    .from("invitations")
    .update({
      content: toDbJson(content),
      settings: toDbJson(settingsToWrite),
      event_date: eventDate ? eventDate : null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("slug")
    .maybeSingle();

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

  // Segarkan cache ISR halaman publik (efektif saat undangan sudah aktif; no-op
  // aman selagi draft). Slug bisa berubah, tapi hanya saat draft (belum publik).
  if (saved?.slug) revalidatePath(`/${saved.slug}`);

  return { status: "success" };
}

/** Hasil pengecekan ketersediaan slug (M1.3d). */
export type SlugCheckResult = {
  status: "available" | "taken" | "invalid" | "error";
  message?: string;
};

/** Hasil penyimpanan slug (M1.3d). */
export type SlugSaveResult =
  | { status: "success"; slug: string }
  | {
      status: "error";
      reason?: "taken" | "not_draft" | "invalid";
      message?: string;
    };

/**
 * Cek ketersediaan slug real-time (SPEC §4 Flow A langkah 5). Pola: auth →
 * validasi format (slugSchema) → pastikan undangan milik pemanggil (RLS) → cek
 * keunikan LINTAS-pemilik via admin client (RLS SELECT owner-only tak dapat
 * melihat slug pemilik lain). Hanya membaca kolom `id` → tak membocorkan data;
 * slug memang alamat publik. Guard keunikan sebenarnya adalah constraint UNIQUE
 * saat simpan — ini murni untuk UX. TODO(M2): rate-limit endpoint ini.
 */
export async function checkSlugAvailabilityAction(
  invitationId: string,
  rawSlug: string,
): Promise<SlugCheckResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  // Rate-limit (M2): batasi probing keberadaan slug lintas-tenant. Ringan —
  // murni UX; keunikan sebenarnya dijamin constraint UNIQUE saat simpan.
  const rl = checkRateLimit(await clientRateKey("slug-check"), {
    max: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) return { status: "error", message: copy.auth.rateLimited };

  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    return { status: "invalid", message: parsed.error.issues[0]?.message };
  }
  const slug = parsed.data;

  // Kepemilikan (RLS membatasi ke baris sendiri): id asing → tolak. Juga
  // memastikan `invitationId` sah untuk di-exclude dari cek keunikan.
  const { data: own } = await supabase
    .from("invitations")
    .select("id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!own) return { status: "error" };

  const admin = createSupabaseAdminClient();
  const { data: clash, error } = await admin
    .from("invitations")
    .select("id")
    .eq("slug", slug)
    .neq("id", invitationId)
    .maybeSingle();
  if (error) return { status: "error" };

  return { status: clash ? "taken" : "available" };
}

/**
 * Simpan slug undangan (SPEC §4 Flow A langkah 5). Pola: auth → validasi format
 * → UPDATE ter-scope owner + `status='draft'` (slug tak boleh berubah setelah
 * aktif; mengubahnya memutus tautan WA yang sudah tersebar) → revalidate.
 * Keunikan dijamin constraint UNIQUE: tabrakan balapan → 23505 → "sudah dipakai".
 */
export async function updateInvitationSlugAction(
  invitationId: string,
  rawSlug: string,
): Promise<SlugSaveResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    return {
      status: "error",
      reason: "invalid",
      message: parsed.error.issues[0]?.message,
    };
  }
  const slug = parsed.data;

  const { data: updated, error } = await supabase
    .from("invitations")
    .update({ slug })
    .eq("id", invitationId)
    .eq("user_id", user.id)
    .eq("status", "draft")
    .select("slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        reason: "taken",
        message: copy.editor.slug.taken,
      };
    }
    return { status: "error", message: copy.common.error };
  }
  // 0 baris ter-update → bukan draft (atau bukan milik pemanggil).
  if (!updated) {
    return {
      status: "error",
      reason: "not_draft",
      message: copy.editor.slug.notDraft,
    };
  }

  revalidatePath(`/dashboard/undangan/${invitationId}/edit`);
  revalidatePath("/dashboard");
  return { status: "success", slug: updated.slug };
}
