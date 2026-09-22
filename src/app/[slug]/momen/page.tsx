import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  MomenCamera,
  type MomenPhotoView,
} from "@/components/public/momen/momen-camera";
import "@/components/public/momen/momen.css";
import { copy } from "@/lib/copy";
import { parseContentForRender } from "@/lib/invitation-content";
import { canGuestViewPhotos, resolveAlbumPhase } from "@/lib/momen/album-phase";
import { isDraftSlug, isPlausibleSlug, isReservedSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dataOrThrow } from "@/lib/supabase/result";
import { fetchMomenAlbumStats, fetchMomenPhotos } from "@/server/momen/photos";
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
        "id, status, quota_per_guest, default_filter, allow_library_upload, reveal_at",
      )
      .eq("invitation_id", inv.id)
      .maybeSingle(),
    "momen_albums",
  );

  // Belum beli/aktivasi add-on → halaman ramah "belum aktif".
  if (!album || album.status !== "active") return <Inactive />;

  // Server Component dinamis (force-dynamic) — waktu per-request memang disengaja
  // (bukan render reaktif klien); aturan purity react-hooks tak berlaku di sini.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const phase = resolveAlbumPhase(nowMs, album.reveal_at);

  // Foto HANYA dipancarkan saat revealed (fail-closed). Pra-reveal: daftar kosong
  // (tamu tak boleh melihat foto orang lain sebelum waktunya).
  //
  // HALAMAN PERTAMA SAJA (PER-4): route ini `force-dynamic` — tak pernah
  // ter-cache — jadi album besar dulu ditarik utuh pada SETIAP pembukaan oleh
  // SETIAP tamu. Sisanya dimuat via `loadMomenPhotosAction` saat diminta.
  let initialPhotos: MomenPhotoView[] = [];
  let initialCursor: string | null = null;
  let totalPhotos = 0;
  let photographers = 0;
  if (canGuestViewPhotos(phase)) {
    const [page, stats] = await Promise.all([
      fetchMomenPhotos(admin, album.id),
      // Angka ringkasan dari agregat DB, BUKAN dari daftar yang termuat —
      // dengan paginasi, `photos.length` bukan lagi jumlah foto album.
      fetchMomenAlbumStats(admin, album.id),
    ]);
    initialPhotos = page.photos.map((r) => ({
      id: r.id,
      guestName: r.guestName,
      filterId: r.filterId,
      url: r.url,
      thumbUrl: r.thumbUrl,
    }));
    initialCursor = page.nextCursor;
    totalPhotos = stats.visibleCount;
    photographers = stats.photographerCount;
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
      initialCursor={initialCursor}
      totalPhotos={totalPhotos}
      photographers={photographers}
    />
  );
}
