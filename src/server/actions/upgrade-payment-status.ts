"use server";

import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/id";
import { checkClientRateLimit } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyOrderPaid } from "@/server/email/notify";
import { verifyAndActivate } from "@/server/payment/reconcile";
import { findLatestUpgradeOrder } from "@/server/upgrade/orders";

/**
 * Jalur aktivasi OTORITATIF KEDUA untuk upgrade paket (AUDIT-2026-10-01 B3).
 *
 * KENAPA TIDAK MEMAKAI `checkPaymentStatusAction`: jalur undangan berkunci pada
 * status UNDANGAN dan early-return `active` sebelum merekonsiliasi apa pun.
 * Pembeli upgrade undangannya SELALU `active` — itu syarat checkout-nya —
 * sehingga order upgrade TAK PERNAH direkonsiliasi di sana, dan aktivasinya akan
 * bergantung penuh pada webhook Pakasir yang tanpa signature dan bisa hilang,
 * dengan backstop cron baru 24 jam kemudian. Jebakan yang sama persis sudah
 * pernah ditemukan pada add-on Album Momen (AUDIT-2026-09-04 KUA-2b); berkas ini
 * mengikuti pola yang sudah ada, bukan membuat pola ketiga.
 *
 * Inti verifikasinya `verifyAndActivate` yang SAMA — verifikasi dua lapis
 * (`transactiondetail` OTORITATIF sebelum aktivasi) tak berubah sedikit pun.
 *
 * Pola: auth → cek kepemilikan (RLS) → rekonsiliasi (service_role) → revalidate.
 */

/**
 *   - `active`  → paket undangan SUDAH menjadi paket tujuan; poll berhenti.
 *   - `pending` → belum lunas terkonfirmasi ATAU kegagalan transien; terus poll.
 *   - `expired` → order kedaluwarsa/gagal/refund; poll berhenti.
 *   - `review`  → order `paid` tetapi paketnya tak ditukar (RPC `held`: undangan
 *                 kedaluwarsa/ditangguhkan saat pembayaran berjalan, atau sudah
 *                 memegang paket tujuan lewat perpanjangan). Butuh manusia —
 *                 uang sudah masuk dan tak boleh hilang tanpa jejak.
 *   - `none`    → tak ada order upgrade sama sekali.
 *   - `error`   → anomali; hentikan poll.
 */
export type UpgradePaymentState =
  | { status: "active" }
  | { status: "pending" }
  | { status: "expired" }
  | { status: "review" }
  | { status: "none" }
  | { status: "error" };

// Sejalan dengan dua poll yang sudah ada: klien mem-poll ~4 dtk sekali. Jalur
// mahal (`transactiondetail`) hanya tersentuh saat order masih `pending`.
const POLL_LIMIT = { max: 30, windowMs: 60_000 };

export async function checkUpgradePaymentStatusAction(
  invitationId: string,
): Promise<UpgradePaymentState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };
  if (!isUuid(invitationId)) return { status: "error" };

  // Transien-lembut → `pending` agar klien tetap poll, bukan gagal keras.
  const rl = await checkClientRateLimit("upgrade-payment", POLL_LIMIT);
  if (!rl.ok) return { status: "pending" };

  // Kepemilikan: RLS membatasi ke undangan milik pemanggil.
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, package_id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { status: "error" };

  const admin = createSupabaseAdminClient();
  const order = await findLatestUpgradeOrder(admin, invitationId);
  if (!order) return { status: "none" };

  // Kondisi berhenti yang sesungguhnya: paket undangan = paket tujuan order,
  // apa pun jalur yang menukarnya (webhook, poll ini, atau cron).
  //
  // `status === "paid"` WAJIB ikut diperiksa. Tanpa itu, pemilik yang
  // kedaluwarsa lalu memperpanjang dengan Premium — sementara order upgrade
  // lamanya masih `pending` — akan melihat layar "upgrade selesai" untuk
  // pembayaran yang belum pernah terjadi.
  if (order.status === "paid") {
    return inv.package_id === order.packageId
      ? { status: "active" }
      : { status: "review" };
  }
  if (order.status !== "pending") return { status: "expired" };

  const outcome = await verifyAndActivate(admin, {
    order_code: order.orderCode,
    amount_idr: order.amountIdr,
    txn_id: order.txnId,
  });

  switch (outcome.kind) {
    case "ok":
      if (outcome.result === "activated" || outcome.result === "already_paid") {
        // Kuitansi HANYA pada transisi `activated` (best-effort, tak
        // menggagalkan poll). `notifyOrderPaid` mengenali order upgrade dan
        // mengirim kuitansi yang tidak mengaku membeli masa aktif.
        if (outcome.result === "activated") {
          await notifyOrderPaid(admin, order.orderCode);
        }
        revalidatePath(`/dashboard/undangan/${invitationId}/upgrade`);
        revalidatePath("/dashboard");
        // Halaman undangan publik (ISR): batas paket ikut menentukan watermark
        // dan tema premium, jadi cache-nya HARUS disegarkan — tanpa ini pemilik
        // membayar upgrade dan watermark-nya tetap terlihat tamu.
        revalidatePath(`/${inv.slug}`);
        return outcome.result === "activated"
          ? { status: "active" }
          : // `already_paid` di sini berarti order sudah diproses lebih dulu
            // oleh webhook; keadaan paket menentukan hasilnya pada poll
            // berikutnya (dibaca di cabang `order.status === "paid"` di atas).
            { status: "pending" };
      }
      // `held` = paket tak ditukar (undangan tak lagi `active`, atau sudah
      // memegang paket tujuan). Uang sudah masuk → butuh manusia.
      if (outcome.result === "held") return { status: "review" };
      return { status: "error" };
    case "not_confirmed":
      return { status: "pending" };
    case "mismatch":
      return { status: "error" };
    // Transien (jaringan/429/5xx/RPC) → tetap `pending`; klien poll lagi nanti.
    case "verify_error":
    case "rpc_error":
      return { status: "pending" };
    // Kontrak verifikasi PUTUS — tak akan membaik bila diulang. `pending` akan
    // membuat poller berputar sampai batasnya (±6 menit) lalu menyerah tanpa
    // penjelasan, padahal pelanggan mungkin SUDAH membayar. `error` menghentikan
    // poll dan memunculkan jalur bantuan, yang memang satu-satunya jalan keluar;
    // laporan `payment.verify.broken` sudah dipancarkan `verifyAndActivate`.
    case "verify_broken":
      return { status: "error" };
  }
}
