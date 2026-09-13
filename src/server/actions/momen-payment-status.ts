"use server";

import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/id";
import { checkClientRateLimit } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyOrderPaid } from "@/server/email/notify";
import { findLatestMomenOrder } from "@/server/momen/orders";
import { verifyAndActivate } from "@/server/payment/reconcile";

/**
 * Jalur aktivasi OTORITATIF KEDUA untuk add-on Album Momen (AUDIT-2026-09-04
 * KUA-2b).
 *
 * KENAPA TIDAK MEMAKAI `checkPaymentStatusAction`: jalur undangan berkunci pada
 * status UNDANGAN dan early-return `active` sebelum merekonsiliasi. Pembeli
 * add-on undangannya SELALU `active` (syarat checkout), sehingga order add-on
 * TAK PERNAH direkonsiliasi di sana — aktivasi bergantung penuh pada webhook
 * Pakasir yang tanpa signature dan bisa hilang, dengan backstop cron baru
 * setelah 24 jam.
 *
 * Aksi ini berkunci pada status ORDER dan keberadaan ALBUM, lalu memakai inti
 * `verifyAndActivate` yang SAMA — tidak ada alur bayar/verifikasi kedua, dan
 * verifikasi 2-lapis (`transactiondetail` OTORITATIF sebelum aktivasi) tak
 * berubah sedikit pun.
 *
 * Pola: auth → cek kepemilikan (RLS) → rekonsiliasi (service_role) → revalidate.
 */

/**
 *   - `active`  → album sudah ada (add-on aktif); poll berhenti.
 *   - `pending` → belum lunas terkonfirmasi ATAU kegagalan transien; terus poll.
 *   - `expired` → order kedaluwarsa/gagal/refund; poll berhenti.
 *   - `review`  → order `paid` tetapi album belum ada (anomali yang butuh
 *                 perhatian manusia — mis. order lama dari era sebelum KUA-2a
 *                 ditutup, saat album tier gratis dibuat lebih dulu sehingga
 *                 `create_momen_album` menjadi no-op).
 *   - `none`    → tak ada order add-on sama sekali.
 *   - `error`   → anomali; hentikan poll.
 */
export type MomenPaymentState =
  | { status: "active" }
  | { status: "pending" }
  | { status: "expired" }
  | { status: "review" }
  | { status: "none" }
  | { status: "error" };

// Sejalan dengan poll undangan: klien mem-poll ~4 dtk sekali. Jalur mahal
// (`transactiondetail`) hanya tersentuh saat order masih `pending`.
const POLL_LIMIT = { max: 30, windowMs: 60_000 };

export async function checkMomenPaymentStatusAction(
  invitationId: string,
): Promise<MomenPaymentState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };
  if (!isUuid(invitationId)) return { status: "error" };

  // Transien-lembut → `pending` agar klien tetap poll, bukan gagal keras.
  const rl = await checkClientRateLimit("momen-payment", POLL_LIMIT);
  if (!rl.ok) return { status: "pending" };

  // Kepemilikan: RLS membatasi ke undangan milik pemanggil.
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { status: "error" };

  const admin = createSupabaseAdminClient();

  // Album sudah ada = add-on aktif, apa pun jalur yang mengaktifkannya
  // (webhook, poll ini, atau cron). Ini kondisi berhenti yang sesungguhnya.
  const { data: album } = await admin
    .from("momen_albums")
    .select("id")
    .eq("invitation_id", invitationId)
    .maybeSingle();
  if (album) return { status: "active" };

  const order = await findLatestMomenOrder(admin, invitationId);
  if (!order) return { status: "none" };
  // Dibayar tetapi album tak terbentuk → bukan sesuatu yang bisa diperbaiki poll.
  if (order.status === "paid") return { status: "review" };
  if (order.status !== "pending") return { status: "expired" };

  const outcome = await verifyAndActivate(admin, {
    order_code: order.orderCode,
    amount_idr: order.amountIdr,
  });

  switch (outcome.kind) {
    case "ok":
      if (outcome.result === "activated" || outcome.result === "already_paid") {
        // Kuitansi HANYA pada transisi `activated` (best-effort). `notifyOrderPaid`
        // sudah mengenali `kind = addon_momen` dan mengirim kuitansi add-on.
        if (outcome.result === "activated") {
          await notifyOrderPaid(admin, order.orderCode);
        }
        revalidatePath(`/dashboard/undangan/${invitationId}/momen`);
        revalidatePath("/dashboard");
        // Halaman undangan publik (ISR) → agar FAB "Album Momen" muncul
        // (DECISIONS #24/#25).
        revalidatePath(`/${inv.slug}`);
        // `already_paid` tanpa album = anomali yang sama dengan cabang di atas.
        return outcome.result === "activated"
          ? { status: "active" }
          : { status: "review" };
      }
      // `held` = undangan ditangguhkan admin → tak boleh diaktifkan diam-diam.
      if (outcome.result === "held") return { status: "review" };
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
