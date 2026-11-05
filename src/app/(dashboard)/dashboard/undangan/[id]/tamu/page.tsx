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
    .select("id, slug, package_id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const t = copy.dashboard.guests;

  const [{ data: guestRows }, limits, { count: fotoCount }] = await Promise.all(
    [
      supabase
        .from("guests")
        .select(
          "id, name, phone, group_label, pax_allocated, notes, token, wa_clicked_at, first_viewed_at",
        )
        .eq("invitation_id", inv.id)
        .order("created_at", { ascending: false }),
      getEffectiveLimits(supabase, inv.package_id, inv.user_id),
      // Hanya JUMLAHNYA (head) — barisnya tak dipakai di halaman ini, dan route
      // ZIP membacanya sendiri. RLS `media_select` membatasi ke pemilik.
      supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("invitation_id", inv.id)
        .eq("type", "photo"),
    ],
  );
  const foto = fotoCount ?? 0;

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

      {/*
        Kartu unduhan data. Ditaruh DI SINI karena email peringatan pra-purge
        H-30/H-7 mengarahkan pemilik ke halaman ini (`sendPurgeWarning` →
        `/dashboard/undangan/{id}/tamu`) — sebelum ada kartu ini, tautan itu
        mendarat di halaman yang tak punya unduhan foto sama sekali.
        Tautan biasa, bukan `Link`: ini unduhan berkas, bukan navigasi.
      */}
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-medium">{t.dataTitle}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t.dataBody}</p>
        {foto > 0 ? (
          <>
            <a
              href={`/dashboard/undangan/${inv.id}/galeri/zip`}
              className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-3`}
            >
              {t.dataFotoCta(foto)}
            </a>
            <p className="text-muted-foreground mt-2 text-xs">
              {t.dataFotoHint}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">
            {t.dataFotoKosong}
          </p>
        )}
      </div>

      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {copy.dashboard.backToList}
      </Link>
    </div>
  );
}
