"use server";

import { isUuid } from "@/lib/id";
import { isVideoObjectPath } from "@/lib/media";
import { checkClientRateLimit } from "@/lib/request-ip";
import { getStorage } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Hasil `POST /api/invitations/{id}/video` (FASE J). UNGGAHNYA sengaja bukan
 * Server Action — lihat docstring route itu: Server Action dibatasi 3MB global
 * dan body yang melewati middleware `/dashboard` dipotong diam-diam di 10MB,
 * padahal video boleh 40MB. Tipenya tinggal di sini supaya route dan editor
 * berbagi satu definisi (route.ts hanya boleh mengekspor handler).
 *
 * Pola induknya tetap `named-photo.ts`: unggah TIDAK menulis DB. Editor menaruh
 * `video` ke `content.video` dan AUTOSAVE yang menyimpannya.
 */
export type VideoUploadResult =
  | {
      status: "success";
      video: { path: string; poster?: string };
      url: string;
      posterUrl: string | null;
    }
  | {
      status: "error";
      reason: "auth" | "invalid" | "limit" | "rate" | "server";
    };

export type VideoDeleteResult = { status: "success" } | { status: "error" };

/**
 * Hapus objek video + poster (saat diganti atau dibuang). Best-effort —
 * rujukannya di `content` sudah dilepas form sebelum ini dipanggil.
 *
 * TIDAK digerbang paket: pemilik yang turun paket tetap harus bisa membuang
 * videonya. Gerbangnya `isVideoObjectPath` (alasan sama dengan
 * `deleteNamedPhotoAction`): path datang dari klien, dan tanpa pencocokan bentuk
 * penuh terhadap `invitationId` pemanggil, ia bisa menghapus objek undangan lain.
 */
export async function deleteInvitationVideoAction(
  invitationId: string,
  paths: string[],
): Promise<VideoDeleteResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };
  if (!isUuid(invitationId)) return { status: "error" };
  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.length > 2 ||
    !paths.every(
      (p) => typeof p === "string" && isVideoObjectPath(invitationId, p),
    )
  ) {
    return { status: "error" };
  }

  if (
    !(
      await checkClientRateLimit("video-delete", {
        max: 30,
        windowMs: 60_000,
      })
    ).ok
  ) {
    return { status: "error" };
  }

  const { data: own } = await supabase
    .from("invitations")
    .select("id")
    .eq("id", invitationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!own) return { status: "error" };

  const storage = getStorage();
  await Promise.allSettled(paths.map((p) => storage.delete(p)));
  return { status: "success" };
}
