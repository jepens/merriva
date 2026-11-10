import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PaymentStatusPoller } from "@/components/dashboard/payment-status-poller";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentStatusState } from "@/server/actions/payment-status";
import { requireUser } from "@/server/guards/auth";
import { qrisUntukOrder } from "@/server/payment/qris";

export const metadata: Metadata = { title: copy.paymentStatus.title };

/**
 * Halaman cek status pembayaran (SPEC §4.8 / M3.3). Klien di-redirect ke sini
 * dari Pakasir setelah bayar; komponen poller memverifikasi lewat
 * status transaksi OTORITATIF (jalur aktivasi kedua, pendamping webhook)
 * hingga undangan aktif. Dinamis (auth); undangan harus milik pemanggil (RLS).
 * Status awal dihitung di server agar tak ada flash sebelum poll pertama.
 */
export default async function PaymentStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  if (!isUuid(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, status")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  // Order terbaru untuk undangan ini (RLS `orders_select` → hanya milik pemilik).
  const { data: order } = await supabase
    .from("orders")
    .select(
      "order_code, amount_idr, status, package_id, qr_content, created_at",
    )
    .eq("invitation_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Belum aktif & belum ada order → belum checkout; arahkan ke halaman aktivasi.
  if (!order && inv.status !== "active") {
    redirect(`/dashboard/undangan/${id}/aktifkan`);
  }

  // Nama paket (packages dapat dibaca via RLS; sama seperti halaman aktivasi).
  let packageName = "";
  if (order) {
    const { data: pkg } = await supabase
      .from("packages")
      .select("name")
      .eq("id", order.package_id)
      .maybeSingle();
    packageName = pkg?.name ?? "";
  }

  const initialStatus = resolveInitialStatus(inv.status, order?.status);

  // QRIS dibayar DI HALAMAN INI (BinderPay tak punya halaman hosted).
  // Server Component dinamis (dashboard = SSR ter-auth) — waktu per-request
  // disengaja; aturan purity react-hooks tak berlaku di sini.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const qr = order ? await qrisUntukOrder(order, nowMs) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.paymentStatus.title}
        </h1>
      </div>

      <PaymentStatusPoller
        invitationId={id}
        slug={inv.slug}
        orderCode={order?.order_code ?? ""}
        amountIdr={order?.amount_idr ?? 0}
        packageName={packageName}
        initialStatus={initialStatus}
        qr={qr}
      />
    </div>
  );
}

/** Status awal (server) untuk poller — cerminan `checkPaymentStatusAction`. */
function resolveInitialStatus(
  invStatus: string,
  orderStatus: string | undefined,
): PaymentStatusState["status"] {
  if (invStatus === "active") return "active";
  if (invStatus === "suspended") return "review";
  if (!orderStatus) return "none";
  if (orderStatus === "paid") return "review"; // dibayar tetapi belum active → tinjau
  if (orderStatus === "pending") return "pending";
  return "expired"; // expired / failed / refunded
}
