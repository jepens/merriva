import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  UpgradePanel,
  type UpgradeChoice,
} from "@/components/dashboard/upgrade-panel";
import { UpgradePaymentPoller } from "@/components/dashboard/upgrade-payment-poller";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { wibDateTime } from "@/lib/admin/display";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { UPGRADABLE_STATUSES } from "@/lib/invitation-status";
import { resolveLimits } from "@/lib/limits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { daysUntil, upgradeOptions } from "@/lib/upgrade";
import { isPaymentExempt, requireUser } from "@/server/guards/auth";
import { findLatestUpgradeOrder } from "@/server/upgrade/orders";

export const metadata: Metadata = { title: copy.upgrade.title };

const u = copy.upgrade;

/**
 * Halaman upgrade paket (AUDIT-2026-10-01 B3, SPEC §4.8): naik ke paket yang
 * lebih mahal dengan membayar SELISIH harga, tanpa mengubah masa aktif.
 *
 * Dinamis (auth); undangan harus milik pemanggil (RLS). Strukturnya mengikuti
 * halaman Album Momen: satu halaman yang menampilkan panel penawaran ATAU poller
 * pembayaran, tergantung ada tidaknya order yang belum lunas — sehingga pemilik
 * yang baru membayar tak pernah melihat lagi tombol "bayar" untuk hal yang sama.
 */
export default async function UpgradePackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!isUuid(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, status, package_id, active_until, purged_at, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();
  // Kerangka pasca-retensi: data pribadinya sudah dihapus permanen dan dashboard
  // menyembunyikannya — halaman ini pun tak boleh jadi pintu membayarinya.
  if (inv.purged_at) notFound();

  const back = (
    <Link
      href="/dashboard"
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      {u.back}
    </Link>
  );

  const frame = (node: React.ReactNode, subtitle: string = u.subtitle) => (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{u.title}</h1>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      {node}
      {back}
    </div>
  );

  const notice = (title: string, body: string) =>
    frame(
      <Card>
        <CardContent className="space-y-2 py-8 text-center">
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            {body}
          </p>
        </CardContent>
      </Card>,
    );

  // HANYA `active` — penahan yang sama (daftar yang sama) ada di
  // `createUpgradeCheckoutAction`, jadi melewati halaman ini tak membantu.
  if (!UPGRADABLE_STATUSES.has(inv.status)) {
    return notice(u.needActiveTitle, u.needActiveBody);
  }

  const admin = createSupabaseAdminClient();

  // Order upgrade yang belum lunas → poller, BUKAN panel harga. Menampilkan
  // panel di sini akan membuat pemilik yang baru membayar menekan "bayar" lagi
  // (jebakan yang sama pernah terjadi pada add-on Album Momen — UXA-7), dan
  // poller-nya sekaligus jalur aktivasi otoritatif kedua.
  const order = await findLatestUpgradeOrder(admin, id);
  if (order && order.status === "pending") {
    return frame(
      <UpgradePaymentPoller
        invitationId={id}
        slug={inv.slug}
        orderCode={order.orderCode}
        amountIdr={order.amountIdr}
        packageName={order.packageName}
      />,
    );
  }

  // Tanpa paket sekarang tak ada yang bisa dikreditkan sebagai selisih.
  if (!inv.package_id) {
    return notice(u.noPackageTitle, u.noPackageBody);
  }

  // Harga paket sekarang: klien admin & TANPA filter `is_active`. Paket yang
  // dinonaktifkan (mis. saat pemilik toko mengganti harga) mengembalikan NULL
  // SENYAP bagi klien biasa — dan kredit yang hilang akan membuat selisih tampak
  // sebesar harga penuh. Query yang SAMA dipakai aksi checkout-nya.
  const { data: current } = await admin
    .from("packages")
    .select("name, price_idr")
    .eq("id", inv.package_id)
    .maybeSingle();
  if (!current) {
    return notice(u.noPackageTitle, u.noPackageBody);
  }

  const { data: rows } = await admin
    .from("packages")
    .select("code, name, price_idr, duration_months, limits")
    .eq("is_active", true)
    .eq("kind", "invitation") // upgrade hanya antar paket undangan
    .order("price_idr", { ascending: true });

  // Hitungan selisih dari fungsi yang SAMA dengan yang dipakai server saat
  // membuat order: angka yang dilihat pelanggan adalah angka yang ditagih.
  const options = upgradeOptions(
    current.price_idr,
    (rows ?? []).map((p) => ({
      code: p.code,
      name: p.name,
      priceIdr: p.price_idr,
      durationMonths: p.duration_months,
      limits: resolveLimits(p.limits),
    })),
  );
  if (options.length === 0) {
    return notice(u.topTierTitle, u.topTierBody);
  }

  const choices: UpgradeChoice[] = options.map((o) => ({
    code: o.code,
    name: o.name,
    priceIdr: o.priceIdr,
    differenceIdr: o.differenceIdr,
    limits: o.limits,
  }));

  // Server Component dinamis (dashboard = SSR ter-auth) — waktu per-request
  // disengaja; aturan purity react-hooks tak berlaku di sini.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  // Admin & Pro tak pernah ditagih (DECISIONS #100) — hanya undangan MILIK
  // sendiri (admin melihat semua undangan lewat RLS).
  const free =
    inv.user_id === user.id && (await isPaymentExempt(supabase, user.id));

  return frame(
    <UpgradePanel
      invitationId={id}
      currentName={current.name}
      currentPriceIdr={current.price_idr}
      activeUntilLabel={
        inv.active_until
          ? wibDateTime(inv.active_until)
          : copy.dashboard.orders.dash
      }
      daysLeft={daysUntil(inv.active_until, nowMs)}
      choices={choices}
      free={free}
    />,
    free ? u.freeSubtitle : u.subtitle,
  );
}
