import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Lookup order add-on Album Momen untuk sebuah undangan.
 *
 * Modul TERPISAH dari `server/actions/momen-*.ts` karena berkas-berkas itu
 * ber-`"use server"`: setiap ekspor di sana menjadi endpoint Server Action, dan
 * helper yang menerima klien Supabase sebagai argumen tidak boleh terekspos
 * begitu. Di sini keduanya fungsi server biasa (dipakai aksi + halaman).
 */

/** Ringkasan order add-on secukupnya untuk rekonsiliasi & tampilan status. */
export interface MomenOrderSummary {
  orderCode: string;
  amountIdr: number;
  status: string;
  packageName: string | null;
}

/**
 * Id seluruh paket add-on. `is_active` sengaja TIDAK difilter: paket yang
 * dinonaktifkan setelah pemilik checkout tetap meninggalkan order sah yang harus
 * terdeteksi.
 */
async function addonPackageIds(
  admin: SupabaseClient<Database>,
): Promise<string[]> {
  const { data } = await admin
    .from("packages")
    .select("id")
    .eq("kind", "addon_momen");
  return (data ?? []).map((p) => p.id);
}

/**
 * Order add-on yang masih `pending`, bila ada.
 *
 * KENAPA ADA: selama order ini hidup, aktivasi tier GRATIS dan checkout baru
 * harus ditolak. `create_momen_album` memakai `on conflict (invitation_id) do
 * nothing`, jadi album gratis yang terlanjur dibuat membuat cabang
 * `addon_momen` di `activate_paid_order` menjadi no-op — webhook tetap menandai
 * order `paid` sementara tier yang DIBAYAR tak pernah diberikan: uang masuk,
 * barang tidak, tanpa error di mana pun (AUDIT-2026-09-04 KUA-2a).
 */
export async function findPendingMomenOrder(
  admin: SupabaseClient<Database>,
  invitationId: string,
): Promise<{ orderCode: string } | null> {
  const ids = await addonPackageIds(admin);
  if (ids.length === 0) return null;

  const { data: order } = await admin
    .from("orders")
    .select("order_code")
    .eq("invitation_id", invitationId)
    .eq("status", "pending")
    .in("package_id", ids)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return order ? { orderCode: order.order_code } : null;
}

/**
 * Order add-on TERBARU apa pun statusnya — dasar jalur aktivasi otoritatif kedua
 * (KUA-2b). Poll undangan (`checkPaymentStatusAction`) tak bisa dipakai untuk
 * add-on karena ia berkunci pada status UNDANGAN, dan pembeli add-on undangannya
 * SELALU `active` → ia langsung early-return dan order add-on tak pernah
 * direkonsiliasi.
 */
export async function findLatestMomenOrder(
  admin: SupabaseClient<Database>,
  invitationId: string,
): Promise<MomenOrderSummary | null> {
  const ids = await addonPackageIds(admin);
  if (ids.length === 0) return null;

  const { data: order } = await admin
    .from("orders")
    .select("order_code, amount_idr, status, package_id")
    .eq("invitation_id", invitationId)
    .in("package_id", ids)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return null;

  const { data: pkg } = await admin
    .from("packages")
    .select("name")
    .eq("id", order.package_id)
    .maybeSingle();

  return {
    orderCode: order.order_code,
    amountIdr: order.amount_idr,
    status: order.status,
    packageName: pkg?.name ?? null,
  };
}
