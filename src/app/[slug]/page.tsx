import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ExpiredNotice } from "@/components/public/expired-notice";
import { GuestPersonalizationProvider } from "@/components/public/guest-personalization";
import { MomenFab } from "@/components/public/momen/momen-fab";
import { copy } from "@/lib/copy";
import { eventDateLabel } from "@/lib/event-date-label";
import { parseContentForRender } from "@/lib/invitation-content";
import { isDraftSlug, isPlausibleSlug, isReservedSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dataOrThrow } from "@/lib/supabase/result";
import { settingsSchema } from "@/lib/validation/content";
import { buildInvitationData, resolveMusic } from "@/server/invitation-data";
import { getEffectiveLimits } from "@/server/limits";
import { getThemeLoader } from "@/themes/registry";
import { getThemeOptions } from "@/themes/theme-options-registry";
import { ThemeStyles } from "@/themes/theme-styles";
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
  // (`force-static` + revalidate). Satu kedipan DB saat revalidasi → data null →
  // notFound() → 404 DI-CACHE menggantikan undangan-baik (pola sama: catalog.ts).
  // Melempar = render tak pernah di-cache: pada revalidasi berbasis waktu Next
  // tetap menyajikan versi baik terakhir; sesudah `revalidatePath` (pemilik
  // menyimpan) render blocking yang gagal menjadi halaman 500 sementara
  // (`app/global-error.tsx`) yang pulih pada permintaan berikutnya (#45).
  // notFound() (di pemanggil) hanya untuk data null TANPA error = benar-benar tak ada.
  return dataOrThrow({ data, error }, "invitations");
});

/**
 * Sesi acara undangan, urut `sort_order` lalu jam. `cache()` → generateMetadata
 * (tanggal & tempat untuk `og:description`) dan render berbagi SATU query.
 * Galat dikembalikan apa adanya; pemanggil wajib `dataOrThrow` (#45).
 */
const getEventRows = cache(async (invitationId: string) => {
  const admin = createSupabaseAdminClient();
  return admin
    .from("invitation_events")
    .select("id, name, start_at, end_at, venue_name, address, maps_url")
    .eq("invitation_id", invitationId)
    .order("sort_order", { ascending: true })
    .order("start_at", { ascending: true });
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
  if (!isPlausibleSlug(slug) || isReservedSlug(slug) || isDraftSlug(slug))
    return {};
  const inv = await getInvitationBySlug(slug);
  if (!inv || inv.status !== "active") return {};

  const content = parseContentForRender(inv.content, inv.category);
  const names = coupleNames(content);
  // Non-pernikahan memakai `eventName`, SAMA seperti gambar OG (route
  // `/api/og/[slug]`). Dulu seluruh kategori selain wedding jatuh ke nama
  // brand, dan karena layout menambahkan "· Merriva", judul yang tersebar
  // berbunyi "Merriva · Merriva" — pratinjau WhatsApp sebuah undangan khitanan
  // tak menyebut acaranya sama sekali, padahal GAMBAR OG-nya sudah benar.
  // Itu memukul tepat di fitur Sebar: judul inilah yang dilihat tamu lebih
  // dulu, sebelum gambarnya termuat.
  const title = names
    ? `${names.groom} & ${names.bride} — ${copy.public.cover.weddingKicker}`
    : content.category !== "wedding" && content.eventName
      ? content.eventName
      : copy.brand.name;
  // Deskripsi kartu = FAKTA yang bisa dicek tamu (hari, tanggal, tempat) +
  // ajakan, bukan salam pembuka generik (DECISIONS #119). Tak ada klaim
  // "aman/terverifikasi": isi kartu bisa dipalsukan siapa pun (NDSS 2020).
  const eventRows = dataOrThrow(
    await getEventRows(inv.id),
    "invitation_events",
  );
  const first = (eventRows ?? []).find((e) => e.start_at);
  const tz =
    settingsSchema.safeParse(inv.settings).data?.timezone ?? "Asia/Jakarta";
  const dateLabel = eventDateLabel(first?.start_at ?? null, tz, inv.event_date);
  const venue = first?.venue_name?.trim();
  const lp = copy.public.linkPreview;
  const description = dateLabel
    ? `${dateLabel}${venue && venue.length <= lp.venueMax ? ` · ${venue}` : ""} — ${lp.cta}`
    : content.category === "wedding" && content.greetingOpen
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
      // WAJIB menurut syarat resmi pratinjau WhatsApp (bersama og:title &
      // og:description), dan harus URL kanonik "undecorated" — TANPA `?g=`
      // token tamu walau tautan yang disebar personal (DECISIONS #119).
      // `metadataBase` di layout menjadikannya absolut.
      url: `/${slug}`,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          type: "image/jpeg",
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
  // Slug mustahil (bentuk di luar CHECK DB) → 404 tanpa query (DECISIONS #45).
  if (!isPlausibleSlug(slug) || isReservedSlug(slug) || isDraftSlug(slug))
    notFound();

  const inv = await getInvitationBySlug(slug);
  if (!inv) notFound();
  if (inv.status === "expired") return <ExpiredNotice />;
  if (inv.status !== "active") notFound(); // draft/pending/suspended = tak publik

  const admin = createSupabaseAdminClient();
  const [themeRes, eventsRes, mediaRes, momenRes] = await Promise.all([
    admin.from("themes").select("slug").eq("id", inv.theme_id).maybeSingle(),
    getEventRows(inv.id),
    admin
      .from("media")
      .select("id, storage_path, width, height")
      .eq("invitation_id", inv.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    // Add-on Album Momen aktif → tampilkan tombol masuk melayang (di luar tema).
    admin
      .from("momen_albums")
      .select("id")
      .eq("invitation_id", inv.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  // Setiap bacaan WAJIB berhasil (DECISIONS #45) — prinsip yang sama dengan
  // `getInvitationBySlug` di atas. Dulu galat di sini ditelan: kedipan DB saat
  // revalidasi meng-cache undangan TANPA jadwal/galeri/tombol Momen, atau 404
  // (tema null → notFound), bagi SEMUA tamu sampai simpanan berikutnya. Kini
  // render melempar dan tak pernah di-cache (lihat `getInvitationBySlug`); batas
  // paket & musik (`getEffectiveLimits`, `resolveMusic`) melempar dengan cara sama.
  const theme = dataOrThrow(themeRes, "themes");
  const eventRows = dataOrThrow(eventsRes, "invitation_events");
  const mediaRows = dataOrThrow(mediaRes, "media");
  const momenAlbum = dataOrThrow(momenRes, "momen_albums");

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
    videoAllowed: limits.youtube,
    maxPhotos: limits.maxPhotos,
    // Gerbang Premium kustomisasi saat render (DECISIONS #116) butuh options
    // tema: pasangan font & gaya bawaan adalah index 0 milik tema ini.
    themeOptions: theme?.slug ? getThemeOptions(theme.slug) : null,
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
      <ThemeStyles slug={themeSlug} />
      <Theme data={data} />
      {momenAlbum ? <MomenFab slug={data.slug} /> : null}
    </GuestPersonalizationProvider>
  );
}
