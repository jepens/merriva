import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  GuestbookModeration,
  type RsvpRow,
} from "@/components/dashboard/guestbook-moderation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatEventDateTime } from "@/lib/datetime";
import { isUuid } from "@/lib/id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation/content";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.dashboard.guestbook.title };

const idr = new Intl.NumberFormat("id-ID");

export default async function GuestbookModerationPage({
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
    .select("id, slug, settings")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const t = copy.dashboard.guestbook;
  const parsedSettings = settingsSchema.safeParse(inv.settings).data;
  const tz = parsedSettings?.timezone ?? "Asia/Jakarta";
  const moderationOn = parsedSettings?.moderateGuestbook ?? false;

  const [{ data: rsvpData }, { data: giftData }] = await Promise.all([
    supabase
      .from("rsvps")
      .select(
        "id, guest_name, attendance, pax, message, is_hidden, is_approved",
      )
      .eq("invitation_id", inv.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("gift_notes")
      .select("id, guest_name, type, amount, note, created_at")
      .eq("invitation_id", inv.id)
      .order("created_at", { ascending: false }),
  ]);

  const rsvps = rsvpData ?? [];
  const gifts = giftData ?? [];

  const rows: RsvpRow[] = rsvps.map((r) => ({
    id: r.id,
    guestName: r.guest_name,
    attendance: r.attendance,
    pax: r.pax,
    message: r.message,
    isHidden: r.is_hidden,
    isApproved: r.is_approved,
  }));

  const attending = rsvps.filter((r) => r.attendance === "yes");
  const stats = [
    { label: t.stats.responses, value: rsvps.length },
    { label: t.stats.attending, value: attending.length },
    {
      label: t.stats.notAttending,
      value: rsvps.length - attending.length,
    },
    { label: t.stats.pax, value: attending.reduce((s, r) => s + r.pax, 0) },
    {
      label: t.stats.messages,
      value: rsvps.filter((r) => (r.message ?? "").trim().length > 0).length,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/dashboard/undangan/${inv.id}/edit`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {t.back}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <li key={s.label}>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                <p className="text-muted-foreground text-xs">{s.label}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <p
        className={
          moderationOn
            ? "rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
            : "text-muted-foreground text-sm"
        }
      >
        {moderationOn ? t.moderationOn : t.moderationOff}
      </p>

      <section className="space-y-3">
        <h2 className="text-base font-medium">{t.rsvpTitle}</h2>
        <GuestbookModeration invitationId={inv.id} initial={rows} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium">{t.giftTitle}</h2>
          <span className="text-muted-foreground text-xs">{t.giftPrivate}</span>
        </div>
        {gifts.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.giftEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {gifts.map((g) => {
              const when = formatEventDateTime(g.created_at, tz);
              return (
                <li key={g.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                      <div className="min-w-0">
                        <p className="font-medium">{g.guest_name}</p>
                        {g.note ? (
                          <p className="text-muted-foreground text-sm whitespace-pre-line">
                            {g.note}
                          </p>
                        ) : null}
                        {when ? (
                          <p className="text-muted-foreground text-xs">
                            {when.date}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
                          {g.type === "transfer" ? t.giftTransfer : t.giftGift}
                        </span>
                        {g.amount != null ? (
                          <p className="mt-1 font-medium tabular-nums">
                            Rp {idr.format(g.amount)}
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {copy.dashboard.backToList}
      </Link>
    </div>
  );
}
