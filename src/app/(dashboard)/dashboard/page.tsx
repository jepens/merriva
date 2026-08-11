import type { Metadata } from "next";
import Link from "next/link";

import { DeleteInvitationButton } from "@/components/dashboard/delete-invitation-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: "Undangan Saya" };

type InvitationStatus = Database["public"]["Enums"]["invitation_status"];

const statusBadgeClass: Record<InvitationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_payment: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  expired: "bg-red-100 text-red-800",
  suspended: "bg-red-100 text-red-800",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  // `purged_at` tak null = kerangka pasca-retensi (data pribadi sudah dihapus) →
  // sembunyikan dari daftar pemilik (baris tetap ada untuk statistik & orders).
  const { data } = await supabase
    .from("invitations")
    .select("id, slug, category, status, event_date")
    .eq("user_id", user.id)
    .is("purged_at", null)
    .order("created_at", { ascending: false });

  const invitations = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.dashboard.invitationsTitle}
        </h1>
        {invitations.length > 0 ? (
          <Link
            href="/dashboard/undangan/baru"
            className={buttonVariants({ size: "sm" })}
          >
            {copy.dashboard.createCta}
          </Link>
        ) : null}
      </div>

      {invitations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <h2 className="text-lg font-medium">{copy.dashboard.emptyTitle}</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              {copy.dashboard.emptyBody}
            </p>
            <Link
              href="/dashboard/undangan/baru"
              className={cn(buttonVariants(), "mt-2")}
            >
              {copy.dashboard.createCta}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {invitations.map((inv) => (
            <li key={inv.id}>
              <Card>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">/{inv.slug}</p>
                      <p className="text-muted-foreground text-xs">
                        {inv.event_date ?? "Tanggal belum diatur"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                        statusBadgeClass[inv.status],
                      )}
                    >
                      {copy.dashboard.status[inv.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inv.status === "draft" ||
                    inv.status === "pending_payment" ||
                    inv.status === "expired" ? (
                      <Link
                        href={`/dashboard/undangan/${inv.id}/aktifkan`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        {inv.status === "draft"
                          ? copy.dashboard.cardActivate
                          : inv.status === "pending_payment"
                            ? copy.dashboard.cardPay
                            : copy.dashboard.cardRenew}
                      </Link>
                    ) : null}
                    <Link
                      href={`/dashboard/undangan/${inv.id}/edit`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {copy.dashboard.cardEdit}
                    </Link>
                    <Link
                      href={`/dashboard/undangan/${inv.id}/tamu`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {copy.dashboard.cardGuests}
                    </Link>
                    {inv.status === "active" ? (
                      <Link
                        href={`/dashboard/undangan/${inv.id}/sebar`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {copy.dashboard.cardShare}
                      </Link>
                    ) : null}
                    {inv.status === "active" || inv.status === "expired" ? (
                      <Link
                        href={`/dashboard/undangan/${inv.id}/ucapan`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {copy.dashboard.cardGuestbook}
                      </Link>
                    ) : null}
                    {inv.status === "draft" || inv.status === "expired" ? (
                      <DeleteInvitationButton invitationId={inv.id} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
