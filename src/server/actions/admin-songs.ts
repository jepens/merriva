"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AUDIO_MAX_BYTES, AUDIO_MIME_EXT, songObjectPath } from "@/lib/audio";
import { isUuid } from "@/lib/id";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminSongSchema } from "@/lib/validation/admin";
import { logAdminAction } from "@/server/admin/log";
import { requireAdmin } from "@/server/guards/auth";

/**
 * CRUD pustaka lagu latar (SPEC §4.9 — katalog admin). Pola wajib:
 * **auth(admin) → validasi → unggah via lib/storage → mutasi (service_role) →
 * audit → revalidate**. Klien memilih lagu di editor (`settings.songId`);
 * halaman publik me-resolve URL via `resolveMusic`.
 *
 * BOUNDARY (CLAUDE.md): HANYA audio berlisensi / bebas-royalti yang boleh
 * diunggah. Admin bertanggung jawab atas hak pakai tiap trek — sistem tak dapat
 * memverifikasi lisensi. Media disajikan dari domain sendiri (lib/storage),
 * tak pernah dari URL vendor.
 */

/** Tambah lagu: unggah berkas audio + daftarkan baris `songs`. */
export async function adminAddSongAction(formData: FormData): Promise<never> {
  const adminUser = await requireAdmin();

  const parsed = adminSongSchema.safeParse({
    title: formData.get("title"),
    artist: formData.get("artist"),
  });
  if (!parsed.success) redirect("/admin/lagu?msg=song_invalid");

  const file = formData.get("file");
  if (
    !(file instanceof Blob) ||
    file.size === 0 ||
    file.size > AUDIO_MAX_BYTES ||
    !AUDIO_MIME_EXT[file.type]
  ) {
    redirect("/admin/lagu?msg=song_invalid");
  }
  const ext = AUDIO_MIME_EXT[(file as Blob).type];
  const bytes = new Uint8Array(await (file as Blob).arrayBuffer());
  const path = songObjectPath(bytes, ext);

  const storage = getStorage();
  let uploaded = false;
  try {
    await storage.upload({
      path,
      body: bytes,
      contentType: (file as Blob).type,
    });
    uploaded = true;
  } catch {
    // ditangani di bawah (redirect tak boleh di dalam try — NEXT_REDIRECT throw).
  }
  if (!uploaded) redirect("/admin/lagu?msg=song_failed");

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("songs")
    .insert({
      title: parsed.data.title,
      artist: parsed.data.artist ?? null,
      storage_path: path,
      is_active: true,
    })
    .select("id")
    .maybeSingle();
  if (error || !row) redirect("/admin/lagu?msg=song_failed");

  await logAdminAction(admin, adminUser.id, {
    action: "song.create",
    targetType: "song",
    targetId: row.id,
    detail: { title: parsed.data.title },
  });

  revalidatePath("/admin/lagu");
  redirect("/admin/lagu?msg=song_ok");
}

/** Aktif/nonaktif lagu (nonaktif = tak muncul di picker & tak diputar). */
export async function adminToggleSongAction(id: string): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(id)) redirect("/admin/lagu");

  const admin = createSupabaseAdminClient();
  const { data: cur } = await admin
    .from("songs")
    .select("is_active")
    .eq("id", id)
    .maybeSingle();
  if (!cur) redirect("/admin/lagu?msg=song_failed");

  const next = !cur.is_active;
  const { error } = await admin
    .from("songs")
    .update({ is_active: next })
    .eq("id", id);
  if (error) redirect("/admin/lagu?msg=song_failed");

  await logAdminAction(admin, adminUser.id, {
    action: "song.toggle",
    targetType: "song",
    targetId: id,
    detail: { is_active: next },
  });

  revalidatePath("/admin/lagu");
  redirect("/admin/lagu?msg=song_ok");
}

/**
 * Hapus lagu: hapus baris (otoritatif) + objek storage bila tak dipakai baris
 * lain (path content-addressed bisa dibagi bila isi identik). Undangan yang
 * telanjur memilih lagu ini → `resolveMusic` mengembalikan null (senyap, aman).
 */
export async function adminDeleteSongAction(id: string): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(id)) redirect("/admin/lagu");

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("songs")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!row) redirect("/admin/lagu?msg=song_failed");

  const { error } = await admin.from("songs").delete().eq("id", id);
  if (error) redirect("/admin/lagu?msg=song_failed");

  // Objek storage hanya dihapus bila tak ada baris lain yang memakainya.
  const { count } = await admin
    .from("songs")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", row.storage_path);
  if (!count) {
    await getStorage()
      .delete(row.storage_path)
      .catch(() => {});
  }

  await logAdminAction(admin, adminUser.id, {
    action: "song.delete",
    targetType: "song",
    targetId: id,
    detail: {},
  });

  revalidatePath("/admin/lagu");
  redirect("/admin/lagu?msg=song_deleted");
}
