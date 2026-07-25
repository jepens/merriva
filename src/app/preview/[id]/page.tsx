import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PreviewBanner } from "@/components/preview/preview-banner";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildInvitationData } from "@/server/invitation-data";
import { getEffectiveLimits } from "@/server/limits";
import { requireUser } from "@/server/guards/auth";
import { getThemeLoader } from "@/themes/registry";

export const metadata: Metadata = { title: copy.preview.badge };

/**
 * Pratinjau draft (M1.5) — HANYA pemilik (RLS membatasi baris ke pemilik). Merakit
 * `InvitationData` di server lalu merender komponen tema dari registry. Selalu
 * dinamis (memakai cookie auth) → tak ter-cache; draft tampil apa adanya.
 */
export default async function PreviewPage({
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
    .select(
      "id, slug, category, content, settings, event_date, package_id, theme_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const [{ data: theme }, { data: eventRows }, { data: mediaRows }] =
    await Promise.all([
      supabase
        .from("themes")
        .select("slug")
        .eq("id", inv.theme_id)
        .maybeSingle(),
      supabase
        .from("invitation_events")
        .select("id, name, start_at, end_at, venue_name, address, maps_url")
        .eq("invitation_id", inv.id)
        .order("sort_order", { ascending: true })
        .order("start_at", { ascending: true }),
      supabase
        .from("media")
        .select("id, storage_path, width, height")
        .eq("invitation_id", inv.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  // Batas paket efektif (satu sumber kebenaran) → watermark. Draft → Basic.
  const limits = await getEffectiveLimits(supabase, inv.package_id);

  const data = buildInvitationData({
    slug: inv.slug,
    category: inv.category,
    content: inv.content,
    settings: inv.settings,
    eventDate: inv.event_date,
    eventRows: eventRows ?? [],
    mediaRows: mediaRows ?? [],
    watermark: limits.watermark,
  });

  const editHref = `/dashboard/undangan/${inv.id}/edit`;
  const loader = theme?.slug ? getThemeLoader(theme.slug) : null;

  if (!loader) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {copy.preview.themeUnavailable}
        </p>
        <Link
          href={editHref}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {copy.preview.backToEditor}
        </Link>
      </div>
    );
  }

  const Theme = (await loader()).default;
  return (
    <>
      <PreviewBanner editHref={editHref} />
      <Theme data={data} />
    </>
  );
}
