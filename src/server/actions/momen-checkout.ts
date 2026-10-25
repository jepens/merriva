"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { isUuid } from "@/lib/id";
import {
  momenPaidCodeSchema,
  MOMEN_FREE_CODE,
} from "@/lib/momen/package-codes";
import { generateOrderCode } from "@/lib/order";
import { isPaymentExempt } from "@/server/guards/auth";
import { aktifkanGratis } from "@/server/payment/gratis";
import { terbitkanLink } from "@/server/payment/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CheckoutState } from "@/server/actions/checkout";
import { findPendingMomenOrder } from "@/server/momen/orders";

/**
 * Aktivasi add-on Album Momen (FASE H, DECISIONS #22). MEMAKAI-ULANG alur order
 * + Pakasir + webhook + activate_paid_order yang sudah teruji — TAK ada alur
 * bayar kedua. Bedanya: add-on dibeli untuk undangan yang SUDAH aktif dan TIDAK
 * mengubah status/masa-aktif undangan (album dibuat di cabang addon_momen RPC).
 *
 * Pola wajib: **auth → cek kepemilikan → validasi → operasi (service_role) →
 * revalidate**. Harga otoritatif dari DB (jangan percaya klien).
 */

const ORDER_CODE_RETRIES = 5;

/** State aktivasi tier gratis (self-service, tanpa redirect pembayaran). */
export type MomenActivateState =
  { status: "ok" } | { status: "error"; message?: string };

/** Path halaman kelola album (juga tujuan redirect pasca-bayar add-on). */
function momenManagePath(invitationId: string): string {
  return `/dashboard/undangan/${invitationId}/momen`;
}

/**
 * Checkout add-on BERBAYAR → order `pending` + payment link Pakasir. Undangan
 * WAJIB `active` (album melekat pada undangan hidup) dan statusnya TIDAK diubah.
 * Bila undangan sudah punya album → tolak (upgrade tier = backlog MOMEN §9,
 * cegah tagih-ganda tanpa efek). Aktivasi nyata hanya saat webhook/poll
 * terverifikasi mengaktifkan order (cabang addon_momen di activate_paid_order).
 */
export async function createMomenCheckoutAction(
  invitationId: string,
  packageCode: string,
): Promise<CheckoutState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  const parsed = momenPaidCodeSchema.safeParse(packageCode);
  if (!parsed.success) return { status: "error" };
  const code = parsed.data;

  // Kepemilikan + status (RLS membatasi ke baris milik pemanggil — kecuali
  // admin, yang melihat semua undangan).
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, status, user_id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { status: "error" };
  if (inv.status !== "active") {
    return { status: "error", message: copy.checkout.momenNeedsActive };
  }

  const admin = createSupabaseAdminClient();

  // Sudah punya album → cegah beli/tagih ganda (upgrade tier belum ada).
  const { data: existing } = await admin
    .from("momen_albums")
    .select("id")
    .eq("invitation_id", invitationId)
    .maybeSingle();
  if (existing) {
    return { status: "error", message: copy.checkout.momenAlreadyOwned };
  }

  // Order add-on yang belum lunas → jangan buat order kedua (cegah tagih-ganda).
  if (await findPendingMomenOrder(admin, invitationId)) {
    return { status: "error", message: copy.checkout.momenOrderPending };
  }

  // Harga otoritatif dari DB (paket add-on aktif; kode undangan tak akan cocok).
  const { data: pkg } = await admin
    .from("packages")
    .select("id, price_idr")
    .eq("code", code)
    .eq("is_active", true)
    .eq("kind", "addon_momen")
    .maybeSingle();
  if (!pkg) {
    return { status: "error", message: copy.checkout.momenPackageUnavailable };
  }

  // Admin & Pro tak pernah ditagih (DECISIONS #100) — hanya undangan MILIK
  // sendiri. Diletakkan SETELAH penahan order add-on yang belum lunas: album
  // gratis yang mendahului pembayaran berjalan membuat pembayaran itu no-op.
  if (inv.user_id === user.id && (await isPaymentExempt(supabase, user.id))) {
    const ok = await aktifkanGratis(admin, {
      invitationId,
      packageId: pkg.id,
      purpose: "purchase",
      actorId: user.id,
    });
    if (!ok) return { status: "error", message: copy.common.error };
    revalidatePath(momenManagePath(invitationId));
    return { status: "redirect", url: momenManagePath(invitationId) };
  }

  // Order + payment link hanya lewat service_role. TIDAK menyentuh undangan.
  let orderCode = "";
  let created = false;
  for (let attempt = 0; attempt < ORDER_CODE_RETRIES; attempt += 1) {
    orderCode = generateOrderCode();
    const { error } = await admin.from("orders").insert({
      user_id: user.id,
      invitation_id: invitationId,
      package_id: pkg.id,
      amount_idr: pkg.price_idr,
      status: "pending",
      order_code: orderCode,
      // Add-on MEMBELI sesuatu (albumnya), jadi 'purchase' — bukan 'upgrade',
      // yang khusus untuk order yang hanya menukar paket undangan (B3).
      purpose: "purchase",
    });
    if (!error) {
      created = true;
      break;
    }
    if (error.code !== "23505")
      return { status: "error", message: copy.common.error };
    // 23505 pada order_code → bentrok, coba lagi dengan kode baru.
  }
  if (!created) return { status: "error", message: copy.common.error };

  revalidatePath("/dashboard");
  revalidatePath(momenManagePath(invitationId));

  const url = await terbitkanLink(admin, {
    orderCode,
    amountIdr: pkg.price_idr,
    redirectUrl: `${appUrl}${momenManagePath(invitationId)}`,
  });
  if (!url) return { status: "error", message: copy.checkout.linkFailed };
  return { status: "redirect", url };
}

/**
 * Aktivasi tier GRATIS (`momen_5`) — self-service langsung TANPA order/Pakasir
 * (DECISIONS #22). Undangan wajib `active`; belum punya album. Kuota peserta
 * dibaca dari `packages.limits` (sumber tunggal). Idempoten via unique
 * invitation_id pada create_momen_album (album berbayar yang sudah ada tak
 * ditimpa) — tetapi kita tolak eksplisit agar pesan jelas.
 */
export async function activateFreeMomenAction(
  invitationId: string,
): Promise<MomenActivateState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  const { data: inv } = await supabase
    .from("invitations")
    .select("id, status, slug")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { status: "error" };
  if (inv.status !== "active") {
    return { status: "error", message: copy.checkout.momenNeedsActive };
  }

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("momen_albums")
    .select("id")
    .eq("invitation_id", invitationId)
    .maybeSingle();
  if (existing) {
    return { status: "error", message: copy.checkout.momenAlreadyOwned };
  }

  // INVARIAN UANG: tier gratis TIDAK boleh mendahului add-on yang sedang dibayar.
  // Album gratis yang dibuat lebih dulu membuat aktivasi berbayar jadi no-op
  // (`on conflict do nothing`) → pemilik membayar dan tetap dapat tier gratis.
  if (await findPendingMomenOrder(admin, invitationId)) {
    return { status: "error", message: copy.checkout.momenOrderPending };
  }

  // Kuota peserta tier gratis dari DB (jangan hardcode → satu sumber kebenaran).
  const { data: pkg } = await admin
    .from("packages")
    .select("limits")
    .eq("code", MOMEN_FREE_CODE)
    .eq("is_active", true)
    .eq("kind", "addon_momen")
    .maybeSingle();
  if (!pkg) {
    return { status: "error", message: copy.checkout.momenPackageUnavailable };
  }
  const limits = (pkg.limits ?? {}) as { quota_peserta?: number | null };
  const quotaPeserta =
    typeof limits.quota_peserta === "number" ? limits.quota_peserta : null;

  const { error } = await admin.rpc("create_momen_album", {
    p_invitation_id: invitationId,
    p_quota_peserta: quotaPeserta,
    p_photo_ceiling: null,
    p_default_filter: "hangat",
  });
  if (error) return { status: "error", message: copy.common.error };

  revalidatePath("/dashboard");
  revalidatePath(momenManagePath(invitationId));
  // Halaman undangan publik (ISR) → agar tombol "Album Momen" muncul.
  revalidatePath(`/${inv.slug}`);
  return { status: "ok" };
}
