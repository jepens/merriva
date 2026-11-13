"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { reportHandledError } from "@/lib/observability";
import {
  momenModerationSchema,
  momenSettingsSchema,
} from "@/lib/momen/momen-settings-schema";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Aksi HOST Album Momen (dashboard) — pengaturan & moderasi (MOMEN-SPEC §5). Pola: **auth → cek kepemilikan (RLS undangan) → operasi (service_role) →
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

/**
 * Simpan pengaturan album (jatah/tamu, filter default, upload galeri). Kolom
 * `reveal_at` tak lagi ditulis (DECISIONS #137) — nilainya diabaikan di mana pun.
 */
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
      default_filter: parsed.data.defaultFilter,
      allow_library_upload: parsed.data.allowLibraryUpload,
    })
    .eq("id", owned.albumId);
  if (error) {
    reportHandledError(error, "momen.settings", { albumId: owned.albumId });
    return { status: "error", message: copy.common.error };
  }

  revalidate(invitationId);
  return { status: "success" };
}

/**
 * Moderasi satu foto: sembunyikan / tampilkan / hapus. Host melihat seluruh
 * foto (jalur dashboard service_role). Hapus = buang baris + objek storage
 * (best-effort) + turunkan `photo_count` (rem plafon tetap konsisten).
 *
 * "Sembunyikan" SELALU mencabut objeknya (AUDIT-2026-09-04 KEA-3, DECISIONS #33
 * diperluas #137). Bucket media publik + cache 1 tahun, dan URL foto sudah
 * sampai ke perangkat pemotretnya begitu foto tampil di galeri "Fotomu":
 * menandai `status='hidden'` saja membuat baris hilang dari galeri sementara
 * OBJEKNYA TETAP MELAYANI 200 selamanya — UI berbohong. Maka objek DIHAPUS dan
 * `purged_at` dicatat; permanen, dan "Tampilkan" tak lagi ditawarkan. (Dulu,
 * pra-reveal cukup penanda status; foto lama semacam itu — `purged_at` kosong —
 * tetap bisa ditampilkan lagi.)
 * Baris tetap dipertahankan: jatah jepret tamu & slot peserta yang sudah
 * terpakai TIDAK dikembalikan oleh moderasi.
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
    .select("id, storage_path, thumb_path, purged_at")
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
    if (error) {
      reportHandledError(error, "momen.moderate.delete", {
        albumId: owned.albumId,
      });
      return { status: "error", message: copy.common.error };
    }

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
  } else if (parsed.data.action === "show") {
    // Objek sudah dihapus saat disembunyikan → tak ada yang bisa ditampilkan
    // kembali. Tolak eksplisit (UI juga menyembunyikan tombolnya).
    if (photo.purged_at) {
      return { status: "error", message: copy.momen.manage.showPurged };
    }
    const { error } = await admin
      .from("momen_photos")
      .update({ status: "visible" })
      .eq("id", photo.id)
      .eq("album_id", owned.albumId);
    if (error) {
      reportHandledError(error, "momen.moderate.status", {
        albumId: owned.albumId,
      });
      return { status: "error", message: copy.common.error };
    }
  } else {
    // hide — selalu mencabut objek (lihat docstring); sekali saja per foto.
    const purge = !photo.purged_at;
    const { error } = await admin
      .from("momen_photos")
      .update({
        status: "hidden",
        // Dicatat SEBELUM penghapusan: bila proses mati di tengah, foto tetap
        // ditandai tercabut (fail-closed) alih-alih tampak masih bisa dipulihkan.
        ...(purge ? { purged_at: new Date().toISOString() } : {}),
      })
      .eq("id", photo.id)
      .eq("album_id", owned.albumId);
    if (error) {
      reportHandledError(error, "momen.moderate.status", {
        albumId: owned.albumId,
      });
      return { status: "error", message: copy.common.error };
    }

    if (purge) {
      const storage = getStorage();
      const hasil = await Promise.allSettled([
        storage.delete(photo.storage_path),
        storage.delete(photo.thumb_path),
      ]);
      // Dilaporkan, tidak ditelan. Ini SATU-SATUNYA penghapusan di produk yang
      // tujuannya memang "objek ini harus HILANG" — tuan rumah mencabut foto
      // yang tak pantas, atau orang di dalamnya memintanya turun. Bedanya
      // dengan hapus best-effort lain yang sengaja dibiarkan bisu (orphan tak
      // berbahaya, pathnya tak tertebak): di sini pathnya SUDAH tersebar.
      // Pemotretnya melihatnya di galeri dan bisa menyimpan URL-nya, dan objeknya
      // disajikan `Cache-Control: immutable` setahun. `purged_at` sudah
      // terisi, tombol "Tampilkan" ditolak permanen, foto hilang dari galeri —
      // sementara URL-nya tetap menjawab 200. UI-nya berbohong, persis yang
      // diperingatkan docstring fungsi ini.
      const gagal = hasil.filter((r) => r.status === "rejected").length;
      if (gagal > 0) {
        reportHandledError(
          new Error(`storage: ${gagal} objek foto tercabut gagal dihapus`),
          "momen.moderate.purge.storage",
          { albumId: owned.albumId, photoId: photo.id, failed: gagal },
        );
      }
    }
  }

  revalidate(invitationId);
  return { status: "success" };
}
