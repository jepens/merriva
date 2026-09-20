import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuestPersonalizationProvider } from "@/components/public/guest-personalization";
import {
  PreviewEmbedStyle,
  PreviewFrame,
} from "@/components/preview/preview-frame";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { activationCtaFor } from "@/lib/invitation-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildInvitationData, resolveMusic } from "@/server/invitation-data";
import { getEffectiveLimits } from "@/server/limits";
import { requireUser } from "@/server/guards/auth";
import { settingsSchema } from "@/lib/validation/content";
import { getThemeLoader } from "@/themes/registry";
import { ThemeStyles } from "@/themes/theme-styles";

export const metadata: Metadata = { title: copy.preview.badge };

/**
 * Pratinjau draft (M1.5) — HANYA pemilik (RLS membatasi baris ke pemilik). Merakit
 * `InvitationData` di server lalu merender komponen tema dari registry. Selalu
 * dinamis (memakai cookie auth) → tak ter-cache; draft tampil apa adanya.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { id } = await params;
  const { embed } = await searchParams;
  await requireUser();
  if (!isUuid(id)) notFound();

  const editHref = `/dashboard/undangan/${id}/edit`;

  // Shell: cukup bingkai + iframe. Data undangan dirakit saat request
  // `?embed=1` (isi iframe) → hindari fetch DB ganda. Satu kolom tetap dibaca
  // di sini, `status`: bar pratinjau harus tahu aksi aktivasi mana yang berlaku
  // (baca PK, ringan). Sekalian menutup celah lama — id milik orang lain kini
  // `notFound()`, bukan bingkai kosong yang iframe-nya baru gagal belakangan.
  if (!embed) {
    const supabaseShell = await createSupabaseServerClient();
    const { data: shellInv } = await supabaseShell
      .from("invitations")
      .select("status, purged_at")
      .eq("id", id)
      .maybeSingle();
    if (!shellInv) notFound();
    const cta = activationCtaFor(shellInv.status, shellInv.purged_at);
    return (
      <PreviewFrame
        embedSrc={`/preview/${id}?embed=1`}
        editHref={editHref}
        activate={
          cta
            ? {
                href: `/dashboard/undangan/${id}/aktifkan`,
                label: copy.preview.activateCta[cta],
              }
            : undefined
        }
      />
    );
  }

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
  const songId = settingsSchema.safeParse(inv.settings).data?.songId;
  const music = await resolveMusic(supabase, songId);

  const data = buildInvitationData({
    slug: inv.slug,
    category: inv.category,
    content: inv.content,
    settings: inv.settings,
    eventDate: inv.event_date,
    eventRows: eventRows ?? [],
    mediaRows: mediaRows ?? [],
    watermark: limits.watermark,
    music,
  });

  // Slug ditangkap terpisah agar tetap ter-narrow setelah guard di bawah
  // (`theme` sendiri masih nullable menurut TS).
  const themeSlug = theme?.slug ?? null;
  const loader = themeSlug ? getThemeLoader(themeSlug) : null;

  if (!loader || !themeSlug) {
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

  // `?embed=1` → render tema polos sebagai isi iframe bingkai ponsel.
  const Theme = (await loader()).default;
  return (
    <GuestPersonalizationProvider slug={data.slug}>
      <ThemeStyles slug={themeSlug} />
      <PreviewEmbedStyle />
      <Theme data={data} />
    </GuestPersonalizationProvider>
  );
}
