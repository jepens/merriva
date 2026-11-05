import { isUuid } from "@/lib/id";
import { ENCODE_EXT } from "@/lib/image/encode";
import {
  isVariantBlob,
  VIDEO_EXT_BY_TYPE,
  VIDEO_POSTER_MAX_BYTES,
  videoFilePath,
  videoPosterPath,
  videoPrefix,
} from "@/lib/media";
import { reportHandledError } from "@/lib/observability";
import { checkClientRateLimit } from "@/lib/request-ip";
import { getStorage } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateVideoFile, VIDEO_MAX_BYTES } from "@/lib/video";
import type { VideoUploadResult } from "@/server/actions/video";
import { getEffectiveLimits } from "@/server/limits";

/**
 * Unggah video undangan (FASE J) — pola wajib repo tetap utuh (auth → kepemilikan
 * → validasi → operasi), tetapi lewat Route Handler, BUKAN Server Action:
 *
 *  1. Server Action dibatasi `serverActions.bodySizeLimit` (3MB) secara GLOBAL.
 *     Menaikkannya ke 40MB berlaku untuk SETIAP aksi, termasuk aksi publik
 *     anonim (ucapan tamu, unggah Album Momen) yang body-nya ditampung penuh
 *     sebelum rate limit di dalamnya sempat menolak.
 *  2. Server Action editor di-POST ke `/dashboard/...`, yang dilewati middleware.
 *     Body yang melewati middleware digandakan dan DIPOTONG DIAM-DIAM di 10MB
 *     (`proxyClientMaxBodySize`) — tanpa galat, aksinya hanya menerima separuh
 *     berkas. `/api` sengaja di luar matcher middleware.
 *
 * Di sini auth, kepemilikan, dan paket diperiksa SEBELUM body dibaca, dan
 * `Content-Length` disaring lebih dulu — hanya pemilik undangan berpaket video
 * yang bisa membuat server menampung 40MB. Server TIDAK mentranskode (keputusan
 * owner): tipe & ukuran divalidasi, durasi & orientasi ditegakkan klien.
 *
 * TIDAK menulis DB — `content.video` disimpan autosave (pola `named-photo.ts`;
 * baca alasannya di sana).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Video + poster + kelonggaran pembatas multipart. */
const MAX_BODY = VIDEO_MAX_BYTES + VIDEO_POSTER_MAX_BYTES + 64 * 1024;

function jawab(body: VideoUploadResult, status: number): Response {
  return Response.json(body, { status });
}

/**
 * Server Action memeriksa asal permintaan secara bawaan; route handler tidak.
 * Cookie sesi `SameSite=Lax` sudah menolak POST lintas situs, ini lapis kedua
 * dengan perbandingan yang sama dengan Next (Origin vs host yang diteruskan).
 */
function asalSama(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))
    ?.split(",")[0]
    ?.trim();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: invitationId } = await params;
  if (!isUuid(invitationId) || !asalSama(req)) {
    return jawab({ status: "error", reason: "invalid" }, 400);
  }

  // Disaring sebelum apa pun dibaca. `fetch` dengan FormData selalu mengirim
  // Content-Length; yang tak mengirimnya bukan editor kita.
  const panjang = Number(req.headers.get("content-length"));
  if (!Number.isFinite(panjang) || panjang <= 0 || panjang > MAX_BODY) {
    return jawab({ status: "error", reason: "invalid" }, 413);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jawab({ status: "error", reason: "auth" }, 401);

  // Unggahan 40MB jauh lebih mahal dari foto → jendela jauh lebih ketat.
  if (
    !(await checkClientRateLimit("video-upload", { max: 6, windowMs: 60_000 }))
      .ok
  ) {
    return jawab({ status: "error", reason: "rate" }, 429);
  }

  const { data: inv } = await supabase
    .from("invitations")
    .select("id, package_id")
    .eq("id", invitationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!inv) return jawab({ status: "error", reason: "auth" }, 404);

  // PENEGAKAN PAKET DI SERVER: flag `youtube` = fitur video untuk KEDUA sumber.
  // Draft tanpa paket jatuh ke lantai Basic (tanpa video).
  const limits = await getEffectiveLimits(supabase, inv.package_id, user.id);
  if (!limits.youtube) {
    return jawab({ status: "error", reason: "limit" }, 403);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jawab({ status: "error", reason: "invalid" }, 400);
  }

  const video = form.get("video");
  const ext = video instanceof Blob ? VIDEO_EXT_BY_TYPE[video.type] : undefined;
  if (
    !(video instanceof Blob) ||
    video.size === 0 ||
    validateVideoFile({ type: video.type, size: video.size }) !== null ||
    !ext
  ) {
    return jawab({ status: "error", reason: "invalid" }, 400);
  }

  // Poster opsional (bingkai ±0,5 dtk; peramban yang gagal menggambarnya tetap
  // boleh mengunggah). Bila ada, aturannya aturan varian foto: webp|jpeg.
  const poster = form.get("poster");
  if (poster !== null && !isVariantBlob(poster, VIDEO_POSTER_MAX_BYTES)) {
    return jawab({ status: "error", reason: "invalid" }, 400);
  }

  const prefix = videoPrefix(invitationId, crypto.randomUUID());
  const videoPath = videoFilePath(prefix, ext);
  const posterPath = poster
    ? videoPosterPath(
        prefix,
        poster.type === "image/jpeg" ? ENCODE_EXT.jpeg : ENCODE_EXT.webp,
      )
    : undefined;

  const storage = getStorage();
  try {
    await storage.upload({
      path: videoPath,
      body: video,
      contentType: video.type,
    });
    if (poster && posterPath) {
      await storage.upload({
        path: posterPath,
        body: poster,
        contentType: poster.type,
      });
    }
  } catch (err) {
    reportHandledError(err, "media.video.upload", { invitationId });
    await Promise.allSettled(
      [videoPath, posterPath]
        .filter((p): p is string => Boolean(p))
        .map((p) => storage.delete(p)),
    );
    return jawab({ status: "error", reason: "server" }, 500);
  }

  return jawab(
    {
      status: "success",
      video: { path: videoPath, ...(posterPath ? { poster: posterPath } : {}) },
      url: storage.getPublicUrl(videoPath),
      posterUrl: posterPath ? storage.getPublicUrl(posterPath) : null,
    },
    200,
  );
}
