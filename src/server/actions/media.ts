"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import {
  displayPath,
  isVariantBlob,
  MEDIA_MAX_BYTES,
  mediaObjectPaths,
  mediaPrefix,
  thumbPath,
  toMediaView,
} from "@/lib/media";
import { checkClientRateLimit } from "@/lib/request-ip";
import { getStorage } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InvitationMediaView } from "@/types/invitation";

export type MediaUploadResult =
  | { status: "success"; item: InvitationMediaView }
  | {
      status: "error";
      reason?: "limit" | "invalid" | "auth";
      message?: string;
    };

export type MediaDeleteResult =
  { status: "success" } | { status: "error"; message?: string };

// Aturan varian (WebP, atau JPEG fallback iOS) hidup di `lib/media` supaya
// galeri dan foto bernama memakai daftar yang sama. Content-type storage tetap
// diambil dari `blob.type` aktual, bukan diasumsikan webp.

function sanitizeDimension(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 6000 ? Math.trunc(n) : null;
}

/**
 * Unggah 1 foto galeri (SPEC §4.4 step 4). Pola wajib: auth → kepemilikan (RLS)
 * → validasi 2 varian WebP → PENEGAKAN LIMIT PAKET di server (bukan hanya UI) →
 * unggah via lib/storage → INSERT baris `media` (RLS owns_invitation) →
 * revalidate. Server TIDAK memproses gambar; hanya memvalidasi tipe & ukuran.
 * Rate-limit per-jaringan (defense-in-depth: unggah berulang = beban storage).
 */
export async function uploadGalleryPhotoAction(
  invitationId: string,
  formData: FormData,
): Promise<MediaUploadResult> {
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

  // Batas paket (maks 20 foto) ditegakkan atomik di DB; ini plafon per-jaringan
  // untuk meredam unggah berulang (retry/abuse) yang membebani storage.
  if (
    !(
      await checkClientRateLimit("media-upload", {
        max: 40,
        windowMs: 60_000,
      })
    ).ok
  ) {
    return { status: "error", message: copy.auth.rateLimited };
  }

  const display = formData.get("display");
  const thumb = formData.get("thumb");
  if (
    !isVariantBlob(display, MEDIA_MAX_BYTES.display) ||
    !isVariantBlob(thumb, MEDIA_MAX_BYTES.thumb)
  ) {
    return {
      status: "error",
      reason: "invalid",
      message: copy.editor.gallery.invalidFile,
    };
  }
  // Dimensi selalu dikirim klien dari hasil kompresi; wajib valid (bukan null).
  const width = sanitizeDimension(formData.get("width"));
  const height = sanitizeDimension(formData.get("height"));
  if (width === null || height === null) {
    return {
      status: "error",
      reason: "invalid",
      message: copy.editor.gallery.invalidFile,
    };
  }

  // Cek kepemilikan cepat (RLS) agar tak mengunggah untuk undangan asing.
  // Penegakan limit sebenarnya (atomik + anti-override) ada di RPC di bawah.
  // `slug` diambil untuk revalidasi ISR halaman publik.
  const { data: own } = await supabase
    .from("invitations")
    .select("id, slug")
    .eq("id", invitationId)
    .maybeSingle();
  if (!own) return { status: "error", reason: "auth" };

  const mediaId = crypto.randomUUID();
  const prefix = mediaPrefix(invitationId, mediaId);
  const storage = getStorage();
  const cleanup = () =>
    Promise.allSettled(mediaObjectPaths(prefix).map((p) => storage.delete(p)));

  try {
    await storage.upload({
      path: displayPath(prefix),
      body: await display.arrayBuffer(),
      contentType: display.type, // webp atau jpeg (fallback iOS) — nyata dari blob
    });
    await storage.upload({
      path: thumbPath(prefix),
      body: await thumb.arrayBuffer(),
      contentType: thumb.type,
    });
  } catch {
    await cleanup();
    return { status: "error", message: copy.common.error };
  }

  // Sisip ATOMIK: RPC memegang advisory lock per-undangan, menghitung limit
  // paket sendiri di DB (tak bisa di-override), dan menetapkan sort_order=max+1.
  // NULL = limit penuh / bukan pemilik.
  const { data: row, error } = await supabase.rpc("insert_gallery_media", {
    media_id: mediaId,
    inv_id: invitationId,
    path: prefix,
    w: width,
    h: height,
  });
  if (error) {
    await cleanup();
    return { status: "error", message: copy.common.error };
  }
  if (!row) {
    await cleanup();
    return {
      status: "error",
      reason: "limit",
      message: copy.editor.gallery.limitReached,
    };
  }

  revalidatePath(`/dashboard/undangan/${invitationId}/edit`);
  revalidatePath(`/${own.slug}`); // ISR halaman publik (efektif saat aktif)
  return {
    status: "success",
    item: toMediaView(row, (p) => storage.getPublicUrl(p)),
  };
}

/**
 * Hapus 1 foto galeri. Pola: auth → kepemilikan (RLS) → hapus baris (otoritatif)
 * → bersihkan objek storage (best-effort; orphan tak berbahaya & tak tertebak).
 */
export async function deleteGalleryPhotoAction(
  invitationId: string,
  mediaId: string,
): Promise<MediaDeleteResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId) || !isUuid(mediaId)) return { status: "error" };

  if (
    !(
      await checkClientRateLimit("media-delete", {
        max: 60,
        windowMs: 60_000,
      })
    ).ok
  ) {
    return { status: "error", message: copy.auth.rateLimited };
  }

  const { data: row } = await supabase
    .from("media")
    .select("id, storage_path")
    .eq("id", mediaId)
    .eq("invitation_id", invitationId)
    .maybeSingle();
  if (!row) return { status: "error" };

  const { error } = await supabase
    .from("media")
    .delete()
    .eq("id", mediaId)
    .eq("invitation_id", invitationId);
  if (error) return { status: "error", message: copy.common.error };

  const storage = getStorage();
  await Promise.allSettled(
    mediaObjectPaths(row.storage_path).map((p) => storage.delete(p)),
  );

  const { data: inv } = await supabase
    .from("invitations")
    .select("slug")
    .eq("id", invitationId)
    .maybeSingle();

  revalidatePath(`/dashboard/undangan/${invitationId}/edit`);
  if (inv?.slug) revalidatePath(`/${inv.slug}`); // ISR halaman publik
  return { status: "success" };
}
