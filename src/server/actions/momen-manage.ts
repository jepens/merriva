"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import {
  momenModerationSchema,
  momenSettingsSchema,
} from "@/lib/momen/momen-settings-schema";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Aksi HOST Album Momen (dashboard) — pengaturan, moderasi, reveal (MOMEN-SPEC
 * §5). Pola: **auth → cek kepemilikan (RLS undangan) → operasi (service_role) →
 * revalidate**. Baris `momen_albums`/`momen_photos` hanya bisa DIUBAH via
 * service_role (RLS: pemilik SELECT saja, admin ALL) → kepemilikan diverifikasi
 * di server SEBELUM mutasi service_role.
 */

export type MomenManageResult =
  { status: "success" } | { status: "error"; message?: string };

/**
 * Verifikasi pemanggil memiliki undangan (RLS) lalu ambil id album-nya. Null =
 * bukan pemilik / tak ada album.
 */
async function resolveOwnedAlbumId(
  invitationId: string,
): Promise<{ albumId: string } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // RLS `invitations_select` → hanya baris milik pemanggil yang terbaca.
  const { data: inv } = await supabase
    .from("invitations")
    .select("id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return null;

  const admin = createSupabaseAdminClient();
  const { data: album } = await admin
    .from("momen_albums")
    .select("id")
    .eq("invitation_id", invitationId)
    .maybeSingle();
  if (!album) return null;
  return { albumId: album.id };
}

function revalidate(invitationId: string): void {
  revalidatePath(`/dashboard/undangan/${invitationId}/momen`);
}

/** Simpan pengaturan album (jatah/tamu, reveal, filter default, upload galeri). */
export async function updateMomenSettingsAction(
  invitationId: string,
  raw: unknown,
): Promise<MomenManageResult> {
  if (!isUuid(invitationId)) return { status: "error" };
  const parsed = momenSettingsSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: copy.common.error };

  const owned = await resolveOwnedAlbumId(invitationId);
  if (!owned) return { status: "error", message: copy.auth.genericAuthError };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("momen_albums")
    .update({
      quota_per_guest: parsed.data.quotaPerGuest,
      reveal_at: parsed.data.revealAt,
      default_filter: parsed.data.defaultFilter,
      allow_library_upload: parsed.data.allowLibraryUpload,
    })
    .eq("id", owned.albumId);
  if (error) return { status: "error", message: copy.common.error };

  revalidate(invitationId);
  return { status: "success" };
}

/** Buka foto untuk semua sekarang (reveal_at = instan). Tak bisa dibatalkan. */
export async function revealMomenNowAction(
  invitationId: string,
): Promise<MomenManageResult> {
  if (!isUuid(invitationId)) return { status: "error" };
  const owned = await resolveOwnedAlbumId(invitationId);
  if (!owned) return { status: "error", message: copy.auth.genericAuthError };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("momen_albums")
    .update({ reveal_at: null })
    .eq("id", owned.albumId);
  if (error) return { status: "error", message: copy.common.error };

  revalidate(invitationId);
  return { status: "success" };
}

/**
 * Moderasi satu foto: sembunyikan / tampilkan / hapus. Host boleh melihat semua
 * foto pra-reveal (jalur dashboard service_role). Hapus = buang baris + objek
 * storage (best-effort) + turunkan `photo_count` (rem plafon tetap konsisten).
 */
export async function moderateMomenPhotoAction(
  invitationId: string,
  raw: unknown,
): Promise<MomenManageResult> {
  if (!isUuid(invitationId)) return { status: "error" };
  const parsed = momenModerationSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: copy.common.error };

  const owned = await resolveOwnedAlbumId(invitationId);
  if (!owned) return { status: "error", message: copy.auth.genericAuthError };

  const admin = createSupabaseAdminClient();
  // Foto WAJIB milik album pemilik ini (cegah moderasi foto album lain).
  const { data: photo } = await admin
    .from("momen_photos")
    .select("id, storage_path, thumb_path")
    .eq("id", parsed.data.photoId)
    .eq("album_id", owned.albumId)
    .maybeSingle();
  if (!photo) return { status: "error", message: copy.common.error };

  if (parsed.data.action === "delete") {
    const { error } = await admin
      .from("momen_photos")
      .delete()
      .eq("id", photo.id)
      .eq("album_id", owned.albumId);
    if (error) return { status: "error", message: copy.common.error };

    // Turunkan counter (dua langkah; moderasi jarang & owner-only → race abai).
    const { data: album } = await admin
      .from("momen_albums")
      .select("photo_count")
      .eq("id", owned.albumId)
      .maybeSingle();
    if (album) {
      await admin
        .from("momen_albums")
        .update({ photo_count: Math.max(0, album.photo_count - 1) })
        .eq("id", owned.albumId);
    }

    const storage = getStorage();
    await Promise.allSettled([
      storage.delete(photo.storage_path),
      storage.delete(photo.thumb_path),
    ]);
  } else {
    const status = parsed.data.action === "hide" ? "hidden" : "visible";
    const { error } = await admin
      .from("momen_photos")
      .update({ status })
      .eq("id", photo.id)
      .eq("album_id", owned.albumId);
    if (error) return { status: "error", message: copy.common.error };
  }

  revalidate(invitationId);
  return { status: "success" };
}
