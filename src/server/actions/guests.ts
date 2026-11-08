"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { isUuid, randomToken } from "@/lib/id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  guestSchema,
  type GuestInput,
  type GuestView,
} from "@/lib/validation/guest";
import type { Database } from "@/types/database";

type GuestRow = Database["public"]["Tables"]["guests"]["Row"];

function toView(r: GuestRow): GuestView {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    groupLabel: r.group_label,
    paxAllocated: r.pax_allocated,
    notes: r.notes,
    token: r.token,
    waClickedAt: r.wa_clicked_at,
    firstViewedAt: r.first_viewed_at,
  };
}

export type AddGuestResult =
  | { status: "success"; guest: GuestView }
  | {
      status: "error";
      reason?: "limit" | "invalid" | "auth";
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export type MutateGuestResult =
  | { status: "success"; guest: GuestView }
  | {
      status: "error";
      reason?: "invalid" | "auth";
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export type DeleteGuestResult =
  { status: "success" } | { status: "error"; message?: string };

/**
 * Tambah 1 tamu (SPEC §4.7). Pola wajib: auth → validasi Zod → kepemilikan →
 * RPC `insert_guest` (SECURITY INVOKER → RLS + limit paket ATOMIK di DB; token
 * dibuat server-side) → revalidate. NULL dari RPC = bukan pemilik / kuota penuh.
 * Tabrakan token (23505; nyaris mustahil) → ulangi dengan token baru.
 */
export async function addGuestAction(
  invitationId: string,
  input: GuestInput,
): Promise<AddGuestResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      status: "error",
      reason: "auth",
      message: copy.auth.genericAuthError,
    };
  if (!isUuid(invitationId)) return { status: "error", reason: "invalid" };

  const parsed = guestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      reason: "invalid",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const g = parsed.data;

  let row: GuestRow | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.rpc("insert_guest", {
      inv_id: invitationId,
      guest_name: g.name,
      guest_token: randomToken(14),
      guest_phone: g.phone,
      guest_group_label: g.groupLabel,
      guest_pax: g.paxAllocated,
      guest_notes: g.notes,
    });
    if (error) {
      if (error.code === "23505") continue; // tabrakan token → coba lagi
      return { status: "error", message: copy.common.error };
    }
    row = data as GuestRow | null;
    break;
  }

  // NULL = bukan pemilik / kuota penuh. Bedakan via kepemilikan (RLS).
  if (!row) {
    const { data: own } = await supabase
      .from("invitations")
      .select("slug")
      .eq("id", invitationId)
      .maybeSingle();
    if (!own) return { status: "error", reason: "auth" };
    return {
      status: "error",
      reason: "limit",
      message: copy.dashboard.guests.limitReached,
    };
  }

  revalidatePath(`/dashboard/undangan/${invitationId}/tamu`);
  return { status: "success", guest: toView(row) };
}

/**
 * Ubah 1 tamu (SPEC §4.7). Hanya field yang diedit pemilik; `token`,
 * `wa_clicked_at`, `first_viewed_at` TAK disentuh (token = identitas tamu &
 * calon QR Fase 2; timestamp diset sistem). RLS `guests_update` membatasi ke
 * undangan milik pemanggil.
 */
export async function updateGuestAction(
  invitationId: string,
  guestId: string,
  input: GuestInput,
): Promise<MutateGuestResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      status: "error",
      reason: "auth",
      message: copy.auth.genericAuthError,
    };
  if (!isUuid(invitationId) || !isUuid(guestId))
    return { status: "error", reason: "invalid" };

  const parsed = guestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      reason: "invalid",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const g = parsed.data;

  const { data: row, error } = await supabase
    .from("guests")
    .update({
      name: g.name,
      phone: g.phone ?? null,
      group_label: g.groupLabel ?? null,
      pax_allocated: g.paxAllocated,
      notes: g.notes ?? null,
    })
    .eq("id", guestId)
    .eq("invitation_id", invitationId)
    .select("*")
    .maybeSingle();

  if (error) return { status: "error", message: copy.common.error };
  if (!row) return { status: "error", message: copy.common.error };

  revalidatePath(`/dashboard/undangan/${invitationId}/tamu`);
  return { status: "success", guest: toView(row) };
}

/**
 * Hapus 1 tamu (SPEC §4.7). RLS `guests_delete` membatasi ke undangan milik
 * pemanggil. RSVP terkait tetap ada (`rsvps.guest_id` → SET NULL via FK) sebagai
 * catatan statistik.
 */
export async function deleteGuestAction(
  invitationId: string,
  guestId: string,
): Promise<DeleteGuestResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId) || !isUuid(guestId)) return { status: "error" };

  const { error } = await supabase
    .from("guests")
    .delete()
    .eq("id", guestId)
    .eq("invitation_id", invitationId);

  if (error) return { status: "error", message: copy.common.error };

  revalidatePath(`/dashboard/undangan/${invitationId}/tamu`);
  return { status: "success" };
}

/**
 * Tandai tombol "Kirim via WA" diklik (SPEC §4.7) → set `wa_clicked_at` sekali
 * (idempotent: hanya bila masih null). Auth → RLS `guests_update` (kepemilikan).
 * Best-effort penanda distribusi; kegagalan tak menghentikan alur kirim.
 */
export async function markWaClickedAction(
  invitationId: string,
  guestId: string,
): Promise<DeleteGuestResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };
  if (!isUuid(invitationId) || !isUuid(guestId)) return { status: "error" };

  const { error } = await supabase
    .from("guests")
    .update({ wa_clicked_at: new Date().toISOString() })
    .eq("id", guestId)
    .eq("invitation_id", invitationId)
    .is("wa_clicked_at", null);

  if (error) return { status: "error", message: copy.common.error };

  revalidatePath(`/dashboard/undangan/${invitationId}/sebar`);
  revalidatePath(`/dashboard/undangan/${invitationId}/tamu`);
  return { status: "success" };
}

/**
 * Batalkan tanda "terkirim" (DECISIONS #120). Penanda kini juga dipasang saat
 * "Salin pesan" dan saat tombol kirim diketuk SEBELUM pemilik benar-benar
 * mengirim (WhatsApp tak memberi sinyal terkirim lewat tautan resmi), jadi
 * salah ketuk / salah pilih kontak / batal kirim harus bisa ditarik kembali.
 * `first_viewed_at` TIDAK disentuh — itu bukti tamu membuka link, bukan tanda
 * pemilik. Auth → RLS `guests_update` (kepemilikan) → validasi id → update.
 */
export async function unmarkWaClickedAction(
  invitationId: string,
  guestId: string,
): Promise<DeleteGuestResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };
  if (!isUuid(invitationId) || !isUuid(guestId)) return { status: "error" };

  const { error } = await supabase
    .from("guests")
    .update({ wa_clicked_at: null })
    .eq("id", guestId)
    .eq("invitation_id", invitationId);

  if (error) return { status: "error", message: copy.common.error };

  revalidatePath(`/dashboard/undangan/${invitationId}/sebar`);
  revalidatePath(`/dashboard/undangan/${invitationId}/tamu`);
  return { status: "success" };
}
