import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Lookup order UPGRADE paket untuk sebuah undangan (AUDIT-2026-10-01 B3).
 *
 * Modul server BIASA (tanpa `"use server"`) — alasan identik dengan
 * `src/server/momen/orders.ts` dan `src/server/orders/history.ts`: setiap ekspor
 * di berkas ber-`"use server"` menjadi endpoint Server Action, dan helper yang
 * menerima klien Supabase sebagai argumen tidak boleh terekspos begitu.
 *
 * Pembedanya kolom `orders.purpose`, BUKAN paketnya: paket tujuan upgrade adalah
 * paket undangan biasa (`premium`), sama seperti yang dipakai aktivasi. Karena
 * itu setiap query order di jalur upgrade WAJIB memfilter `purpose` — dan
 * sebaliknya, jalur aktivasi wajib mengecualikannya (lihat `createCheckoutAction`).
 */

type Admin = SupabaseClient<Database>;

export interface UpgradeOrderSummary {
  orderCode: string;
  amountIdr: number;
  status: string;
  /** Paket TUJUAN upgrade — pembanding `invitations.package_id` saat poll. */
  packageId: string;
  packageName: string | null;
}

/**
 * Order upgrade yang masih `pending`, bila ada.
 *
 * Selama order ini hidup, checkout upgrade baru harus ditolak: dua order upgrade
 * untuk undangan yang sama berarti pelanggan bisa membayar dua kali untuk satu
 * kenaikan paket — yang kedua akan berakhir `held` (RPC menolak paket yang sudah
 * menjadi paket tujuan) dan menuntut refund manual.
 */
export async function findPendingUpgradeOrder(
  admin: Admin,
  invitationId: string,
): Promise<{ orderCode: string; amountIdr: number; packageId: string } | null> {
  const { data } = await admin
    .from("orders")
    .select("order_code, amount_idr, package_id")
    .eq("invitation_id", invitationId)
    .eq("purpose", "upgrade")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? {
        orderCode: data.order_code,
        amountIdr: data.amount_idr,
        packageId: data.package_id,
      }
    : null;
}

/**
 * Order upgrade TERBARU apa pun statusnya — dasar jalur aktivasi otoritatif
 * kedua.
 *
 * KENAPA PERLU: `checkPaymentStatusAction` (poll undangan) berkunci pada status
 * UNDANGAN dan early-return begitu statusnya `active`. Pembeli upgrade
 * undangannya SELALU `active` — itu syarat checkout-nya — sehingga order upgrade
 * TAK PERNAH direkonsiliasi di sana. Persis jebakan yang sama pernah ditemukan
 * pada add-on Album Momen (AUDIT-2026-09-04 KUA-2b).
 */
export async function findLatestUpgradeOrder(
  admin: Admin,
  invitationId: string,
): Promise<UpgradeOrderSummary | null> {
  const { data: order } = await admin
    .from("orders")
    .select("order_code, amount_idr, status, package_id")
    .eq("invitation_id", invitationId)
    .eq("purpose", "upgrade")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return null;

  // `is_active` sengaja TIDAK difilter: paket yang dinonaktifkan setelah
  // pelanggan checkout tetap meninggalkan order sah yang harus bisa ditampilkan
  // (preseden identik: `src/server/momen/orders.ts`).
  const { data: pkg } = await admin
    .from("packages")
    .select("name")
    .eq("id", order.package_id)
    .maybeSingle();

  return {
    orderCode: order.order_code,
    amountIdr: order.amount_idr,
    status: order.status,
    packageId: order.package_id,
    packageName: pkg?.name ?? null,
  };
}
