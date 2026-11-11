"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { copy } from "@/lib/copy";
import { localToStoredUtc } from "@/lib/datetime";
import { isBlankEventDraft, isCompleteLocalDateTime } from "@/lib/event-draft";
import { draftSlug, isUuid } from "@/lib/id";
import { toDbJson } from "@/lib/json";
import { mediaObjectPaths, namedPhotoPathsFromContent } from "@/lib/media";
import { reportHandledError } from "@/lib/observability";
import { checkClientRateLimit } from "@/lib/request-ip";
import { slugSchema } from "@/lib/slug";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_SETTINGS,
  emptyContent,
  settingsSchema,
} from "@/lib/validation/content";
import {
  createInvitationSchema,
  saveDraftSchema,
  type CreateInvitationInput,
} from "@/lib/validation/invitation";
import { draftErrorMap, draftFieldErrors } from "@/lib/validation/draft-errors";

import { errorState, fieldErrorState, type ActionState } from "./types";

/**
 * Buat draft undangan (SPEC Flow A langkah 3). Pola wajib: auth → validasi Zod
 * → cek tema mendukung kategori → INSERT draft (status default `draft`; kolom
 * lifecycle terkunci di level privilege, migrasi v4) → redirect ke editor.
 * Slug awal sementara (`draft-…`); pemilik menetapkan slug asli di editor.
 */
export async function createInvitationAction(
  input: CreateInvitationInput,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(copy.auth.genericAuthError);

  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }
  const { category, themeSlug } = parsed.data;

  const { data: theme } = await supabase
    .from("themes")
    .select("id, categories")
    .eq("slug", themeSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!theme || !theme.categories.includes(category)) {
    return errorState(copy.create.themeUnavailable);
  }

  const { data: inv, error } = await supabase
    .from("invitations")
    .insert({
      user_id: user.id,
      theme_id: theme.id,
      slug: draftSlug(),
      category,
      content: toDbJson(emptyContent(category)),
      settings: toDbJson(DEFAULT_SETTINGS),
    })
    .select("id")
    .single();

  if (error || !inv) return errorState(copy.common.error);

  revalidatePath("/dashboard");
  redirect(`/dashboard/undangan/${inv.id}/edit`);
}

/**
 * Autosave draft (SPEC §4.4). Pola: auth → validasi Zod longgar (draft) →
 * UPDATE `content/settings/event_date` (RLS + grant kolom §6b membatasi ke
 * baris sendiri; kolom lifecycle tak tersentuh). Jadwal & slug punya jalur
 * tersendiri (M1.3c/d).
 */
export async function saveInvitationDraftAction(
  id: string,
  patch: unknown,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(copy.auth.genericAuthError);
  if (!isUuid(id)) return errorState(copy.common.error);

  // Galat per PATH lengkap + pesan Indonesia → editor bisa menandai isian yang
  // tepat (SPEC §4.4). `flatten()` dulu meratakan semuanya ke `content`.
  const parsed = saveDraftSchema.safeParse(patch, { error: draftErrorMap });
  if (!parsed.success) {
    return fieldErrorState(draftFieldErrors(parsed.error));
  }
  const { content, settings, eventDate, events } = parsed.data;

  // `settings.custom` (kustomisasi tampilan, Fase G) DIMILIKI EKSKLUSIF oleh
  // `updateInvitationAppearance`. Jalur autosave ini MENGABAIKAN `custom` dari
  // klien (cegah bypass gating Premium lewat skema base yang permisif) dan
  // MEMPERTAHANKAN nilai milik server (cegah kehilangan kustomisasi saat pemilik
  // mengedit konten).
  const settingsSansCustom = { ...settings };
  delete settingsSansCustom.custom;
  const { data: current } = await supabase
    .from("invitations")
    .select("settings, music_locked_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const serverCustom = settingsSchema.safeParse(current?.settings).data?.custom;
  const settingsToWrite = serverCustom
    ? { ...settingsSansCustom, custom: serverCustom }
    : settingsSansCustom;
  // Musik unggahan dikunci admin (takedown, DECISIONS #121): tab editor yang
  // masih terbuka memegang rujukan lama dan akan menulisnya kembali di autosave
  // berikutnya. Buang di sini supaya rujukan ke objek yang sudah dihapus tak
  // hidup lagi saat kuncinya dibuka.
  const contentToWrite = current?.music_locked_at
    ? { ...content, customMusic: undefined }
    : content;

  const { data: saved, error } = await supabase
    .from("invitations")
    .update({
      content: toDbJson(contentToWrite),
      settings: toDbJson(settingsToWrite),
      event_date: eventDate ? eventDate : null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("slug")
    .maybeSingle();

  if (error) return errorState(copy.common.error);

  // Jadwal: konversi waktu-lokal (settings.timezone) → UTC, ganti sesi atomik
  // via RPC (SECURITY INVOKER → RLS membatasi ke undangan sendiri).
  //
  // SETIAP sesi yang berisi ikut tersimpan (DECISIONS #42). Dulu sesi tanpa jam
  // mulai lengkap DIBUANG di sini sementara aksi membalas "success", sehingga
  // setelah muat ulang sesi itu hilang beserta gedung/alamat/peta yang sudah
  // diketik. Kini jam yang belum lengkap disimpan NULL (tak pernah tampil ke
  // tamu — `lib/schedule.ts`); hanya kartu yang kosong total yang dilewati.
  // `sort_order` = indeks form, supaya urutan pemilik terjaga apa adanya.
  //
  // Id sesi dikirim agar RPC memperbarui baris yang sama (DECISIONS #43): dulu
  // id berganti tiap autosave dan tautan kalender `?e=` di halaman yang sudah
  // terbuka menjadi 404. Id GANDA dalam satu kiriman (hanya dari klien yang
  // dirakit ulang) memakai id baru untuk kemunculan berikutnya — upsert Postgres
  // menolak satu baris disentuh dua kali, dan autosave tak boleh macet karenanya.
  const tz = settings.timezone;
  const seenIds = new Set<string>();
  const eventRows = events.flatMap((e, i) => {
    // Kosong dinilai SETELAH normalisasi (#44): jam yang tak lengkap/tak sah
    // tersimpan NULL, jadi kartu yang isinya HANYA itu (mis. tahun setengah
    // jadi "0002-…" saat Chrome mengetik ulang tahun) dulu menjadi baris
    // hantu — kosong di editor, tetapi disebut "Sesi N belum tampil" di
    // halaman aktivasi. Kartu dengan isian lain tetap tersimpan (#42).
    if (
      isBlankEventDraft({
        ...e,
        startAt: isCompleteLocalDateTime(e.startAt) ? e.startAt : "",
        endAt: isCompleteLocalDateTime(e.endAt) ? e.endAt : "",
      })
    ) {
      return [];
    }
    const id = e.id && !seenIds.has(e.id) ? e.id : null;
    if (id) seenIds.add(id);
    return [
      {
        id,
        name: e.name ?? "",
        start_at: localToStoredUtc(e.startAt, tz),
        end_at: localToStoredUtc(e.endAt, tz),
        venue_name: e.venueName ?? null,
        address: e.address ?? null,
        maps_url: e.mapsUrl ?? null,
        sort_order: i,
      },
    ];
  });

  const { error: evError } = await supabase.rpc("replace_invitation_events", {
    inv_id: id,
    events: toDbJson(eventRows),
  });
  if (evError) return errorState(copy.common.error);

  // Segarkan cache ISR halaman publik (efektif saat undangan sudah aktif; no-op
  // aman selagi draft). Slug bisa berubah, tapi hanya saat draft (belum publik).
  if (saved?.slug) revalidatePath(`/${saved.slug}`);

  return { status: "success" };
}

/** Hasil pengecekan ketersediaan slug (M1.3d). */
export type SlugCheckResult = {
  status: "available" | "taken" | "invalid" | "error";
  message?: string;
};

/** Hasil penyimpanan slug (M1.3d). */
export type SlugSaveResult =
  | { status: "success"; slug: string }
  | {
      status: "error";
      reason?: "taken" | "not_draft" | "invalid";
      message?: string;
    };

/**
 * Cek ketersediaan slug real-time (SPEC §4 Flow A langkah 5). Pola: auth →
 * validasi format (slugSchema) → pastikan undangan milik pemanggil (RLS) → cek
 * keunikan LINTAS-pemilik via admin client (RLS SELECT owner-only tak dapat
 * melihat slug pemilik lain). Hanya membaca kolom `id` → tak membocorkan data;
 * slug memang alamat publik. Guard keunikan sebenarnya adalah constraint UNIQUE
 * saat simpan — ini murni untuk UX. Di-rate-limit per-jaringan (lihat di bawah).
 */
export async function checkSlugAvailabilityAction(
  invitationId: string,
  rawSlug: string,
): Promise<SlugCheckResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  // Rate-limit (M2): batasi probing keberadaan slug lintas-tenant. Ringan —
  // murni UX; keunikan sebenarnya dijamin constraint UNIQUE saat simpan.
  const rl = await checkClientRateLimit("slug-check", {
    max: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) return { status: "error", message: copy.auth.rateLimited };

  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    return { status: "invalid", message: parsed.error.issues[0]?.message };
  }
  const slug = parsed.data;

  // Kepemilikan (RLS membatasi ke baris sendiri): id asing → tolak. Juga
  // memastikan `invitationId` sah untuk di-exclude dari cek keunikan.
  const { data: own } = await supabase
    .from("invitations")
    .select("id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!own) return { status: "error" };

  const admin = createSupabaseAdminClient();
  const { data: clash, error } = await admin
    .from("invitations")
    .select("id")
    .eq("slug", slug)
    .neq("id", invitationId)
    .maybeSingle();
  if (error) return { status: "error" };

  return { status: clash ? "taken" : "available" };
}

/**
 * Simpan slug undangan (SPEC §4 Flow A langkah 5). Pola: auth → validasi format
 * → UPDATE ter-scope owner + `status='draft'` (slug tak boleh berubah setelah
 * aktif; mengubahnya memutus tautan WA yang sudah tersebar) → revalidate.
 * Keunikan dijamin constraint UNIQUE: tabrakan balapan → 23505 → "sudah dipakai".
 */
export async function updateInvitationSlugAction(
  invitationId: string,
  rawSlug: string,
): Promise<SlugSaveResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    return {
      status: "error",
      reason: "invalid",
      message: parsed.error.issues[0]?.message,
    };
  }
  const slug = parsed.data;

  const { data: updated, error } = await supabase
    .from("invitations")
    .update({ slug })
    .eq("id", invitationId)
    .eq("user_id", user.id)
    .eq("status", "draft")
    .select("slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        reason: "taken",
        message: copy.editor.slug.taken,
      };
    }
    return { status: "error", message: copy.common.error };
  }
  // 0 baris ter-update → bukan draft (atau bukan milik pemanggil).
  if (!updated) {
    return {
      status: "error",
      reason: "not_draft",
      message: copy.editor.slug.notDraft,
    };
  }

  revalidatePath(`/dashboard/undangan/${invitationId}/edit`);
  revalidatePath("/dashboard");
  return { status: "success", slug: updated.slug };
}

/** Hasil penghapusan undangan (self-service, SPEC §3 / DATA-MODEL §5). */
export type DeleteInvitationResult =
  | { status: "success" }
  | {
      status: "error";
      reason?: "not_found" | "not_deletable";
      message?: string;
    };

/**
 * Hapus undangan NON-AKTIF (hak subjek data UU PDP, DATA-MODEL §5). Pola: auth →
 * rate-limit (destruktif) → kepemilikan + status (RLS owner-only). Dua jalur:
 *  - `draft` (tak pernah dibayar → tak ada order lunas): HARD-DELETE penuh; RLS
 *    `invitations_delete` mengizinkan owner menghapus draft, cascade membersihkan
 *    seluruh baris anak + order non-lunas.
 *  - `expired` (PASTI pernah dibayar): PURGE data pribadi via RPC service_role —
 *    owner tak bisa hapus `rsvps`/`gift_notes` lewat RLS (delete = admin-only).
 *    Baris undangan tinggal sebagai kerangka + `orders` dipertahankan (retensi
 *    keuangan). `purged_at` menyembunyikannya dari daftar dashboard.
 * Objek storage media dibersihkan best-effort (orphan tak berbahaya). Musik
 * unggahan draft: path dibaca dari `music_uploads` SEBELUM DELETE (cascade).
 * Foto bernama draft (sampul/mempelai/logo/foto cerita) dipanen dari `content`
 * — kunci yang sama dengan `purge_invitation_data` (DECISIONS #127).
 * `active`/`pending_payment`/`suspended` ditolak (boundary: jangan hapus undangan
 * aktif; transaksi berjalan / kendali admin).
 */
export async function deleteInvitationAction(
  invitationId: string,
): Promise<DeleteInvitationResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  const rl = await checkClientRateLimit("invitation-delete", {
    max: 20,
    windowMs: 60_000,
  });
  if (!rl.ok) return { status: "error", message: copy.auth.rateLimited };

  const { data: inv } = await supabase
    .from("invitations")
    .select("id, status, slug")
    .eq("id", invitationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!inv) return { status: "error", reason: "not_found" };

  if (inv.status !== "draft" && inv.status !== "expired") {
    return {
      status: "error",
      reason: "not_deletable",
      message: copy.dashboard.deleteNotAllowed,
    };
  }

  const storage = getStorage();

  if (inv.status === "draft") {
    // Kumpulkan path media DULU (cascade akan menghapus baris; kita butuh path
    // untuk membersihkan objek storage sesudahnya).
    const { data: mediaRows } = await supabase
      .from("media")
      .select("storage_path")
      .eq("invitation_id", invitationId);

    // Objek musik unggahan (DECISIONS #121), termasuk yang diganti atau tak
    // pernah tersimpan. Barisnya hanya terlihat service_role (RLS tanpa
    // policy) dan ikut terhapus FK cascade — sesudah DELETE, objeknya tak bisa
    // ditemukan lagi tetapi tetap tersaji publik. Karena itu bacaan yang GAGAL
    // membatalkan penghapusan (pemilik mencoba lagi), tidak seperti media di
    // atas. Kepemilikan sudah diverifikasi lewat klien pemilik di atas.
    const { data: musikRows, error: musikErr } =
      await createSupabaseAdminClient()
        .from("music_uploads")
        .select("path")
        .eq("invitation_id", invitationId)
        .is("removed_at", null);
    if (musikErr) return { status: "error", message: copy.common.error };

    const { data: terhapus, error: delErr } = await supabase
      .from("invitations")
      .delete()
      .eq("id", invitationId)
      .eq("user_id", user.id)
      .eq("status", "draft") // guard eksplisit selain RLS
      // `content` dari RETURNING = isinya SAAT dihapus: autosave tab editor lain
      // di sela bacaan awal dan DELETE ini tetap terpanen.
      .select("id, content");
    if (delErr) return { status: "error", message: copy.common.error };
    // Status berubah di sela bacaan di atas dan DELETE (mis. checkout membuatnya
    // pending/aktif): guard menyaring barisnya, DELETE sukses dengan 0 baris.
    // Undangan itu masih hidup — objek media & musik yang path-nya dibaca di
    // atas MILIKNYA, jadi tak satu pun boleh dihapus.
    if (!terhapus || terhapus.length === 0) {
      return {
        status: "error",
        reason: "not_deletable",
        message: copy.dashboard.deleteNotAllowed,
      };
    }

    // Foto bernama (sampul/mempelai/logo + foto cerita, DECISIONS #127) tak
    // punya baris tabel — rujukannya hanya di `content` baris yang baru saja
    // dihapus, jadi inilah satu-satunya kesempatan menghapus objeknya. Disaring
    // terhadap `inv.id` (bentuk kanonik DB): path di `content` ditulis klien.
    const prefixes = [
      ...(mediaRows ?? []).map((m) => m.storage_path),
      ...namedPhotoPathsFromContent(terhapus[0].content, inv.id),
    ];
    const hasilMedia = await Promise.allSettled(
      prefixes.flatMap((prefix) =>
        mediaObjectPaths(prefix).map((p) => storage.delete(p)),
      ),
    );
    const gagalMedia = hasilMedia.filter((r) => r.status === "rejected").length;
    if (gagalMedia > 0) {
      // Sama dengan musik di bawah: baris undangan sudah lenyap dan tak ada
      // penyapu foto bernama, jadi laporan ini satu-satunya jejak objek yang
      // masih tersaji publik.
      reportHandledError(
        new Error(
          `storage: ${gagalMedia} objek foto gagal dihapus saat hapus draft`,
        ),
        "invitation.delete.media",
        { invitationId, failed: gagalMedia },
      );
    }
    const hasilMusik = await Promise.allSettled(
      (musikRows ?? []).map((m) => storage.delete(m.path)),
    );
    const gagalMusik = hasilMusik.filter((r) => r.status === "rejected").length;
    if (gagalMusik > 0) {
      // Barisnya sudah lenyap bersama undangan: tak ada penyapu yang akan
      // menemukan objek ini lagi, jadi laporan ini satu-satunya jejaknya.
      reportHandledError(
        new Error(
          `storage: ${gagalMusik} objek musik gagal dihapus saat hapus draft`,
        ),
        "invitation.delete.music",
        { invitationId, failed: gagalMusik },
      );
    }
  } else {
    // expired → purge via RPC service_role (owner-scoped: sudah diverifikasi milik
    // pemanggil di atas). Idempoten; not_expired/already_purged → tetap sukses
    // dari sisi user (undangan hilang dari daftar).
    const admin = createSupabaseAdminClient();
    const { data: res, error: rpcErr } = await admin.rpc(
      "purge_invitation_data",
      { p_invitation_id: invitationId },
    );
    if (rpcErr) return { status: "error", message: copy.common.error };

    const outcome = res?.[0];
    if (outcome?.result === "purged") {
      const hasil = await Promise.allSettled([
        // media_paths = prefix galeri → expand ke 2 varian.
        ...(outcome.media_paths ?? []).flatMap((prefix) =>
          mediaObjectPaths(prefix).map((p) => storage.delete(p)),
        ),
        // momen_paths = path objek PENUH foto momen → hapus langsung.
        ...(outcome.momen_paths ?? []).map((p) => storage.delete(p)),
      ]);
      // Ini RPC yang SAMA dengan cron purge-expired, membersihkan kelas data
      // yang sama untuk kewajiban yang sama (UU PDP). Di cron hasilnya dihitung
      // dan dilaporkan; di sini — jalur yang dipicu PEMILIK secara sadar —
      // dulu dibuang. Dan jalurnya sekali-jalan: RPC sudah menyetel
      // `purged_at`, sehingga cron berikutnya menyaring barisnya keluar dan tak
      // akan pernah mencoba ulang. Objek yang gagal dihapus di sini tinggal di
      // storage selamanya, tanpa rujukan.
      const gagal = hasil.filter((r) => r.status === "rejected").length;
      if (gagal > 0) {
        reportHandledError(
          new Error(`storage: ${gagal} objek gagal dihapus saat purge pemilik`),
          "invitation.delete.storage",
          { invitationId, failed: gagal },
        );
      }
    }
    revalidatePath(`/${inv.slug}`); // ISR halaman publik (kini kerangka expired)
  }

  revalidatePath("/dashboard");
  return { status: "success" };
}
