/**
 * TEMPLATE REFERENSI — server/actions/video.ts (FASE J langkah J2).
 * BUKAN drop-in: impor & helper path harus disesuaikan dengan `lib/media` /
 * `lib/storage` aktual saat diterapkan. Pola induk: `named-photo.ts`
 * (aksi TIDAK menulis DB — `content.video` disimpan autosave; baca komentar
 * panjang di file itu sebelum mengubah apa pun) + TAMBAHAN penegakan paket
 * `limits.youtube` di server (fitur berbayar, beda dari foto bernama).
 */
"use server";

/* eslint-disable -- template referensi; aktifkan lint setelah disesuaikan */
// @ts-nocheck

import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { reportHandledError } from "@/lib/observability";
import { checkClientRateLimit } from "@/lib/request-ip";
import { getStorage } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateVideoFile, VIDEO_MAX_BYTES } from "@/lib/video";
// Dari J2 (lib/media atau lib/video-paths):
// videoPrefix(invitationId): `video/${invitationId}/${crypto.randomUUID()}`
// videoObjectPaths(prefix, ext): [`${prefix}/video.${ext}`, `${prefix}/poster.webp`]
import { videoObjectPaths, videoPrefix } from "@/lib/media";
import { getEffectiveLimits } from "@/server/limits";

const EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export type VideoUploadResult =
  | { status: "success"; path: string; posterPath: string }
  | { status: "error"; reason?: "auth" | "invalid" | "limit"; message?: string };

export async function uploadInvitationVideoAction(
  invitationId: string,
  formData: FormData,
): Promise<VideoUploadResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { status: "error", reason: "auth", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error", reason: "invalid" };

  // Unggahan 40 MB jauh lebih mahal dari foto → jendela rate-limit lebih ketat.
  if (!(await checkClientRateLimit("video-upload", { max: 6, windowMs: 60_000 })).ok)
    return { status: "error", message: copy.auth.rateLimited };

  // Kepemilikan + paket dalam SATU bacaan (RLS tetap pagar utama).
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, package_id")
    .eq("id", invitationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!inv) return { status: "error", reason: "invalid" };

  // PENEGAKAN TIER DI SERVER (bukan hanya UI): flag paket `youtube` = fitur
  // video (kedua sumber). getEffectiveLimits butuh client admin? — ikuti
  // pemakaian aktual di app/[slug]/page.tsx.
  const limits = await getEffectiveLimits(/* sesuaikan */ supabase, inv.package_id);
  if (!limits.youtube) return { status: "error", reason: "limit" };

  const video = formData.get("video");
  const poster = formData.get("poster");
  if (
    !(video instanceof Blob) ||
    validateVideoFile({ type: video.type, size: video.size }) !== null ||
    video.size === 0
  )
    return { status: "error", reason: "invalid" };
  // Poster = varian webp/jpeg dari pipeline foto klien — validasi dengan
  // helper varian yang sudah ada (isVariantBlob + batas bytes thumb/display).
  if (!(poster instanceof Blob) || poster.size === 0 || poster.size > 1_500_000)
    return { status: "error", reason: "invalid" };

  // CATATAN: durasi & orientasi TIDAK bisa divalidasi server tanpa transcoder —
  // ditegakkan klien (lib/video.ts). Batas byte tetap pagar biaya di server.

  const prefix = videoPrefix(invitationId);
  const ext = EXT_BY_TYPE[video.type];
  const [videoPath, posterPath] = videoObjectPaths(prefix, ext);

  const storage = getStorage();
  try {
    await storage.upload(videoPath, video, video.type);
    await storage.upload(posterPath, poster, poster.type);
  } catch (e) {
    reportHandledError(e, { scope: "video-upload" });
    return { status: "error", message: copy.common.error };
  }

  // TANPA tulis DB: form men-set content.video = { path: prefix, poster:…,
  // width, height, durationSec } lalu AUTOSAVE menyimpannya (pola named-photo).
  return { status: "success", path: prefix, posterPath };
}

export async function deleteInvitationVideoAction(
  invitationId: string,
  prefix: string,
): Promise<{ status: "success" } | { status: "error" }> {
  // auth → kepemilikan → validasi prefix milik undangan ini (bentuk
  // `video/{invitationId}/…`, tolak path lain) → hapus objek-objek prefix →
  // sukses. content.video dikosongkan form + autosave.
  throw new Error("sesuaikan dengan pola deleteNamedPhotoAction");
}
