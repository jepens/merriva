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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dataOrThrow } from "@/lib/supabase/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildInvitationData,
  liveCustomMusicPaths,
  resolveMusic,
} from "@/server/invitation-data";
import { getEffectiveLimits } from "@/server/limits";
import { requireUser } from "@/server/guards/auth";
import { THEME_SLUG_RE, settingsTanpaKustom } from "@/lib/theme-switch";
import { settingsSchema } from "@/lib/validation/content";
import { getThemeLoader } from "@/themes/registry";
import { getThemeOptions } from "@/themes/theme-options-registry";
import { ThemeStyles } from "@/themes/theme-styles";

export const metadata: Metadata = { title: copy.preview.badge };

/**
 * Tema kandidat `?tema=` (SPEC §4.4 "Ganti tema"): hanya tema AKTIF, sekategori,
 * dan kodenya terpasang — selain itu `null` dan pratinjau memakai tema
 * sekarang. Tak menulis apa pun.
 */
async function temaKandidat(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  raw: unknown,
  category: string,
): Promise<{ slug: string; name: string } | null> {
  if (typeof raw !== "string" || !THEME_SLUG_RE.test(raw)) return null;
  const row = dataOrThrow(
    await supabase
      .from("themes")
      .select("slug, name, categories, is_active")
      .eq("slug", raw)
      .maybeSingle(),
    "themes (pratinjau ganti tema)",
  );
  if (
    !row ||
    !row.is_active ||
    !(row.categories as string[]).includes(category) ||
    !getThemeLoader(row.slug)
  ) {
    return null;
  }
  return { slug: row.slug, name: row.name };
}

/**
 * Pratinjau draft (M1.5) — HANYA pemilik (RLS membatasi baris ke pemilik). Merakit
 * `InvitationData` di server lalu merender komponen tema dari registry. Selalu
 * dinamis (memakai cookie auth) → tak ter-cache; draft tampil apa adanya.
 * `?tema={slug}` = undangan pemilik dalam tema KANDIDAT dengan kustomisasi
 * bawaan tema itu — persis hasil "Pakai Tema Ini" (SPEC §4.4), tanpa menyimpan.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string; tema?: string }>;
}) {
  const { id } = await params;
  const { embed, tema } = await searchParams;
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
    // Galat DB DILEMPAR, bukan 404 (DECISIONS #45): pemilik tak boleh diberi
    // tahu undangannya "tak ada" hanya karena kedipan DB.
    const shellInv = dataOrThrow(
      await supabaseShell
        .from("invitations")
        .select("status, purged_at, category")
        .eq("id", id)
        .maybeSingle(),
      "invitations (bingkai)",
    );
    if (!shellInv) notFound();
    const kandidat = await temaKandidat(supabaseShell, tema, shellInv.category);
    // Pratinjau ganti tema: kembali ke pemilih tema, catatan "belum disimpan"
    // terbaca juga di ponsel, tanpa ajakan aktivasi (fokus pada memilih).
    if (kandidat) {
      return (
        <PreviewFrame
          embedSrc={`/preview/${id}?embed=1&tema=${kandidat.slug}`}
          editHref={`/dashboard/undangan/${id}/tema`}
          backLabel={copy.preview.backToThemes}
          note={copy.preview.themeTrialNote(kandidat.name)}
        />
      );
    }
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
  const inv = dataOrThrow(
    await supabase
      .from("invitations")
      .select(
        "id, slug, category, content, settings, event_date, package_id, theme_id, user_id, music_locked_at",
      )
      .eq("id", id)
      .maybeSingle(),
    "invitations",
  );
  if (!inv) notFound();

  const [themeRes, eventsRes, mediaRes] = await Promise.all([
    supabase.from("themes").select("slug").eq("id", inv.theme_id).maybeSingle(),
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
  // Setiap bacaan WAJIB berhasil (DECISIONS #45): pratinjau tanpa jadwal/galeri
  // karena kedipan DB membuat pemilik mengira isiannya hilang — lalu mengetik
  // ulang, atau lebih buruk, membayar undangan yang dikiranya kosong.
  const currentTheme = dataOrThrow(themeRes, "themes");
  const eventRows = dataOrThrow(eventsRes, "invitation_events");
  const mediaRows = dataOrThrow(mediaRes, "media");
  // `?tema=` sah → render tema kandidat dengan `settings` TANPA kustomisasi
  // tema lama (persis yang ditulis aksi ganti tema); selain itu tema sekarang.
  const kandidat = await temaKandidat(supabase, tema, inv.category);
  const theme = kandidat ? { slug: kandidat.slug } : currentTheme;
  const renderSettings = kandidat
    ? settingsTanpaKustom(inv.settings)
    : inv.settings;

  // Batas paket efektif (satu sumber kebenaran) → watermark & video. Draft →
  // Basic.
  const limits = await getEffectiveLimits(
    supabase,
    inv.package_id,
    inv.user_id,
  );
  const songId = settingsSchema.safeParse(inv.settings).data?.songId;
  const [music, liveMusicPaths] = await Promise.all([
    resolveMusic(supabase, songId),
    // `music_uploads` hanya service_role (RLS menyembunyikannya dari client
    // pemilik). Aman: `inv` di atas dibaca lewat client PEMILIK — baris ini
    // hanya ada bila RLS mengizinkan pengguna sesi membuka undangan ini — dan
    // yang dibaca hanya path objek undangan itu (DECISIONS #121).
    liveCustomMusicPaths(createSupabaseAdminClient(), inv.id),
  ]);

  const data = buildInvitationData({
    invitationId: inv.id,
    slug: inv.slug,
    category: inv.category,
    content: inv.content,
    settings: renderSettings,
    eventDate: inv.event_date,
    eventRows: eventRows ?? [],
    mediaRows: mediaRows ?? [],
    watermark: limits.watermark,
    videoAllowed: limits.youtube,
    maxPhotos: limits.maxPhotos,
    // Gerbang Premium kustomisasi saat render (DECISIONS #116) butuh options
    // tema: pasangan font & gaya bawaan adalah index 0 milik tema ini.
    themeOptions: theme?.slug ? getThemeOptions(theme.slug) : null,
    music,
    // Pratinjau = yang dilihat tamu: musik yang dikunci admin juga tak diputar
    // di sini (editor menjelaskan sebabnya).
    musicLocked: inv.music_locked_at !== null,
    liveMusicPaths,
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
