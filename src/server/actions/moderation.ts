"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  rsvpModerationSchema,
  type RsvpModerationInput,
} from "@/lib/validation/guestbook";

export type ModerationResult =
  { status: "success" } | { status: "error"; message?: string };

/**
 * Moderasi satu RSVP oleh pemilik (SPEC §4.6): setujui / sembunyikan / tampilkan.
 * Pola wajib: auth → validasi → kepemilikan → UPDATE → revalidate. Memakai
 * client user (BUKAN service-role): RLS `rsvps_update` membatasi ke undangan
 * milik pemanggil, dan grant kolom DB hanya mengizinkan `is_hidden`/`is_approved`
 * — data kiriman tamu tak bisa ditulis ulang meski action disalahgunakan.
 * Dinding publik dibaca ulang saat halaman dimuat (bukan ISR), jadi perubahan
 * langsung berlaku tanpa revalidate halaman undangan.
 */
export async function moderateRsvpAction(
  invitationId: string,
  rsvpId: string,
  patch: RsvpModerationInput,
): Promise<ModerationResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId) || !isUuid(rsvpId)) return { status: "error" };

  const parsed = rsvpModerationSchema.safeParse(patch);
  if (!parsed.success) return { status: "error", message: copy.common.error };

  const update: { is_hidden?: boolean; is_approved?: boolean } = {};
  if (parsed.data.isHidden !== undefined)
    update.is_hidden = parsed.data.isHidden;
  if (parsed.data.isApproved !== undefined)
    update.is_approved = parsed.data.isApproved;

  // UPDATE ter-scope id RSVP + undangan; RLS memastikan hanya pemilik yang bisa.
  // `select` mengonfirmasi baris benar-benar milik pemanggil (0 baris → tolak).
  const { data: row, error } = await supabase
    .from("rsvps")
    .update(update)
    .eq("id", rsvpId)
    .eq("invitation_id", invitationId)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: copy.common.error };
  if (!row) return { status: "error", message: copy.common.error };

  revalidatePath(`/dashboard/undangan/${invitationId}/ucapan`);
  return { status: "success" };
}
