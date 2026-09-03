import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  MomenCamera,
  type MomenPhotoView,
} from "@/components/public/momen/momen-camera";
import "@/components/public/momen/momen.css";
import { copy } from "@/lib/copy";
import { parseContentForRender } from "@/lib/invitation-content";
import { resolveAlbumPhase } from "@/lib/momen/album-phase";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvitationCategory } from "@/types";
import type { Json } from "@/types/database";

/**
 * Halaman KAMERA TAMU Album Momen `/{slug}/momen` (FASE H). Berbeda dari halaman
 * undangan (`/{slug}`, ISR) — halaman ini **dinamis**: fase reveal bergantung
 * waktu, sesi tamu memakai cookie, dan foto dimuat saat request. Tamu anon tak
 * punya RLS → seluruh baca lewat service_role dengan filter eksplisit + logika
 * fase (fail-closed: foto hanya dipancarkan saat `revealed`).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${copy.momen.brand} — Merriva`,
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
  if (isReservedSlug(slug) || isDraftSlug(slug)) notFound();

  const admin = createSupabaseAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, category, content, event_date, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!inv || inv.status !== "active") notFound();

  const { data: album } = await admin
    .from("momen_albums")
    .select(
      "id, status, quota_per_guest, default_filter, allow_library_upload, reveal_at",
    )
    .eq("invitation_id", inv.id)
    .maybeSingle();

  // Belum beli/aktivasi add-on → halaman ramah "belum aktif".
  if (!album || album.status !== "active") return <Inactive />;

  // Server Component dinamis (force-dynamic) — waktu per-request memang disengaja
  // (bukan render reaktif klien); aturan purity react-hooks tak berlaku di sini.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const phase = resolveAlbumPhase(nowMs, album.reveal_at);

  // Foto HANYA dipancarkan saat revealed (fail-closed). Pra-reveal: daftar kosong
  // (tamu tak boleh melihat foto orang lain sebelum waktunya).
  let initialPhotos: MomenPhotoView[] = [];
  if (phase === "revealed") {
    const storage = getStorage();
    const { data: rows } = await admin
      .from("momen_photos")
      .select("id, guest_name, filter_id, storage_path, thumb_path")
      .eq("album_id", album.id)
      .eq("status", "visible")
      .order("created_at", { ascending: false });
    initialPhotos = (rows ?? []).map((r) => ({
      id: r.id,
      guestName: r.guest_name,
      filterId: r.filter_id,
      url: storage.getPublicUrl(r.storage_path),
      thumbUrl: storage.getPublicUrl(r.thumb_path),
    }));
  }

  return (
    <MomenCamera
      slug={slug}
      quotaPerGuest={album.quota_per_guest}
      defaultFilter={album.default_filter}
      allowLibraryUpload={album.allow_library_upload}
      revealAtIso={album.reveal_at}
      heroTitle={heroTitle(inv.content, inv.category)}
      dateLabel={dateLabelFrom(inv.event_date)}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
      initialPhotos={initialPhotos}
    />
  );
}
