"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { isUuid } from "@/lib/id";
import { UPGRADABLE_STATUSES } from "@/lib/invitation-status";
import { generateOrderCode } from "@/lib/order";
import { isPaymentExempt } from "@/server/guards/auth";
import { aktifkanGratis } from "@/server/payment/gratis";
import { terbitkanLink } from "@/server/payment/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upgradeDifference } from "@/lib/upgrade";
import { packageCodeSchema } from "@/lib/validation/checkout";
import type { CheckoutState } from "@/server/actions/checkout";
import { findPendingUpgradeOrder } from "@/server/upgrade/orders";

/**
 * Upgrade paket di tengah masa aktif — bayar SELISIH harga (AUDIT-2026-10-01
 * B3, SPEC §4.8).
 *
 * MEMAKAI-ULANG alur order + Pakasir + webhook dua lapis + `activate_paid_order`
 * yang sudah teruji; tak ada alur bayar kedua. Yang berbeda hanya nominalnya
 * (selisih, bukan harga penuh) dan efeknya di dalam RPC: `orders.purpose =
 * 'upgrade'` membuat RPC HANYA menukar `package_id` — `active_until`,
 * `published_at`, dan `status` tak disentuh.
 *
 * Pola wajib: **auth → cek kepemilikan → validasi Zod → operasi (service_role)
 * → revalidate**. Nominal dihitung dari harga katalog di SERVER; klien hanya
 * mengirim kode paket tujuan.
 */

const ORDER_CODE_RETRIES = 5;

/** Tujuan redirect pasca-bayar: halaman upgrade yang mem-poll statusnya. */
function upgradePath(invitationId: string): string {
  return `/dashboard/undangan/${invitationId}/upgrade`;
}

export async function createUpgradeCheckoutAction(
  invitationId: string,
  packageCode: string,
): Promise<CheckoutState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  const parsed = packageCodeSchema.safeParse(packageCode);
  if (!parsed.success) return { status: "error" };
  const targetCode = parsed.data;

  // Kepemilikan + status + paket sekarang (RLS membatasi ke baris pemanggil).
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, status, package_id, purged_at, user_id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { status: "error" };

  // Kerangka pasca-retensi: foto/tamu/ucapan sudah dihapus permanen. Tak boleh
  // membayar APA PUN untuk baris seperti ini — penahan yang sama ada di
  // `createCheckoutAction`.
  if (inv.purged_at) {
    return { status: "error", message: copy.upgrade.notUpgradable };
  }
  // HANYA `active` (lihat docblock `UPGRADABLE_STATUSES`): jalur ini menagih
  // selisih, jadi ia tak boleh pernah menjadi pintu murah menuju masa aktif.
  if (!UPGRADABLE_STATUSES.has(inv.status)) {
    return { status: "error", message: copy.upgrade.notUpgradable };
  }
  // Tanpa paket sekarang tak ada yang bisa dikreditkan sebagai selisih (mis.
  // undangan yang diaktifkan manual tanpa paket). Menagih harga penuh lewat
  // jalur ini akan memberi pelanggan harga penuh TANPA periode baru — lebih
  // buruk daripada menyuruhnya menunggu perpanjangan.
  if (!inv.package_id) {
    return { status: "error", message: copy.upgrade.noCurrentPackage };
  }

  const admin = createSupabaseAdminClient();

  // Order upgrade yang belum lunas → jangan buat yang kedua (cegah tagih-ganda:
  // yang kedua akan berakhir `held` karena paketnya sudah menjadi paket tujuan).
  if (await findPendingUpgradeOrder(admin, invitationId)) {
    return { status: "error", message: copy.upgrade.orderPending };
  }

  // Harga OTORITATIF dari katalog, untuk kedua sisi selisih sekaligus.
  //
  // Paket sekarang dibaca dengan klien admin dan TANPA filter `is_active`:
  // `packages_select_public` = `using (is_active or is_admin())`, jadi paket
  // yang dinonaktifkan pemilik toko (mis. saat mengganti harga) mengembalikan
  // NULL SENYAP bagi klien — dan harga kredit yang hilang akan membuat selisih
  // tampak sebesar harga penuh. Preseden sama: `src/server/orders/history.ts`.
  const [{ data: current }, { data: target }] = await Promise.all([
    admin
      .from("packages")
      .select("price_idr")
      .eq("id", inv.package_id)
      .maybeSingle(),
    admin
      .from("packages")
      .select("id, price_idr")
      .eq("code", targetCode)
      .eq("is_active", true)
      .eq("kind", "invitation") // upgrade hanya antar paket undangan
      .maybeSingle(),
  ]);
  if (!current || !target) {
    return { status: "error", message: copy.upgrade.packageUnavailable };
  }

  // Gerbang uang terakhir: selisih wajib > 0. Paket yang sama, penurunan, dan
  // katalog yang harganya berubah di antara pemuatan halaman & klik semuanya
  // berakhir di sini — sebelum order dibuat, bukan sesudah.
  const differenceIdr = upgradeDifference(current.price_idr, target.price_idr);
  if (differenceIdr === null) {
    return { status: "error", message: copy.upgrade.noDifference };
  }

  // Admin & Pro tak pernah ditagih (DECISIONS #100) — hanya undangan MILIK
  // sendiri; semua syarat di atas tetap berlaku.
  if (inv.user_id === user.id && (await isPaymentExempt(supabase, user.id))) {
    const ok = await aktifkanGratis(admin, {
      invitationId,
      packageId: target.id,
      purpose: "upgrade",
      actorId: user.id,
    });
    if (!ok) return { status: "error", message: copy.common.error };
    revalidatePath(upgradePath(invitationId));
    return { status: "redirect", url: "/dashboard" };
  }

  // Order hanya lewat service_role. TIDAK menyentuh undangan sama sekali:
  // paketnya ditukar nanti oleh RPC, setelah `transactiondetail` mengonfirmasi.
  let orderCode = "";
  let created = false;
  for (let attempt = 0; attempt < ORDER_CODE_RETRIES; attempt += 1) {
    orderCode = generateOrderCode();
    const { error } = await admin.from("orders").insert({
      user_id: user.id,
      invitation_id: invitationId,
      package_id: target.id,
      amount_idr: differenceIdr,
      status: "pending",
      order_code: orderCode,
      purpose: "upgrade",
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
  revalidatePath(upgradePath(invitationId));

  const url = await terbitkanLink(admin, {
    orderCode,
    amountIdr: differenceIdr,
    redirectUrl: `${appUrl}${upgradePath(invitationId)}`,
  });
  if (!url) return { status: "error", message: copy.checkout.linkFailed };
  return { status: "redirect", url };
}
