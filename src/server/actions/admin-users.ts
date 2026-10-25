"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isUuid } from "@/lib/id";
import { mediaObjectPaths } from "@/lib/media";
import { reportHandledError } from "@/lib/observability";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminDeleteAccountSchema,
  adminUserRoleSchema,
} from "@/lib/validation/admin";
import { logAdminAction } from "@/server/admin/log";
import { requireAdmin } from "@/server/guards/auth";

/**
 * Kelola akun pengguna (SPEC §4.9): ubah peran (client/pro/admin — Pro = tak
 * pernah ditagih, DECISIONS #100) + tangguhkan/
 * pulihkan akun (ban login). Pola wajib: **auth(admin) → validasi → mutasi
 * (service_role) → audit → revalidate**. Umpan balik lewat `redirect(?msg=)`
 * dibaca halaman /admin/pengguna.
 *
 * Safeguard: admin TIDAK bisa mengubah/menangguhkan akunnya sendiri (cegah
 * lockout diri), dan akun ber-peran admin harus diturunkan ke client dulu
 * sebelum bisa ditangguhkan (cegah admin saling-mengunci). Karena admin tak
 * bisa menurunkan dirinya sendiri, selalu tersisa minimal satu admin.
 *
 * Catatan: "tangguhkan akun" (ban login GoTrue) BERBEDA dari "suspend undangan"
 * (moderasi konten, admin.ts) — ini aksi tingkat akun, memblokir login/refresh.
 */

const LIST = "/admin/pengguna";
const BAN_DURATION = "876000h"; // ~100 tahun (efektif permanen sampai dipulihkan)

function back(msg: string): never {
  redirect(`${LIST}?msg=${msg}`);
}

/** Ubah peran pengguna (client/pro/admin). */
export async function adminSetUserRoleAction(
  userId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(userId)) redirect(LIST);

  const parsed = adminUserRoleSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) back("user_role_invalid");
  if (userId === adminUser.id) back("user_role_self");

  const admin = createSupabaseAdminClient();
  const { data: cur } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!cur) back("user_role_failed");
  if (cur.role === parsed.data.role) back("user_role_ok"); // no-op, tak perlu tulis

  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", userId);
  if (error) back("user_role_failed");

  await logAdminAction(admin, adminUser.id, {
    action: "user.role",
    targetType: "user",
    targetId: userId,
    detail: { role: parsed.data.role },
  });

  revalidatePath(LIST);
  revalidatePath("/admin");
  back("user_role_ok");
}

/** Tangguhkan akun (ban login). Hanya akun non-admin & bukan diri sendiri. */
export async function adminSuspendUserAction(userId: string): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(userId)) redirect(LIST);
  if (userId === adminUser.id) back("user_suspend_self");

  const admin = createSupabaseAdminClient();
  const { data: cur } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!cur) back("user_suspend_failed");
  if (cur.role === "admin") back("user_suspend_admin");

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_DURATION,
  });
  if (error) back("user_suspend_failed");

  await logAdminAction(admin, adminUser.id, {
    action: "user.suspend",
    targetType: "user",
    targetId: userId,
    detail: {},
  });

  revalidatePath(LIST);
  back("user_suspend_ok");
}

/** Pulihkan akun (batalkan ban). */
export async function adminReinstateUserAction(userId: string): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(userId)) redirect(LIST);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (error) back("user_reinstate_failed");

  await logAdminAction(admin, adminUser.id, {
    action: "user.reinstate",
    targetType: "user",
    targetId: userId,
    detail: {},
  });

  revalidatePath(LIST);
  back("user_reinstate_ok");
}

/**
 * HAPUS AKUN permanen (AUDIT-2026-10-01 A6).
 *
 * `/privasi` sudah tayang menjanjikan "Anda dapat meminta penghapusan data
 * kapan saja", tetapi `auth.admin.deleteUser` tak pernah dipanggil di mana pun
 * dan panel ini hanya bisa MEMBEKUKAN (ban GoTrue) — janji publik tanpa
 * mekanisme. Eksekusinya dulu berarti mengutak-atik tabel langsung di SQL
 * editor: berisiko, tanpa jejak, dan gampang menyisakan objek storage.
 *
 * Urutan WAJIB (RPC → storage → GoTrue), dan alasannya:
 *  1. RPC mengembalikan path objek yang harus dihapus. Menghapus pengguna
 *     GoTrue lebih dulu akan membuang satu-satunya cara menemukan path itu,
 *     dan objeknya jadi yatim selamanya — purge retensi pun takkan menemukannya
 *     karena ia hanya mengenumerasi path dari BARIS yang sudah tiada.
 *  2. Storage best-effort: objek yang gagal dihapus TIDAK boleh membatalkan
 *     penghapusan akun yang sudah commit di DB. Kegagalannya dilaporkan.
 *  3. `deleteUser` terakhir — setelah ini `p_user_id` tak bisa dicari lagi.
 *
 * Keputusan pemilik (2026-10-03): `orders` DIPERTAHANKAN ter-anonimisasi
 * (FK SET NULL) agar omzet historis & rekonsiliasi Pakasir tetap utuh, dan
 * permintaan DITOLAK selama masih ada undangan berstatus `active`.
 */
export async function adminDeleteAccountAction(
  userId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(userId)) redirect(LIST);
  if (userId === adminUser.id) back("user_delete_self");

  const parsed = adminDeleteAccountSchema.safeParse({
    reason: formData.get("reason"),
    confirmEmail: formData.get("confirmEmail"),
  });
  if (!parsed.success) back("user_delete_invalid");

  const admin = createSupabaseAdminClient();

  // Konfirmasi diketik harus cocok dengan email AKUN TARGET — penjagaan
  // terakhir sebelum tindakan yang tak bisa dibatalkan.
  const { data: target } = await admin.auth.admin.getUserById(userId);
  const email = target?.user?.email ?? "";
  if (
    !email ||
    email.toLowerCase() !== parsed.data.confirmEmail.toLowerCase()
  ) {
    back("user_delete_mismatch");
  }

  const { data, error } = await admin.rpc("admin_delete_account", {
    p_user_id: userId,
    p_admin_id: adminUser.id,
    p_reason: parsed.data.reason,
  });
  if (error) {
    reportHandledError(error, "admin.delete-account");
    back("user_delete_failed");
  }

  const row = data?.[0];
  if (row?.result === "not_found") back("user_delete_not_found");
  if (row?.result === "has_active") back("user_delete_has_active");
  if (row?.result !== "deleted") back("user_delete_failed");

  // Best-effort — DB sudah commit; objek sisa dilaporkan, tak membatalkan.
  const storage = getStorage();
  const hasil = await Promise.allSettled([
    ...(row.media_paths ?? []).flatMap((prefix: string) =>
      mediaObjectPaths(prefix).map((p) => storage.delete(p)),
    ),
    ...(row.momen_paths ?? []).map((p: string) => storage.delete(p)),
  ]);
  const gagal = hasil.filter((r) => r.status === "rejected").length;
  if (gagal > 0) {
    reportHandledError(
      new Error(`storage: ${gagal} objek gagal dihapus`),
      "admin.delete-account.storage",
      { userId, failed: gagal },
    );
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    // Data pribadi SUDAH terhapus; yang tersisa hanya baris login. Dilaporkan
    // agar bisa dibereskan manual, bukan dianggap gagal total.
    reportHandledError(authErr, "admin.delete-account.auth", { userId });
    back("user_delete_auth_left");
  }

  revalidatePath(LIST);
  revalidatePath("/admin");
  back("user_delete_ok");
}
