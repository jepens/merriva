"use server";

import { cookies } from "next/headers";

import { copy } from "@/lib/copy";
import { matchesDeclaredFormat } from "@/lib/image/magic-bytes";
import {
  MOMEN_LIMITS,
  momenSessionStartSchema,
  momenUploadMetaSchema,
} from "@/lib/momen/momen-settings-schema";
import {
  MOMEN_SESSION_TTL_MS,
  signMomenSession,
  verifyMomenSession,
} from "@/lib/momen/session";
import { momenObjectPaths } from "@/lib/momen/storage-path";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientRateKey, getClientIp } from "@/lib/request-ip";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * Aksi TAMU Album Momen (FASE H, MOMEN-SPEC §4–§6). Tamu ANON tak menyentuh DB
 * langsung — aksi ini berjalan di server: verifikasi sesi HMAC + Turnstile +
 * rate-limit, lalu memanggil RPC lewat service_role. Pemrosesan gambar HANYA di
 * browser klien; server hanya memvalidasi tipe/ukuran/MAGIC-BYTE lalu menyimpan.
 *
 * Alur unggah = confirm-gated (DECISIONS #22): claim (pra-cek lembut) → unggah
 * objek → confirm (gerbang ATOMIK advisory-lock). Kuota tak bisa tembus paralel.
 */

const COOKIE_NAME = "momen_sess";
const SESSION_LIMIT = { max: 20, windowMs: 60_000 };
const UPLOAD_LIMIT = { max: 60, windowMs: 60_000 };

export type MomenSessionState =
  | { status: "ok"; remaining: number; deviceCount: number }
  | { status: "error"; message?: string };

export type MomenUploadState =
  { status: "ok"; remaining: number } | { status: "error"; message?: string };

interface ActiveAlbum {
  albumId: string;
  quotaPerGuest: number;
}

/**
 * Resolusi album AKTIF dari slug undangan (service_role; tamu anon tak punya
 * akses RLS). Fail-closed: undangan tak `active` / tanpa album / album non-aktif
 * → null.
 */
async function resolveActiveAlbum(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  slug: string,
): Promise<ActiveAlbum | null> {
  const { data: inv } = await admin
    .from("invitations")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!inv || inv.status !== "active") return null;

  const { data: album } = await admin
    .from("momen_albums")
    .select("id, status, quota_per_guest")
    .eq("invitation_id", inv.id)
    .maybeSingle();
  if (!album || album.status !== "active") return null;

  return { albumId: album.id, quotaPerGuest: album.quota_per_guest };
}

/** Berapa foto yang sudah diambil perangkat ini di album (dasar sisa jatah). */
async function deviceShotCount(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  albumId: string,
  deviceId: string,
): Promise<number> {
  const { count } = await admin
    .from("momen_photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", albumId)
    .eq("device_id", deviceId);
  return count ?? 0;
}

/** Pesan lokal dari alasan penolakan RPC (claim/confirm). */
function denyMessage(result: string): string {
  switch (result) {
    case "guest-quota":
      return copy.momen.error.guestQuota;
    case "peserta-penuh":
      return copy.momen.error.pesertaFull;
    case "album-full":
      return copy.momen.error.albumFull;
    case "not_active":
    case "not_found":
      return copy.momen.error.notActive;
    default:
      return copy.momen.error.generic;
  }
}

/**
 * Mulai sesi tamu: verifikasi Turnstile → ikat {albumId, deviceId, guestName} ke
 * cookie ber-tanda-tangan. Mengembalikan sisa jatah perangkat agar UI menampilkan
 * pips. Rate-limit per-jaringan (redam pembuatan sesi massal / brute Turnstile).
 */
export async function startMomenSessionAction(
  slug: string,
  formData: FormData,
): Promise<MomenSessionState> {
  if (!checkRateLimit(await clientRateKey("momen-session"), SESSION_LIMIT).ok) {
    return { status: "error", message: copy.momen.error.rateLimited };
  }

  const parsed = momenSessionStartSchema.safeParse({
    guestName: formData.get("guestName"),
    deviceId: formData.get("deviceId"),
  });
  if (!parsed.success) {
    return { status: "error", message: copy.momen.error.invalid };
  }

  const token = formData.get("turnstileToken");
  const okBot = await verifyTurnstile(
    typeof token === "string" ? token : undefined,
    await getClientIp(),
  );
  if (!okBot) return { status: "error", message: copy.momen.error.turnstile };

  const admin = createSupabaseAdminClient();
  const album = await resolveActiveAlbum(admin, slug);
  if (!album) return { status: "error", message: copy.momen.error.notActive };

  const deviceCount = await deviceShotCount(
    admin,
    album.albumId,
    parsed.data.deviceId,
  );

  const cookie = signMomenSession({
    albumId: album.albumId,
    deviceId: parsed.data.deviceId,
    guestName: parsed.data.guestName,
    iat: Date.now(),
  });
  const store = await cookies();
  store.set(COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(MOMEN_SESSION_TTL_MS / 1000),
  });

  return {
    status: "ok",
    deviceCount,
    remaining: Math.max(0, album.quotaPerGuest - deviceCount),
  };
}

function isAcceptedBlob(value: unknown, maxBytes: number): value is Blob {
  return (
    value instanceof Blob &&
    (value.type === "image/webp" || value.type === "image/jpeg") &&
    value.size > 0 &&
    value.size <= maxBytes
  );
}

/**
 * Unggah satu foto (sudah di-bake filter + di-encode klien = 2 varian). Identitas
 * tamu (album/device/nama) HANYA dari cookie ber-tanda-tangan — bukan form. Meta
 * foto divalidasi Zod + MAGIC-BYTE (tolak PNG/spoof). claim → unggah → confirm
 * (atomik). Gagal confirm → objek dibersihkan (best-effort; orphan tak tertebak).
 */
export async function uploadMomenPhotoAction(
  slug: string,
  formData: FormData,
): Promise<MomenUploadState> {
  if (!checkRateLimit(await clientRateKey("momen-upload"), UPLOAD_LIMIT).ok) {
    return { status: "error", message: copy.momen.error.rateLimited };
  }

  // Sesi ter-tanda-tangan → identitas tepercaya.
  const store = await cookies();
  const session = verifyMomenSession(store.get(COOKIE_NAME)?.value);
  if (!session) return { status: "error", message: copy.momen.error.session };

  const admin = createSupabaseAdminClient();
  const album = await resolveActiveAlbum(admin, slug);
  // Sesi harus untuk album yang SAMA dengan slug ini (cegah pakai-ulang lintas).
  if (!album || album.albumId !== session.albumId) {
    return { status: "error", message: copy.momen.error.notActive };
  }

  // Meta foto (gabung identitas sesi + field form) → skema strict penuh.
  const meta = momenUploadMetaSchema.safeParse({
    guestName: session.guestName,
    deviceId: session.deviceId,
    filterId: formData.get("filterId"),
    format: formData.get("format"),
    width: Number(formData.get("width")),
    height: Number(formData.get("height")),
    displayBytes: Number(formData.get("displayBytes")),
    thumbBytes: Number(formData.get("thumbBytes")),
  });
  if (!meta.success) {
    return { status: "error", message: copy.momen.error.invalid };
  }
  const { format } = meta.data;

  const display = formData.get("display");
  const thumb = formData.get("thumb");
  if (
    !isAcceptedBlob(display, MOMEN_LIMITS.displayBytesMax) ||
    !isAcceptedBlob(thumb, MOMEN_LIMITS.thumbBytesMax)
  ) {
    return { status: "error", message: copy.momen.error.invalid };
  }

  // MAGIC-BYTE: byte awal harus cocok format yang dideklarasikan (bukan hanya
  // Blob.type/nama yang dapat dipalsukan). PNG/spoof → tolak.
  const displayBuf = await display.arrayBuffer();
  const thumbBuf = await thumb.arrayBuffer();
  if (
    !matchesDeclaredFormat(displayBuf, format) ||
    !matchesDeclaredFormat(thumbBuf, format)
  ) {
    return { status: "error", message: copy.momen.error.invalid };
  }

  // Claim (pra-cek lembut) → dapat photo_id untuk membentuk path.
  const { data: claimRows, error: claimErr } = await admin.rpc(
    "momen_claim_upload",
    { p_album_id: album.albumId, p_device_id: session.deviceId },
  );
  if (claimErr) return { status: "error", message: copy.momen.error.generic };
  const claim = claimRows?.[0];
  if (!claim || claim.result !== "ok" || !claim.photo_id) {
    return {
      status: "error",
      message: denyMessage(claim?.result ?? "generic"),
    };
  }
  const photoId = claim.photo_id;

  const [displayPath, thumbPath] = momenObjectPaths(
    album.albumId,
    photoId,
    format,
  );
  const storage = getStorage();
  const cleanup = () =>
    Promise.allSettled([
      storage.delete(displayPath),
      storage.delete(thumbPath),
    ]);

  try {
    await storage.upload({
      path: displayPath,
      body: displayBuf,
      contentType: display.type,
    });
    await storage.upload({
      path: thumbPath,
      body: thumbBuf,
      contentType: thumb.type,
    });
  } catch {
    await cleanup();
    return { status: "error", message: copy.momen.error.generic };
  }

  // Confirm = gerbang ATOMIK (advisory lock): cek ulang kuota lalu sisip baris +
  // naikkan photo_count dalam satu transaksi. Bytes = ukuran display AKTUAL.
  const { data: confirmRows, error: confirmErr } = await admin.rpc(
    "momen_confirm_photo",
    {
      p_album_id: album.albumId,
      p_photo_id: photoId,
      p_device_id: session.deviceId,
      p_guest_name: session.guestName,
      p_filter_id: meta.data.filterId,
      p_storage_path: displayPath,
      p_thumb_path: thumbPath,
      p_width: meta.data.width,
      p_height: meta.data.height,
      p_bytes: display.size,
    },
  );
  if (confirmErr) {
    await cleanup();
    return { status: "error", message: copy.momen.error.generic };
  }
  const confirm = confirmRows?.[0];
  if (!confirm || confirm.result !== "ok") {
    await cleanup();
    return {
      status: "error",
      message: denyMessage(confirm?.result ?? "generic"),
    };
  }

  return { status: "ok", remaining: confirm.remaining };
}
