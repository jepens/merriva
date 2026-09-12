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
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { isUuid } from "@/lib/id";
import { resolveAlbumPhase } from "@/lib/momen/album-phase";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";
import { findPendingMomenOrder } from "@/server/momen/pending-order";

export const metadata: Metadata = { title: copy.momen.manage.title };

const a = copy.momen.activate;

export default async function MomenManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  if (!isUuid(id)) notFound();

  // Kepemilikan via RLS (undangan milik pemanggil saja).
  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, status")
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

  // Add-on hanya untuk undangan aktif.
  if (inv.status !== "active") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <h2 className="text-lg font-medium">{a.needActiveTitle}</h2>
            <p className="text-muted-foreground mx-auto max-w-md text-sm">
              {a.needActiveBody}
            </p>
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
    // → album tier gratis terbentuk, aktivasi berbayar jadi no-op (AUDIT KUA-2),
    // dan pemilik yang baru bayar melihat lagi tombol "Pilih & bayar" (UXA-7).
    const pending = await findPendingMomenOrder(admin, id);
    if (pending) {
      return (
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <h2 className="text-lg font-medium">{a.pendingTitle}</h2>
              <p className="text-muted-foreground mx-auto max-w-md text-sm">
                {a.pendingBody(pending.orderCode)}
              </p>
              <p className="text-muted-foreground mx-auto max-w-md text-xs">
                {a.pendingHint}
              </p>
            </CardContent>
          </Card>
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
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
        <MomenActivatePanel invitationId={id} tiers={tiers} />
        {back}
      </div>
    );
  }

  // Album aktif → manager. Muat semua foto (incl. hidden) untuk moderasi.
  const storage = getStorage();
  const { data: rows } = await admin
    .from("momen_photos")
    .select("id, guest_name, device_id, filter_id, thumb_path, status")
    .eq("album_id", album.id)
    .order("created_at", { ascending: false });
  const list = rows ?? [];

  const photos: MomenPhotoRow[] = list.map((r) => ({
    id: r.id,
    guestName: r.guest_name,
    filterId: r.filter_id,
    thumbUrl: storage.getPublicUrl(r.thumb_path),
    status: r.status === "hidden" ? "hidden" : "visible",
  }));
  const participants = new Set(list.map((r) => r.device_id)).size;
  const hiddenCount = list.filter((r) => r.status === "hidden").length;
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
        photoCount={list.length}
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
      />
    </div>
  );
}
