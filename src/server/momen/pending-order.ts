import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Deteksi order add-on Album Momen yang masih `pending` untuk sebuah undangan.
 *
 * Modul TERPISAH dari `server/actions/momen-checkout.ts` karena berkas itu
 * ber-`"use server"`: setiap ekspor di sana menjadi endpoint Server Action, dan
 * helper yang menerima klien Supabase sebagai argumen tidak boleh terekspos
 * begitu. Di sini ia hanya fungsi server biasa (dipakai aksi + halaman).
 *
 * KENAPA ADA: selama order ini hidup, aktivasi tier GRATIS dan checkout baru
 * harus ditolak. `create_momen_album` memakai `on conflict (invitation_id) do
 * nothing`, jadi album gratis yang terlanjur dibuat membuat cabang
 * `addon_momen` di `activate_paid_order` menjadi no-op — webhook tetap menandai
 * order `paid` sementara tier yang DIBAYAR tak pernah diberikan: uang masuk,
 * barang tidak, tanpa error di mana pun (AUDIT-2026-09-04 KUA-2).
 */
export async function findPendingMomenOrder(
  admin: SupabaseClient<Database>,
  invitationId: string,
): Promise<{ orderCode: string } | null> {
  // `is_active` sengaja TIDAK difilter: paket yang dinonaktifkan setelah pemilik
  // checkout tetap meninggalkan order pending yang sah dan harus terdeteksi.
  const { data: pkgs } = await admin
    .from("packages")
    .select("id")
    .eq("kind", "addon_momen");
  const ids = (pkgs ?? []).map((p) => p.id);
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
