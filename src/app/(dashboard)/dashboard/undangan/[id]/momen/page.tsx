import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  MomenActivatePanel,
  type MomenTier,
} from "@/components/dashboard/momen/momen-activate-panel";
import {
  MomenManager,
  type MomenPhotoRow,
} from "@/components/dashboard/momen/momen-manager";
import { MomenPaymentPoller } from "@/components/dashboard/momen/momen-payment-poller";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { isUuid } from "@/lib/id";
import { resolveAlbumPhase } from "@/lib/momen/album-phase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPaymentExempt, requireUser } from "@/server/guards/auth";
import { findLatestMomenOrder } from "@/server/momen/orders";
import {
  fetchMomenAlbumStats,
  fetchMomenPhotos,
  MOMEN_PAGE_SIZE,
} from "@/server/momen/photos";

export const metadata: Metadata = { title: copy.momen.manage.title };

const a = copy.momen.activate;

/** Plafon keras satu render halaman moderasi (rem terhadap album raksasa). */
const PHOTO_LIMIT_MAX = 400;

export default async function MomenManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ foto?: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!isUuid(id)) notFound();

  // Kepemilikan via RLS (undangan milik pemanggil saja — kecuali admin).
  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, status, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const back = (
    <Link
      href="/dashboard"
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      {a.back}
    </Link>
  );

  // Add-on hanya bisa DIKELOLA saat undangan aktif — tetapi bila albumnya sudah
  // ada, fotonya harus tetap bisa DIUNDUH. Lihat catatan `archivedTitle` di
  // copy.ts: foto Album Momen tak bisa dibuat ulang, dan retensi akan
  // menghapusnya.
  if (inv.status !== "active") {
    const admin = createSupabaseAdminClient();
    const { data: arsip } = await admin
      .from("momen_albums")
      .select("id, photo_count")
      .eq("invitation_id", id)
      .maybeSingle();
    const adaFoto = (arsip?.photo_count ?? 0) > 0;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <h2 className="text-lg font-medium">
              {adaFoto ? a.archivedTitle : a.needActiveTitle}
            </h2>
            <p className="text-muted-foreground mx-auto max-w-md text-sm">
              {adaFoto ? a.archivedBody : a.needActiveBody}
            </p>
            {adaFoto ? (
              // Tautan biasa, bukan Link: ini unduhan berkas, bukan navigasi.
              // Route ZIP memeriksa kepemilikan sendiri dan TIDAK memeriksa
              // status undangan — jadi tautan ini sah justru di keadaan ini.
              <a
                href={`/dashboard/undangan/${id}/momen/zip`}
                className={buttonVariants()}
              >
                {a.archivedCta}
              </a>
            ) : null}
          </CardContent>
        </Card>
        {back}
      </div>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: album } = await admin
    .from("momen_albums")
    .select(
      "id, quota_peserta, quota_per_guest, reveal_at, default_filter, allow_library_upload, photo_count",
    )
    .eq("invitation_id", id)
    .maybeSingle();

  const guestUrl = `${appUrl}/${inv.slug}/momen`;

  // Belum ada album → panel aktivasi (gratis + berbayar).
  if (!album) {
    // …KECUALI masih ada order add-on yang belum lunas. Menampilkan panel harga
    // di sini pernah membuat pemilik menekan "Aktifkan gratis" setelah membayar
    // → album tier gratis terbentuk, aktivasi berbayar jadi no-op (AUDIT KUA-2a),
    // dan pemilik yang baru bayar melihat lagi tombol "Pilih & bayar" (UXA-7).
    //
    // Poller-nya sekaligus menjadi jalur aktivasi OTORITATIF KEDUA (KUA-2b):
    // tanpa itu order add-on hanya bisa diaktifkan webhook Pakasir (tanpa
    // signature, bisa hilang) dengan backstop cron 24 jam.
    const order = await findLatestMomenOrder(admin, id);
    if (order && order.status === "pending") {
      return (
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
          <MomenPaymentPoller
            invitationId={id}
            orderCode={order.orderCode}
            amountIdr={order.amountIdr}
            packageName={order.packageName}
          />
          {back}
        </div>
      );
    }

    const { data: pkgs } = await admin
      .from("packages")
      .select("code, price_idr, limits")
      .eq("is_active", true)
      .eq("kind", "addon_momen")
      .order("price_idr", { ascending: true });
    const tiers: MomenTier[] = (pkgs ?? []).map((p) => {
      const limits = (p.limits ?? {}) as { quota_peserta?: number | null };
      return {
        code: p.code,
        priceIdr: p.price_idr,
        quotaPeserta:
          typeof limits.quota_peserta === "number"
            ? limits.quota_peserta
            : null,
      };
    });
    // Admin & Pro tak pernah ditagih (DECISIONS #100) — hanya undangan MILIK
    // sendiri; langsung tier teratas (urutan harga naik → yang terakhir).
    const free =
      inv.user_id === user.id && (await isPaymentExempt(supabase, user.id));
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
        <MomenActivatePanel
          invitationId={id}
          tiers={free ? tiers.slice(-1) : tiers}
          free={free}
        />
        {back}
      </div>
    );
  }

  // Album aktif → manager. Foto (incl. hidden) untuk moderasi, DIBATASI: album
  // besar dulu ditarik utuh di setiap render (AUDIT PER-4). "Muat lebih" lewat
  // `?foto=N` — tetap server-rendered, tanpa state klien tambahan.
  const requested = Number((await searchParams).foto);
  const photoLimit = Math.min(
    Math.max(
      Number.isFinite(requested) ? requested : MOMEN_PAGE_SIZE,
      MOMEN_PAGE_SIZE,
    ),
    PHOTO_LIMIT_MAX,
  );
  const [page, stats] = await Promise.all([
    fetchMomenPhotos(admin, album.id, {
      includeHidden: true,
      limit: photoLimit,
    }),
    // Angka kartu statistik dari agregat DB — bukan dari daftar yang termuat.
    fetchMomenAlbumStats(admin, album.id),
  ]);

  const photos: MomenPhotoRow[] = page.photos.map((r) => ({
    id: r.id,
    guestName: r.guestName,
    filterId: r.filterId,
    thumbUrl: r.thumbUrl,
    status: r.status,
    purged: r.purged,
  }));
  const participants = stats.participantCount;
  const hiddenCount = stats.hiddenCount;
  const totalPhotos = stats.visibleCount + stats.hiddenCount;
  // Server Component dinamis (dashboard = SSR ter-auth) — waktu per-request
  // disengaja; aturan purity react-hooks tak berlaku di sini.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const revealed = resolveAlbumPhase(nowMs, album.reveal_at) === "revealed";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.momen.manage.title}
        </h1>
        {back}
      </div>
      <MomenManager
        invitationId={id}
        guestUrl={guestUrl}
        quotaPeserta={album.quota_peserta}
        photoCount={totalPhotos}
        participants={participants}
        hiddenCount={hiddenCount}
        revealed={revealed}
        settings={{
          quotaPerGuest: album.quota_per_guest,
          revealAt: album.reveal_at,
          defaultFilter: album.default_filter,
          allowLibraryUpload: album.allow_library_upload,
        }}
        photos={photos}
        moreHref={
          page.nextCursor
            ? `/dashboard/undangan/${id}/momen?foto=${Math.min(photoLimit + MOMEN_PAGE_SIZE, PHOTO_LIMIT_MAX)}`
            : null
        }
      />
    </div>
  );
}
