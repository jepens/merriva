import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuestManager } from "@/components/dashboard/guest-manager";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GuestView } from "@/lib/validation/guest";
import { getEffectiveLimits } from "@/server/limits";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.dashboard.guests.title };

export default async function GuestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  if (!isUuid(id)) notFound();

  const supabase = await createSupabaseServerClient();
  // RLS membatasi ke undangan milik pemilik; baris orang lain → tak ditemukan.
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, package_id")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const t = copy.dashboard.guests;

  const [{ data: guestRows }, limits] = await Promise.all([
    supabase
      .from("guests")
      .select(
        "id, name, phone, group_label, pax_allocated, notes, token, wa_clicked_at, first_viewed_at",
      )
      .eq("invitation_id", inv.id)
      .order("created_at", { ascending: false }),
    getEffectiveLimits(supabase, inv.package_id),
  ]);

  const guests: GuestView[] = (guestRows ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    phone: g.phone,
    groupLabel: g.group_label,
    paxAllocated: g.pax_allocated,
    notes: g.notes,
    token: g.token,
    waClickedAt: g.wa_clicked_at,
    firstViewedAt: g.first_viewed_at,
  }));

  const limitLabel =
    limits.maxGuests === null
      ? t.unlimited
      : `${t.limitOf} ${limits.maxGuests}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/dashboard/undangan/${inv.id}/edit`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {t.back}
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
          <span className="text-muted-foreground text-sm tabular-nums">
            {guests.length} {t.count} {limitLabel}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      <GuestManager
        invitationId={inv.id}
        slug={inv.slug}
        initial={guests}
        maxGuests={limits.maxGuests}
      />

      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {copy.dashboard.backToList}
      </Link>
    </div>
  );
}
