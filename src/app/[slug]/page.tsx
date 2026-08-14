import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ExpiredNotice } from "@/components/public/expired-notice";
import { GuestPersonalizationProvider } from "@/components/public/guest-personalization";
import { copy } from "@/lib/copy";
import { parseContentForRender } from "@/lib/invitation-content";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { settingsSchema } from "@/lib/validation/content";
import { buildInvitationData, resolveMusic } from "@/server/invitation-data";
import { getEffectiveLimits } from "@/server/limits";
import { getThemeLoader } from "@/themes/registry";
import type { InvitationContent } from "@/lib/validation/content";

/**
 * Halaman undangan publik `/{slug}` (M2.1). SSR + **ISR**: di-cache lalu
 * di-revalidate on-demand saat pemilik menyimpan (`revalidatePath('/{slug}')`)
 * + jaring aman waktu 1 jam. Produksi memakai fallback blocking-static-render
 * (tanpa `generateStaticParams`) sehingga slug dinamis tetap ter-cache.
 *
 * Kunci ISR: halaman ini TIDAK membaca cookies/searchParams (keduanya memaksa
 * render dinamis). Personalisasi tamu (`?g=token`) disuntik terpisah di client
 * (M2 berikutnya) agar tak membatalkan cache.
 */
export const revalidate = 3600;
// Supabase memakai fetch tanpa-cache → tanpa ini halaman jadi dinamis (SSR tiap
// hit). `force-static` memaksa keluaran di-cache per-slug (ISR): dirender saat
// hit pertama, disajikan dari cache ke semua tamu, di-revalidate on-demand saat
// pemilik menyimpan. Kami tak memakai cookies/headers/searchParams → aman.
export const dynamic = "force-static";

/**
 * Baca undangan by slug via **service-role** — tabel `invitations` tak punya
 * policy anon (SPEC/DATA-MODEL: "halaman publik dilayani server dengan filter
 * eksplisit"). Hanya kolom **publik-aman**; TIDAK PERNAH menyentuh
 * guests/gift_notes/orders. `cache()` → generateMetadata & render berbagi satu
 * query dalam request yang sama.
 */
const getInvitationBySlug = cache(async (slug: string) => {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("invitations")
    .select(
      "id, slug, category, content, settings, event_date, package_id, theme_id, status, updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();
  // JANGAN menelan error DB jadi `notFound()` yang ter-cache. Halaman ini ISR
  // (`force-static` + revalidate). Satu kedipan DB saat revalidasi latar → data
  // null → notFound() → 404 DI-CACHE menggantikan undangan-baik hingga revalidasi
  // berikutnya (bisa ~1 jam = undangan 404 bagi tamu di hari-H). Melempar membuat
  // Next mempertahankan render statis terakhir yang baik (pola sama: catalog.ts).
  // notFound() (di pemanggil) hanya untuk data null TANPA error = benar-benar tak ada.
  if (error) throw error;
  return data;
});

function coupleNames(content: InvitationContent) {
  if (content.category !== "wedding") return null;
  const c = copy.public.cover;
  return {
    groom: content.groom.nickname || content.groom.name || c.groomFallback,
    bride: content.bride.nickname || content.bride.name || c.brideFallback,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  // Slug tersimpan selalu lowercase → normalkan URL agar `/Budi-Siti` tak 404
  // (kartu cetak / iOS meng-kapital huruf pertama).
  const slug = (await params).slug.toLowerCase();
  if (isReservedSlug(slug) || isDraftSlug(slug)) return {};
  const inv = await getInvitationBySlug(slug);
  if (!inv || inv.status !== "active") return {};

  const content = parseContentForRender(inv.content, inv.category);
  const names = coupleNames(content);
  const title = names
    ? `${names.groom} & ${names.bride} — ${copy.public.cover.weddingKicker}`
    : copy.brand.name;
  const description =
    content.category === "wedding" && content.greetingOpen
      ? content.greetingOpen.slice(0, 160)
      : copy.public.cover.defaultKicker;

  // OG image dinamis (M2.5). URL di-versikan `?v=updated_at` (milidetik → tak ada
  // alias dua simpan dalam detik yang sama) untuk mem-bust cache CDN/browser,
  // sehingga scrape BARU setelah pemilik menyimpan mendapat gambar segar
  // (revalidatePath sudah dipanggil di action simpan → meta memuat `?v` baru).
  // Catatan: ini TIDAK mem-bust pratinjau WhatsApp untuk tautan yang SUDAH
  // tersebar — WA meng-cache per URL halaman (yang tak berubah) tanpa purge
  // publik; keterbatasan WA yang tak bisa dihindari dari sisi kode.
  const version = new Date(inv.updated_at).getTime();
  const ogImage = `/api/og/${slug}?v=${version}`;

  return {
    title,
    description,
    // Undangan privat per tamu → jangan diindeks mesin pencari. (Scraper
    // pratinjau WA/FB tetap boleh mengambil OG image — itu memang diinginkan.)
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicInvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug.toLowerCase();
  if (isReservedSlug(slug) || isDraftSlug(slug)) notFound();

  const inv = await getInvitationBySlug(slug);
  if (!inv) notFound();
  if (inv.status === "expired") return <ExpiredNotice />;
  if (inv.status !== "active") notFound(); // draft/pending/suspended = tak publik

  const admin = createSupabaseAdminClient();
  const [{ data: theme }, { data: eventRows }, { data: mediaRows }] =
    await Promise.all([
      admin.from("themes").select("slug").eq("id", inv.theme_id).maybeSingle(),
      admin
        .from("invitation_events")
        .select("id, name, start_at, end_at, venue_name, address, maps_url")
        .eq("invitation_id", inv.id)
        .order("sort_order", { ascending: true })
        .order("start_at", { ascending: true }),
      admin
        .from("media")
        .select("id, storage_path, width, height")
        .eq("invitation_id", inv.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  const limits = await getEffectiveLimits(admin, inv.package_id);
  const songId = settingsSchema.safeParse(inv.settings).data?.songId;
  const music = await resolveMusic(admin, songId);

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

  const themeSlug = theme?.slug ?? null;
  const loader = themeSlug ? getThemeLoader(themeSlug) : null;
  if (!loader || !themeSlug) notFound();
  const Theme = (await loader()).default;

  // Semua tema memegang cover + musik sendiri (cover-gate); halaman publik hanya
  // menyuntik personalisasi tamu (`?g=`/`?to=`). Cover generik `InvitationShell`
  // dihapus setelah seluruh tema di-port ke cover-gate (DECISIONS #13).
  return (
    <GuestPersonalizationProvider slug={data.slug}>
      <Theme data={data} />
    </GuestPersonalizationProvider>
  );
}
