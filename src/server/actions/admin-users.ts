"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isUuid } from "@/lib/id";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminUserRoleSchema } from "@/lib/validation/admin";
import { logAdminAction } from "@/server/admin/log";
import { requireAdmin } from "@/server/guards/auth";

/**
 * Kelola akun pengguna (SPEC §4.9): ubah peran (client↔admin) + tangguhkan/
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

/** Ubah peran pengguna (client↔admin). */
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
