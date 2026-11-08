import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  SebarUndangan,
  type SebarGuest,
} from "@/components/dashboard/sebar-undangan";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { eventDateLabel } from "@/lib/event-date-label";
import { isUuid } from "@/lib/id";
import { parseContentForRender } from "@/lib/invitation-content";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation/content";
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
  const { data: inv, error: invError } = await supabase
    .from("invitations")
    .select(
      "id, slug, category, content, settings, event_date, share_template, share_template_general",
    )
    .eq("id", id)
    .maybeSingle();
  // Galat baca ≠ "tak ada": jangan tampilkan 404 yang menyesatkan (#45).
  if (invError) throw invError;
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

  // {tanggal}: SATU sumber dengan gambar & deskripsi pratinjau tautan (#119).
  const [eventRes, guestRes, rsvpRes] = await Promise.all([
    supabase
      .from("invitation_events")
      .select("start_at")
      .eq("invitation_id", inv.id)
      .not("start_at", "is", null)
      .order("sort_order", { ascending: true })
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("guests")
      .select(
        "id, name, phone, token, group_label, wa_clicked_at, first_viewed_at",
      )
      .eq("invitation_id", inv.id)
      .order("created_at", { ascending: false })
      .order("name", { ascending: true }),
    // RSVP tertaut tamu → status Hadir/Tidak hadir (DECISIONS #120).
    supabase
      .from("rsvps")
      .select("guest_id, attendance")
      .eq("invitation_id", inv.id)
      .not("guest_id", "is", null),
  ]);
  // Status yang salah lebih buruk daripada halaman galat: daftar "Belum
  // dikirim" yang palsu membuat pemilik mengirim ulang ke tamu yang sama.
  if (eventRes.error) throw eventRes.error;
  if (guestRes.error) throw guestRes.error;
  if (rsvpRes.error) throw rsvpRes.error;

  const tz =
    settingsSchema.safeParse(inv.settings).data?.timezone ?? "Asia/Jakarta";
  const tanggal = eventDateLabel(
    eventRes.data?.start_at ?? null,
    tz,
    inv.event_date,
  );

  const rsvpByGuest = new Map(
    (rsvpRes.data ?? []).map((r) => [r.guest_id, r.attendance]),
  );
  const guests: SebarGuest[] = (guestRes.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    phone: g.phone,
    token: g.token,
    groupLabel: g.group_label,
    sent: g.wa_clicked_at !== null,
    opened: g.first_viewed_at !== null,
    rsvp: rsvpByGuest.get(g.id) ?? null,
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
        tanggal={tanggal}
        templates={{
          personal: inv.share_template,
          general: inv.share_template_general,
        }}
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
