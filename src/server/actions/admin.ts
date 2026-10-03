"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isUuid } from "@/lib/id";
import { generateOrderCode } from "@/lib/order";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminActivateSchema,
  adminChangeOwnerSchema,
  adminExtendSchema,
  adminRefundSchema,
  adminSuspendSchema,
} from "@/lib/validation/admin";
import { orderCodeSchema } from "@/lib/validation/order";
import { requireAdmin } from "@/server/guards/auth";

/**
 * Aksi lifecycle admin (SPEC §4.9). Pola wajib: **auth(admin) → validasi Zod →
 * operasi (RPC service_role, atomik + audit dalam-transaksi) → revalidate**.
 * Umpan balik lewat `redirect(?msg=)` yang dibaca halaman detail (tool internal;
 * cukup tanpa state klien). `requireAdmin()` diulang di SETIAP action — Server
 * Action = endpoint yang bisa dipanggil langsung (bukan hanya lewat layout).
 */

const LIST = "/admin/undangan";
const ORDERS = "/admin/order";
const ORDER_CODE_RETRIES = 5;

function detail(id: string, msg: string): never {
  redirect(`${LIST}/${id}?msg=${msg}`);
}

function orders(msg: string): never {
  redirect(`${ORDERS}?msg=${msg}`);
}

/** Revalidate tampilan terdampak: publik (ISR), dashboard pemilik, panel admin. */
function revalidateAfter(slug: string | null | undefined) {
  if (slug) revalidatePath(`/${slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath(LIST);
}

/** Aktivasi manual (bayar di luar sistem) — hasil identik dgn aktivasi bayar. */
export async function adminActivateInvitationAction(
  invitationId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const parsed = adminActivateSchema.safeParse({
    packageCode: formData.get("packageCode"),
  });
  if (!parsed.success) detail(invitationId, "activate_invalid");

  const admin = createSupabaseAdminClient();
  const { data: pkg } = await admin
    .from("packages")
    .select("id")
    .eq("code", parsed.data.packageCode)
    .eq("is_active", true)
    .eq("kind", "invitation") // aktivasi manual hanya paket undangan
    .maybeSingle();
  if (!pkg) detail(invitationId, "activate_pkg");

  let result: string | undefined;
  let slug: string | null = null;
  for (let attempt = 0; attempt < ORDER_CODE_RETRIES; attempt += 1) {
    const { data, error } = await admin.rpc("admin_activate_invitation", {
      p_invitation_id: invitationId,
      p_package_id: pkg.id,
      p_admin_id: adminUser.id,
      p_order_code: generateOrderCode(),
    });
    if (error) detail(invitationId, "activate_failed");
    const row = data?.[0];
    slug = row?.slug ?? null;
    result = row?.result;
    if (result !== "order_code_conflict") break;
  }

  revalidateAfter(slug);
  if (result === "activated" || result === "already_paid") {
    detail(invitationId, "activate_ok");
  }
  if (result === "draft_slug") detail(invitationId, "activate_draft_slug");
  if (result === "not_payable") detail(invitationId, "activate_not_payable");
  if (result === "package_unavailable") detail(invitationId, "activate_pkg");
  detail(invitationId, "activate_failed");
}

/** Perpanjang masa aktif N bulan. */
export async function adminExtendInvitationAction(
  invitationId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const parsed = adminExtendSchema.safeParse({
    months: formData.get("months"),
  });
  if (!parsed.success) detail(invitationId, "extend_invalid");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_extend_invitation", {
    p_invitation_id: invitationId,
    p_months: parsed.data.months,
    p_admin_id: adminUser.id,
  });
  if (error) detail(invitationId, "extend_failed");

  const row = data?.[0];
  revalidateAfter(row?.slug);
  if (row?.result === "extended") detail(invitationId, "extend_ok");
  if (row?.result === "not_extendable") {
    detail(invitationId, "extend_not_extendable");
  }
  if (row?.result === "invalid_months") detail(invitationId, "extend_invalid");
  detail(invitationId, "extend_failed");
}

/** Suspend (konten bermasalah) → halaman publik menampilkan notis. */
export async function adminSuspendInvitationAction(
  invitationId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const parsed = adminSuspendSchema.safeParse({
    reason: formData.get("reason"),
  });
  if (!parsed.success) detail(invitationId, "suspend_invalid");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_suspend_invitation", {
    p_invitation_id: invitationId,
    p_admin_id: adminUser.id,
    p_reason: parsed.data.reason,
  });
  if (error) detail(invitationId, "suspend_failed");

  const row = data?.[0];
  revalidateAfter(row?.slug);
  if (row?.result === "suspended" || row?.result === "already_suspended") {
    detail(invitationId, "suspend_ok");
  }
  detail(invitationId, "suspend_failed");
}

/**
 * Tandai order lunas sebagai REFUND dan cabut layanan yang dibeli
 * (AUDIT-2026-10-01 A3).
 *
 * Uangnya TIDAK bergerak di sini: `PaymentGateway` tak punya `refundTransaction`
 * dan pengembalian dilakukan di dashboard Pakasir. Yang dikerjakan aksi ini
 * adalah bagian yang selama ini hilang — tanpanya order tetap `paid` dan
 * undangan tetap aktif, sehingga pelanggan mendapat uang kembali DAN layanan,
 * dan laporan admin berhenti cocok dengan mutasi rekening.
 */
export async function adminRefundOrderAction(
  orderCode: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();

  const code = orderCode.trim().toUpperCase();
  if (!orderCodeSchema.safeParse(code).success) orders("refund_failed");

  const parsed = adminRefundSchema.safeParse({
    reason: formData.get("reason"),
  });
  if (!parsed.success) orders("refund_invalid");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_refund_order", {
    p_order_code: code,
    p_admin_id: adminUser.id,
    p_reason: parsed.data.reason,
  });
  if (error) orders("refund_failed");

  const row = data?.[0];
  revalidateAfter(row?.slug);
  revalidatePath(ORDERS);

  if (row?.result === "refunded_revoked") orders("refund_ok_revoked");
  if (row?.result === "refunded_still_paid") orders("refund_ok_still_paid");
  if (row?.result === "refunded_album_archived") orders("refund_ok_album");
  if (row?.result === "not_found") orders("refund_not_found");
  // RPC mengembalikan 'not_paid:<status>' agar jejaknya jelas di log server.
  if (row?.result?.startsWith("not_paid")) orders("refund_not_paid");
  orders("refund_failed");
}

/** Reinstate (batalkan suspend) → status dipulihkan dari active_until. */
export async function adminReinstateInvitationAction(
  invitationId: string,
  _formData?: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_reinstate_invitation", {
    p_invitation_id: invitationId,
    p_admin_id: adminUser.id,
  });
  if (error) detail(invitationId, "reinstate_failed");

  const row = data?.[0];
  revalidateAfter(row?.slug);
  if (row?.result === "reinstated") detail(invitationId, "reinstate_ok");
  if (row?.result === "not_suspended") {
    detail(invitationId, "reinstate_not_suspended");
  }
  detail(invitationId, "reinstate_failed");
}

/** Ganti kepemilikan (klien jasa EO) — undangan + order pindah ke user baru. */
export async function adminChangeOwnerAction(
  invitationId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const parsed = adminChangeOwnerSchema.safeParse({
    newUserId: formData.get("newUserId"),
  });
  if (!parsed.success) detail(invitationId, "owner_invalid");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_change_owner", {
    p_invitation_id: invitationId,
    p_new_user_id: parsed.data.newUserId,
    p_admin_id: adminUser.id,
  });
  if (error) detail(invitationId, "owner_failed");

  const result = data?.[0]?.result;
  revalidateAfter(null);
  if (result === "changed" || result === "noop")
    detail(invitationId, "owner_ok");
  if (result === "user_not_found") detail(invitationId, "owner_user_not_found");
  detail(invitationId, "owner_failed");
}
