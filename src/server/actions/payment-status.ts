"use server";

import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/id";
import { checkClientRateLimit } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyOrderPaid } from "@/server/email/notify";
import { verifyAndActivate } from "@/server/payment/reconcile";

/**
 * State cek pembayaran untuk poll klien (M3.3):
 *   - `active`  → undangan aktif; tampilkan link (poll berhenti).
 *   - `pending` → belum lunas terkonfirmasi ATAU kegagalan transien
 *                 (verifikasi/RPC/rate-limit) → klien terus poll.
 *   - `expired` → order kedaluwarsa/gagal (poll berhenti; buat order baru).
 *   - `review`  → dibayar tetapi undangan ditangguhkan admin (poll berhenti).
 *   - `none`    → tak ada order relevan (poll berhenti).
 *   - `error`   → anomali; hentikan poll.
 */
export type PaymentStatusState =
  | { status: "active"; slug: string }
  | { status: "pending" }
  | { status: "expired" }
  | { status: "review" }
  | { status: "none" }
  | { status: "error" };

// Poll klien ~4 dtk sekali (lihat PaymentStatusPoller). 30/menit menyisakan
// margin untuk cek manual; jalur mahal `transactiondetail` hanya dipanggil saat
// order masih `pending`.
const POLL_LIMIT = { max: 30, windowMs: 60_000 };

/**
 * Cek & rekonsiliasi status pembayaran sebuah undangan milik pemanggil. Ini
 * adalah jalur aktivasi OTORITATIF KEDUA (pendamping webhook M3.2): bila klien
 * kembali dari Pakasir sebelum webhook tiba, poll ini memverifikasi lewat
 * `transactiondetail` dan mengaktifkan via RPC idempoten yang sama. AMAN: hanya
 * order MILIK pemanggil (RLS) yang bisa dicek, dan hanya `transactiondetail`
 * OTORITATIF yang boleh mengaktifkan — poll saja tak pernah cukup.
 *
 * Pola: auth → cek kepemilikan (RLS) → (rekonsiliasi service_role) → revalidate.
 */
export async function checkPaymentStatusAction(
  invitationId: string,
): Promise<PaymentStatusState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };
  if (!isUuid(invitationId)) return { status: "error" };

  // Rate limit: transien-lembut → `pending` agar klien tetap poll (backoff via
  // interval-nya sendiri), bukan gagal keras.
  const rl = await checkClientRateLimit("payment-status", POLL_LIMIT);
  if (!rl.ok) return { status: "pending" };

  // Kepemilikan (RLS membatasi ke baris milik pemanggil).
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, status")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { status: "error" };
  if (inv.status === "active") return { status: "active", slug: inv.slug };
  // Ditangguhkan → tinjau; TIDAK merekonsiliasi lewat poll di sini. Batasan yang
  // diketahui (severity rendah): bila admin men-suspend saat order masih `pending`
  // lalu tautan Pakasir yang masih valid dibayar DAN webhook hilang permanen, poll
  // tak mencatat pembayaran (order tetap `pending`). Aman: undangan tak dipublikasi
  // ulang (RPC kembalikan `held`). Backstop pencatatan = cron rekonsiliasi M3.4
  // (verifikasi `transactiondetail` sebelum expire) + rekonsiliasi admin.
  if (inv.status === "suspended") return { status: "review" };

  // Order terbaru untuk undangan ini (RLS: `orders_select` mengizinkan pemilik).
  const { data: order } = await supabase
    .from("orders")
    .select("order_code, amount_idr, status")
    .eq("invitation_id", invitationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return { status: "none" };

  // Order sudah paid tetapi undangan belum active (mis. `held`/ditangguhkan) → tinjau.
  if (order.status === "paid") return { status: "review" };
  // Order kedaluwarsa/gagal/refund → tak ada yang bisa di-poll.
  if (order.status !== "pending") return { status: "expired" };

  // Rekonsiliasi OTORITATIF (verifikasi transactiondetail → aktivasi RPC idempoten).
  const admin = createSupabaseAdminClient();
  const outcome = await verifyAndActivate(admin, {
    order_code: order.order_code,
    amount_idr: order.amount_idr,
  });

  switch (outcome.kind) {
    case "ok":
      if (outcome.result === "activated" || outcome.result === "already_paid") {
        // Kuitansi HANYA pada transisi `activated` (best-effort, tak menggagalkan poll).
        if (outcome.result === "activated") {
          await notifyOrderPaid(admin, order.order_code);
        }
        if (outcome.slug) revalidatePath(`/${outcome.slug}`);
        revalidatePath("/dashboard");
        // Slug absen (anomali) → `pending`; poll berikutnya baca undangan yang
        // kini `active` (early-return di atas) dan mengembalikan slug asli.
        return outcome.slug
          ? { status: "active", slug: outcome.slug }
          : { status: "pending" };
      }
      if (outcome.result === "held") return { status: "review" };
      // invalid / not_found → anomali (order berubah di bawah kita).
      return { status: "error" };
    case "not_confirmed":
      return { status: "pending" };
    case "mismatch":
      return { status: "error" };
    // Transien (jaringan/HTTP/RPC) → tetap `pending`; klien poll lagi nanti.
    case "verify_error":
    case "rpc_error":
      return { status: "pending" };
  }
}
