"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isUuid } from "@/lib/id";
import { isCustomMusicPath } from "@/lib/media";
import { reportHandledError } from "@/lib/observability";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminSuspendSchema } from "@/lib/validation/admin";
import { sendMusicRemovedNotice } from "@/server/email/notify";
import { requireAdmin } from "@/server/guards/auth";

/**
 * Takedown musik unggahan oleh admin (DECISIONS #121) — saudara ringan
 * `adminSuspendInvitationAction`: undangan TETAP tayang, yang dihapus hanya
 * objek musik unggahannya, dan unggah musik dikunci sampai admin membukanya.
 *
 * Pola sama dengan `admin.ts`: **auth(admin) → validasi Zod → operasi (RPC
 * service_role, atomik + audit dalam-transaksi) → revalidate**, umpan balik lewat
 * `redirect(?msg=)` yang dibaca halaman detail. `requireAdmin()` diulang di
 * setiap action — Server Action = endpoint yang bisa dipanggil langsung.
 */

const LIST = "/admin/undangan";

function detail(id: string, msg: string): never {
  redirect(`${LIST}/${id}?msg=${msg}`);
}

/** Sama dengan `revalidateAfter` di `admin.ts`: publik (ISR), dashboard, admin. */
function revalidateAfter(slug: string | null | undefined) {
  if (slug) revalidatePath(`/${slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath(LIST);
}

/**
 * Id kanonik huruf kecil, atau `null` bila bukan UUID. `isUuid` menerima huruf
 * besar (URL admin bisa ditulis/ditempel begitu), Postgres pun menerima uuid
 * huruf besar — tetapi path objek SELALU ditulis dari `crypto.randomUUID()` /
 * `uuid::text` (huruf kecil) dan `isCustomMusicPath` mencocokkannya huruf demi
 * huruf. Tanpa ini, takedown dari URL ber-UUID huruf besar menandai baris
 * `takedown` lalu menolak SEMUA path-nya: tak satu objek pun dihapus.
 */
function canonicalId(raw: string): string | null {
  return isUuid(raw) ? raw.toLowerCase() : null;
}

/** Hapus semua musik unggahan undangan + kunci unggah + kabari pemilik. */
export async function adminRemoveCustomMusicAction(
  rawInvitationId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  const invitationId = canonicalId(rawInvitationId);
  if (!invitationId) redirect(LIST);

  // Skema suspend dipakai ulang APA ADANYA: dua kolom yang sama (catatan
  // internal wajib → admin_logs; alasan publik opsional → email, `""` → null)
  // dengan batas panjang yang sama dengan form-nya (`SUSPEND_REASON_LIMIT`).
  const parsed = adminSuspendSchema.safeParse({
    reason: formData.get("reason"),
    publicReason: formData.get("publicReason") ?? undefined,
  });
  if (!parsed.success) detail(invitationId, "music_invalid");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_takedown_custom_music", {
    p_invitation_id: invitationId,
    p_admin_id: adminUser.id,
    p_reason: parsed.data.reason,
    p_public_reason: parsed.data.publicReason,
  });
  if (error) {
    reportHandledError(error, "admin.music-takedown", { invitationId });
    detail(invitationId, "music_failed");
  }

  const row = data?.[0];
  if (row?.result !== "removed") {
    if (row?.result !== "not_found") {
      reportHandledError(
        new Error(
          `admin_takedown_custom_music: hasil tak dikenal: ${row?.result ?? "kosong"}`,
        ),
        "admin.music-takedown.unknown-result",
        { invitationId },
      );
    }
    detail(invitationId, "music_failed");
  }

  // Objek storage dihapus SESUDAH RPC sukses (SQL tak bisa menyentuh bucket).
  // Baris catatannya sudah bertanda `takedown` dan rujukannya sudah lepas dari
  // `content`, jadi objek yang gagal dihapus di sini tak lagi diputar — tetapi
  // masih tersaji lewat URL langsung dan tak akan disapu cron (penyapu hanya
  // membaca baris hidup). Karena itu path-nya WAJIB sampai ke Sentry.
  //
  // `isCustomMusicPath` = pertahanan berlapis, cermin regex di purge: path dari
  // DB sudah dijamin check constraint, tetapi `storage.delete` tak boleh pernah
  // menerima path di luar folder musik undangan ini. Async di dalam `map` agar
  // galat sinkron (mis. `getStorage()` salah konfigurasi) ikut jadi `rejected`.
  const paths = row.paths ?? [];
  const settled = await Promise.allSettled(
    paths.map(async (p) => {
      if (!isCustomMusicPath(invitationId, p)) {
        throw new Error(
          "path musik di luar bentuk audio/<undangan>/<uuid>.mp3",
        );
      }
      await getStorage().delete(p);
    }),
  );
  const gagal = settled.flatMap((s, i) =>
    s.status === "rejected" ? [{ path: paths[i], reason: s.reason }] : [],
  );
  if (gagal.length > 0) {
    reportHandledError(gagal[0].reason, "admin.music-takedown.storage", {
      invitationId,
      failedPaths: gagal.map((g) => g.path),
    });
  }

  revalidateAfter(row.slug);

  // `publicReason`, BUKAN `reason`: yang terakhir catatan internal dan boleh
  // memuat identitas pelapor. `await` (bukan `void`) dan tanpa try/catch —
  // alasannya sama dengan `adminSuspendInvitationAction`: `detail()` melempar
  // `NEXT_REDIRECT`, dan pengirimnya sudah best-effort di dalam.
  const kabar = await sendMusicRemovedNotice(
    admin,
    invitationId,
    parsed.data.publicReason,
  );
  // Berkas yang tertinggal di storage menuntut tindakan manual admin — itu yang
  // didahulukan di layar, di atas status email.
  if (gagal.length > 0) detail(invitationId, "music_ok_partial");
  detail(invitationId, kabar === "sent" ? "music_ok" : "music_ok_no_email");
}

/** Buka kunci unggah musik (mis. sanggahan pemilik diterima). */
export async function adminUnlockCustomMusicAction(
  rawInvitationId: string,
  _formData?: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  const invitationId = canonicalId(rawInvitationId);
  if (!invitationId) redirect(LIST);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_unlock_custom_music", {
    p_invitation_id: invitationId,
    p_admin_id: adminUser.id,
  });
  if (error) {
    reportHandledError(error, "admin.music-unlock", { invitationId });
    detail(invitationId, "music_unlock_failed");
  }

  const row = data?.[0];
  revalidateAfter(row?.slug);
  if (row?.result === "unlocked") detail(invitationId, "music_unlock_ok");
  if (row?.result === "not_locked") {
    detail(invitationId, "music_unlock_not_locked");
  }
  if (row?.result !== "not_found") {
    reportHandledError(
      new Error(
        `admin_unlock_custom_music: hasil tak dikenal: ${row?.result ?? "kosong"}`,
      ),
      "admin.music-unlock.unknown-result",
      { invitationId },
    );
  }
  detail(invitationId, "music_unlock_failed");
}
