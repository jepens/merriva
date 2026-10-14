"use server";

import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import {
  displayPath,
  isNamedPhotoPath,
  isVariantBlob,
  MEDIA_MAX_BYTES,
  mediaObjectPaths,
  namedPhotoPrefix,
  thumbPath,
} from "@/lib/media";
import { checkClientRateLimit } from "@/lib/request-ip";
import { getStorage } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NamedPhotoUploadResult =
  | { status: "success"; path: string; url: string }
  | { status: "error"; reason?: "auth" | "invalid"; message?: string };

export type NamedPhotoDeleteResult =
  { status: "success" } | { status: "error" };

/**
 * Unggah satu foto BERNAMA — sampul, mempelai, atau logo (SPEC §4.4 langkah 2).
 * Pola wajib: auth → kepemilikan (RLS) → validasi 2 varian → unggah via
 * `lib/storage` → kembalikan path. Server tidak memproses gambar.
 *
 * KENAPA AKSI INI TIDAK MENYENTUH DATABASE: path foto bernama tinggal di dalam
 * `content`, dan `content` dimiliki oleh autosave editor yang mengirim SELURUH
 * objeknya setiap beberapa detik. Bila aksi ini ikut menulis `content`,
 * autosave berikutnya — yang form-nya belum tahu ada foto baru — akan menimpa
 * path itu kembali ke kosong, dan fotonya "hilang" tanpa galat. Jadi aksi ini
 * hanya menaruh objek lalu menyerahkan pathnya ke form; autosave yang
 * menyimpannya, lewat skema yang sudah memvalidasi `storagePathSchema`.
 *
 * Harga yang diterima: bila pemilik menutup tab antara unggah dan autosave,
 * objeknya menjadi yatim. Tak berbahaya dan tak tertebak (UUID), sama seperti
 * objek yatim pada kegagalan unggah galeri.
 */
export async function uploadNamedPhotoAction(
  invitationId: string,
  formData: FormData,
): Promise<NamedPhotoUploadResult> {
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

  if (
    !(
      await checkClientRateLimit("named-photo-upload", {
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

  // Kepemilikan lewat RLS: baris milik orang lain tak terlihat sama sekali.
  const { data: own } = await supabase
    .from("invitations")
    .select("id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!own) return { status: "error", reason: "auth" };

  const prefix = namedPhotoPrefix(invitationId, crypto.randomUUID());
  const storage = getStorage();
  try {
    await storage.upload({
      path: displayPath(prefix),
      body: await display.arrayBuffer(),
      contentType: display.type,
    });
    await storage.upload({
      path: thumbPath(prefix),
      body: await thumb.arrayBuffer(),
      contentType: thumb.type,
    });
  } catch {
    await Promise.allSettled(
      mediaObjectPaths(prefix).map((p) => storage.delete(p)),
    );
    return { status: "error", message: copy.common.error };
  }

  // Varian THUMB untuk pratinjau 80px di editor; tema yang memakai varian
  // display (`invitation-data.ts`). Mengirim 1600px ke kotak 80px akan membuat
  // pemilik yang mengedit dari HP membayar ±200KB per foto tanpa sebab.
  return {
    status: "success",
    path: prefix,
    url: storage.getPublicUrl(thumbPath(prefix)),
  };
}

/**
 * Hapus objek satu foto bernama (saat diganti atau dibuang). Best-effort —
 * rujukannya di `content` sudah dilepas form sebelum ini dipanggil.
 *
 * Gerbangnya `isNamedPhotoPath`: path datang dari klien, dan storage tak
 * mengenal kepemilikan. Tanpa pencocokan bentuk penuh terhadap `invitationId`
 * milik pemanggil, pemilik undangan sendiri bisa mengirim path undangan ORANG
 * LAIN dan menghapus fotonya.
 */
export async function deleteNamedPhotoAction(
  invitationId: string,
  path: string,
): Promise<NamedPhotoDeleteResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };
  if (!isUuid(invitationId)) return { status: "error" };
  if (!isNamedPhotoPath(invitationId, path)) return { status: "error" };

  if (
    !(
      await checkClientRateLimit("named-photo-delete", {
        max: 60,
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
    .maybeSingle();
  if (!own) return { status: "error" };

  const storage = getStorage();
  await Promise.allSettled(
    mediaObjectPaths(path).map((p) => storage.delete(p)),
  );
  return { status: "success" };
}
