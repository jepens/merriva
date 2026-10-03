import type { Metadata } from "next";
import Link from "next/link";

import { SupportContact } from "@/components/support-contact";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { wibDateTime } from "@/lib/admin/display";
import { copy } from "@/lib/copy";
import { formatIdr, formatPaymentMethod } from "@/lib/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/guards/auth";
import {
  attachRefs,
  buysActivePeriod,
  fetchOwnOrderPage,
  orderKindLabel,
  pendingPaymentPath,
} from "@/server/orders/history";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: copy.dashboard.orders.title };

const t = copy.dashboard.orders;

type OrderStatus = Database["public"]["Enums"]["order_status"];

// `failed` & `refunded` belum pernah ditulis kode mana pun, tetapi petanya
// sengaja LENGKAP agar baris yang dimasukkan manual lewat SQL tetap merender
// dengan gaya, bukan tanpa kelas sama sekali.
const statusBadgeClass: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  expired: "bg-muted text-muted-foreground",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-sky-100 text-sky-800",
};

function Baris({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </div>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { rows, hasNext } = await fetchOwnOrderPage(supabase, user.id, page);
  // Sinkron — berbeda dari `createSupabaseServerClient()` yang wajib di-await.
  const admin = createSupabaseAdminClient();
  const orders = await attachRefs(supabase, admin, user.id, rows);

  const href = (p: number) =>
    p > 1 ? `/dashboard/pesanan?page=${p}` : "/dashboard/pesanan";

  // Skenario yang paling butuh pertolongan: uang sudah masuk, undangan belum
  // aktif. Hanya untuk paket undangan — add-on Momen tidak mengubah status
  // undangan, jadi membandingkannya akan memberi alarm palsu.
  const attention = orders.find(
    (o) =>
      o.status === "paid" &&
      buysActivePeriod(o.packageKind, o.purpose) &&
      o.invitationStatus !== "active",
  );

  // Sepupunya pada jalur upgrade: undangannya TETAP `active`, jadi kartu di atas
  // tak akan pernah menyalakannya — padahal selisihnya sudah dibayar dan
  // paketnya tak pernah naik (RPC `held`: masa aktif berakhir saat pembayaran
  // berjalan, atau paket tujuannya sudah dipegang lewat perpanjangan). Tanpa
  // kartu ini, uang itu tak punya satu pun tempat untuk terlihat.
  const upgradeAttention = orders.find(
    (o) =>
      o.status === "paid" &&
      o.purpose === "upgrade" &&
      o.invitationPackageId !== o.packageId,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      {attention ? (
        <Card className="border-amber-300">
          <CardContent className="space-y-3 py-4">
            <h2 className="text-sm font-medium">{t.attentionTitle}</h2>
            <p className="text-muted-foreground text-sm">{t.attentionBody}</p>
            <Link
              href={`/dashboard/undangan/${attention.invitationId}/bayar`}
              className={buttonVariants({ size: "sm" })}
            >
              {t.checkStatus}
            </Link>
            <SupportContact orderCode={attention.orderCode} />
          </CardContent>
        </Card>
      ) : null}

      {upgradeAttention ? (
        <Card className="border-amber-300">
          <CardContent className="space-y-3 py-4">
            <h2 className="text-sm font-medium">{t.attentionUpgradeTitle}</h2>
            <p className="text-muted-foreground text-sm">
              {t.attentionUpgradeBody}
            </p>
            <Link
              href={`/dashboard/undangan/${upgradeAttention.invitationId}/upgrade`}
              className={buttonVariants({ size: "sm" })}
            >
              {t.checkUpgradeStatus}
            </Link>
            <SupportContact orderCode={upgradeAttention.orderCode} />
          </CardContent>
        </Card>
      ) : null}

      {page === 1 && orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <h2 className="text-lg font-medium">{t.emptyTitle}</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              {t.emptyBody}
            </p>
            <Link href="/dashboard" className={cn(buttonVariants(), "mt-2")}>
              {t.emptyCta}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.orderCode}>
              <Card>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {o.packageName ?? t.packageUnknown}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {orderKindLabel(o.packageKind, o.purpose, t)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                        statusBadgeClass[o.status],
                      )}
                    >
                      {t.statusLabel[o.status]}
                    </span>
                  </div>

                  <p className="text-lg font-semibold tabular-nums">
                    {formatIdr(o.amountIdr)}
                  </p>

                  <dl className="grid gap-1.5 text-sm sm:grid-cols-2">
                    <Baris label={t.colOrder}>
                      <span className="font-mono text-xs select-all">
                        {o.orderCode}
                      </span>
                    </Baris>
                    {/* `wibDateTime`, BUKAN `wibDate`: tanpa jam, dua order di
                        hari yang sama tampil identik — persis skenario
                        bayar-ulang yang membuat halaman ini dibutuhkan. */}
                    <Baris label={t.colCreated}>
                      {wibDateTime(o.createdAt)}
                    </Baris>
                    <Baris label={t.colPaidAt}>
                      {o.paidAt ? wibDateTime(o.paidAt) : t.dash}
                    </Baris>
                    <Baris label={t.colMethod}>
                      {formatPaymentMethod(o.paymentMethod, t.methodLabel) ??
                        t.dash}
                    </Baris>
                    <Baris label={t.colInvitation}>
                      {o.invitationPurged || !o.invitationSlug ? (
                        <span>
                          {o.invitationSlug ? `/${o.invitationSlug}` : t.dash}{" "}
                          <span className="text-muted-foreground text-xs">
                            {t.invitationDeleted}
                          </span>
                        </span>
                      ) : (
                        <Link
                          href={`/dashboard/undangan/${o.invitationId}/edit`}
                          className="underline underline-offset-4"
                        >
                          /{o.invitationSlug}
                        </Link>
                      )}
                    </Baris>
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    {o.status === "paid" ? (
                      <Link
                        href={`/dashboard/pesanan/${o.orderCode}`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        {t.viewReceipt}
                      </Link>
                    ) : null}
                    {o.status === "pending" ? (
                      <Link
                        href={pendingPaymentPath(
                          o.invitationId,
                          o.packageKind,
                          o.purpose,
                        )}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {o.packageKind === "addon_momen"
                          ? t.manageMomen
                          : t.continuePayment}
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {page > 1 || hasNext ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-sm">{t.page(page)}</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={href(page - 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t.prev}
              </Link>
            ) : null}
            {hasNext ? (
              <Link
                href={href(page + 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t.next}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <SupportContact />

      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {copy.dashboard.backToList}
      </Link>
    </div>
  );
}
