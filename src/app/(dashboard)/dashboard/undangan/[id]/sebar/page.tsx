import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  SebarUndangan,
  type SebarGuest,
} from "@/components/dashboard/sebar-undangan";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { parseContentForRender } from "@/lib/invitation-content";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.dashboard.sebar.title };

export default async function SebarPage({
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
    .select("id, slug, category, content")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const t = copy.dashboard.sebar;

  // Derivasi label {acara} untuk template pesan.
  const content = parseContentForRender(inv.content, inv.category);
  let acara: string = copy.create.category[inv.category];
  if (content.category === "wedding") {
    const groom = content.groom.nickname || content.groom.name;
    const bride = content.bride.nickname || content.bride.name;
    if (groom && bride) acara = `pernikahan ${groom} & ${bride}`;
  }

  const { data: guestRows } = await supabase
    .from("guests")
    .select("id, name, phone, token, wa_clicked_at")
    .eq("invitation_id", inv.id)
    .order("created_at", { ascending: false });

  const guests: SebarGuest[] = (guestRows ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    phone: g.phone,
    token: g.token,
    waClicked: g.wa_clicked_at !== null,
  }));

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
            {guests.length} {t.countUnit}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      <SebarUndangan
        invitationId={inv.id}
        slug={inv.slug}
        acara={acara}
        initial={guests}
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
