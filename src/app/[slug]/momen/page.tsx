import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MomenCamera } from "@/components/public/momen/momen-camera";
import "@/components/public/momen/momen.css";
import { copy } from "@/lib/copy";
import { parseContentForRender } from "@/lib/invitation-content";
import { isDraftSlug, isPlausibleSlug, isReservedSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dataOrThrow } from "@/lib/supabase/result";
import type { InvitationCategory } from "@/types";
import type { Json } from "@/types/database";

/**
 * Halaman KAMERA TAMU Album Momen `/{slug}/momen` (FASE H). Berbeda dari halaman
 * undangan (`/{slug}`, ISR) — halaman ini **dinamis**: status album dibaca per
 * request dan sesi tamu memakai cookie. Tamu anon tak punya RLS → baca lewat
 * service_role dengan filter eksplisit.
 *
 * Halaman ini TIDAK merender foto apa pun (DECISIONS #137): tamu hanya melihat
 * fotonya sendiri, lewat `loadMomenPhotosAction` yang menuntut sesi.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Tanpa "— Merriva": layout akar sudah memakai template "%s · Merriva",
  // jadi menuliskannya lagi di sini menghasilkan "Merriva Momen — Merriva ·
  // Merriva" di tab dan di pratinjau tautan QR meja.
  title: copy.momen.brand,
  robots: { index: false, follow: false },
};

/** Judul hero: nama pasangan (wedding) atau brand. */
function heroTitle(content: Json, category: InvitationCategory): string {
  const parsed = parseContentForRender(content, category);
  if (parsed.category === "wedding") {
    const cc = copy.public.cover;
    const groom =
      parsed.groom.nickname || parsed.groom.name || cc.groomFallback;
    const bride =
      parsed.bride.nickname || parsed.bride.name || cc.brideFallback;
    return `${groom} & ${bride}`;
  }
  return copy.momen.brand;
}

function dateLabelFrom(eventDate: string | null): string | null {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

function Inactive() {
  return (
    <div className="mn-app">
      <div className="mn-inactive">
        <div>
          <div className="mn-emoji">📷</div>
          <h2>{copy.momen.notActive.title}</h2>
          <p>{copy.momen.notActive.body}</p>
        </div>
      </div>
    </div>
  );
}

export default async function MomenGuestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug.toLowerCase();
  if (!isPlausibleSlug(slug) || isReservedSlug(slug) || isDraftSlug(slug))
    notFound();

  const admin = createSupabaseAdminClient();
  // Galat DB DILEMPAR (DECISIONS #45) → halaman "belum bisa dimuat" + tombol
  // coba lagi (`../error.tsx`). Dulu ditelan: tamu di hari-H diberi 404 atau
  // "Album belum aktif" hanya karena kedipan DB, lalu berhenti mencoba.
  const inv = dataOrThrow(
    await admin
      .from("invitations")
      .select("id, category, content, event_date, status")
      .eq("slug", slug)
      .maybeSingle(),
    "invitations",
  );
  if (!inv || inv.status !== "active") notFound();

  const album = dataOrThrow(
    await admin
      .from("momen_albums")
      .select(
        "id, status, quota_per_guest, default_filter, allow_library_upload",
      )
      .eq("invitation_id", inv.id)
      .maybeSingle(),
    "momen_albums",
  );

  // Belum beli/aktivasi add-on → halaman ramah "belum aktif".
  if (!album || album.status !== "active") return <Inactive />;

  return (
    <MomenCamera
      slug={slug}
      albumId={album.id}
      quotaPerGuest={album.quota_per_guest}
      defaultFilter={album.default_filter}
      allowLibraryUpload={album.allow_library_upload}
      heroTitle={heroTitle(inv.content, inv.category)}
      dateLabel={dateLabelFrom(inv.event_date)}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
    />
  );
}
