import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import "@/components/dashboard/receipt.css";
import { PrintButton } from "@/components/print-button";
import { SupportContact } from "@/components/support-contact";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { wibDateTime } from "@/lib/admin/display";
import { copy } from "@/lib/copy";
import { formatIdr, formatPaymentMethod } from "@/lib/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dataOrThrow } from "@/lib/supabase/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { orderCodeSchema } from "@/lib/validation/order";
import { requireUser } from "@/server/guards/auth";
import {
  attachRefs,
  fetchOwnOrderByCode,
  orderKindLabel,
} from "@/server/orders/history";
import type { Database } from "@/types/database";

const t = copy.dashboard.orders;

type OrderStatus = Database["public"]["Enums"]["order_status"];

const statusBadgeClass: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  expired: "bg-muted text-muted-foreground",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-sky-100 text-sky-800",
};

/** Kode dari URL → bentuk kanonik. Pelanggan kerap menyalinnya berikut spasi. */
function normalkan(kode: string): string {
  return decodeURIComponent(kode).trim().toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kode: string }>;
}): Promise<Metadata> {
  const { kode } = await params;
  const parsed = orderCodeSchema.safeParse(normalkan(kode));
  return {
    title: parsed.success ? t.receiptMetaTitle(parsed.data) : t.receiptTitle,
  };
}

function Baris({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    // `flex-wrap`: nilai panjang turun baris di layar 360px, bukan memaksa
    // scroll horizontal pada dokumen yang justru dibaca dari HP.
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ kode: string }>;
}) {
  const { kode } = await params;
  const parsed = orderCodeSchema.safeParse(normalkan(kode));
  if (!parsed.success) notFound();

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  // Order milik orang lain jatuh ke cabang yang SAMA dengan kode yang tak ada:
  // tak ada beda perilaku yang bisa dipakai menebak kode pelanggan lain.
  const record = await fetchOwnOrderByCode(supabase, user.id, parsed.data);
  if (!record) notFound();

  const admin = createSupabaseAdminClient();
  const [view] = await attachRefs(supabase, admin, user.id, [record]);
  // Pada DOKUMEN bukti pembayaran, nama pembeli yang berubah jadi "—" karena
  // DB berkedip lebih buruk daripada halaman yang jujur gagal.
  const profile = dataOrThrow(
    await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    "profiles (kuitansi)",
  );

  const isPaid = view.status === "paid";
  const isInvitation = view.packageKind === "invitation";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="mrv-receipt-noprint space-y-1">
        <Link
          href="/dashboard/pesanan"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {t.back}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          {t.receiptTitle}
        </h1>
        <p className="text-muted-foreground text-sm">{t.receiptSubtitle}</p>
      </div>

      {!isPaid ? (
        <Alert className="mrv-receipt-noprint">
          <AlertTitle>{t.statusLabel[view.status]}</AlertTitle>
          <AlertDescription>{t.receiptUnpaidNotice}</AlertDescription>
        </Alert>
      ) : null}

      <article className="mrv-receipt bg-card rounded-xl border p-6 shadow-sm">
        <p className="text-muted-foreground text-xs tracking-widest uppercase">
          {copy.brand.name}
        </p>
        <h2 className="text-lg font-semibold">{t.receiptDocTitle}</h2>

        <dl className="mt-4 divide-y">
          {/* Penerbit SELALU tercetak: dokumen bukti tak boleh beredar tanpa
              pihak yang bisa dihubungi bila pelanggan menyengketakannya. */}
          <Baris label={t.issuedBy}>
            {copy.brand.name}{" "}
            <span className="text-muted-foreground font-normal">
              · {copy.support.email}
            </span>
          </Baris>
          <Baris label={t.receiptNumber}>
            <span className="font-mono select-all">{view.orderCode}</span>
          </Baris>
          <Baris label={t.colStatus}>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                statusBadgeClass[view.status],
              )}
            >
              {t.statusLabel[view.status]}
            </span>
          </Baris>
          <Baris label={t.colPackage}>
            {view.packageName ?? t.packageUnknown}
          </Baris>
          <Baris label={t.colKind}>{orderKindLabel(view.packageKind, t)}</Baris>
          {isInvitation && view.packageDurationMonths !== null ? (
            <Baris label={t.colDuration}>
              {t.durationMonths(view.packageDurationMonths)}
            </Baris>
          ) : null}
          <Baris label={t.colAmount}>
            <span className="tabular-nums">{formatIdr(view.amountIdr)}</span>
          </Baris>
          <Baris label={t.colMethod}>
            {formatPaymentMethod(view.paymentMethod, t.methodLabel) ?? t.dash}
          </Baris>
          <Baris label={t.colCreated}>{wibDateTime(view.createdAt)}</Baris>
          <Baris label={t.colPaidAt}>
            {view.paidAt ? wibDateTime(view.paidAt) : t.dash}
          </Baris>
          <Baris label={t.colInvitation}>
            {/* Label WAJIB slug: pada baris yang sudah dipurge, `content`
                sudah di-scrub jadi `{}` sehingga nama mempelai tak ada lagi. */}
            {view.invitationSlug ? `/${view.invitationSlug}` : t.dash}
            {view.invitationPurged ? (
              <span className="text-muted-foreground ml-2 text-xs font-normal">
                {t.invitationDeleted}
              </span>
            ) : null}
          </Baris>
          {isInvitation && view.invitationActiveUntil ? (
            <Baris label={t.colActiveUntil}>
              {wibDateTime(view.invitationActiveUntil)}
            </Baris>
          ) : null}
          <Baris label={t.colBuyer}>
            {profile?.full_name ?? t.dash}{" "}
            <span className="text-muted-foreground text-xs font-normal">
              {user.email}
            </span>
          </Baris>
        </dl>

        <p className="text-muted-foreground mt-4 text-xs">
          {isPaid ? t.receiptValidityNote : t.receiptUnpaidNotice}
        </p>
      </article>

      <div className="mrv-receipt-noprint flex flex-wrap gap-2">
        <PrintButton label={t.print} />
        {view.status === "pending" ? (
          <Link
            href={`/dashboard/undangan/${view.invitationId}/bayar`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t.continuePayment}
          </Link>
        ) : null}
        {view.packageKind === "addon_momen" ? (
          <Link
            href={`/dashboard/undangan/${view.invitationId}/momen`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t.manageMomen}
          </Link>
        ) : view.invitationStatus === "active" &&
          !view.invitationPurged &&
          view.invitationSlug ? (
          <a
            href={`/${view.invitationSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t.openInvitation}
          </a>
        ) : null}
      </div>

      <p className="text-muted-foreground mrv-receipt-noprint text-xs">
        {t.refundHint}{" "}
        <Link href="/refund" className="underline underline-offset-4">
          {t.refundLink}
        </Link>
        .
      </p>

      <div className="mrv-receipt-noprint">
        <SupportContact orderCode={view.orderCode} />
      </div>
    </div>
  );
}
