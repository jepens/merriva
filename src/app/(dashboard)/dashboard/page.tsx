import type { Metadata } from "next";
import Link from "next/link";

import { DeleteInvitationButton } from "@/components/dashboard/delete-invitation-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { utcToLocal } from "@/lib/datetime";
import { settingsSchema } from "@/lib/validation/content";
import { cn } from "@/lib/utils";
import { dataOrThrow } from "@/lib/supabase/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: "Undangan Saya" };

type InvitationStatus = Database["public"]["Enums"]["invitation_status"];

const statusBadgeClass: Record<InvitationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_payment: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  expired: "bg-red-100 text-red-800",
  suspended: "bg-red-100 text-red-800",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  // `purged_at` tak null = kerangka pasca-retensi (data pribadi sudah dihapus) →
  // sembunyikan dari daftar pemilik (baris tetap ada untuk statistik & orders).
  // `dataOrThrow`, bukan `data ?? []`: "Belum ada undangan" saat DB berkedip
  // adalah kebohongan yang paling meyakinkan di produk ini — pemilik yang punya
  // undangan aktif mengira karyanya hilang (AUDIT-2026-10-01). Galatnya mendarat
  // di `(dashboard)/dashboard/error.tsx`.
  const invitations =
    dataOrThrow(
      await supabase
        .from("invitations")
        .select("id, slug, category, status, event_date, settings, package_id")
        .eq("user_id", user.id)
        .is("purged_at", null)
        .order("created_at", { ascending: false }),
      "invitations (daftar dashboard)",
    ) ?? [];

  /**
   * Tanggal cadangan dari SESI JADWAL, bila `event_date` kosong.
   *
   * Gerbang aktivasi hanya menuntut satu sesi jadwal yang lengkap — bukan
   * `event_date` — jadi undangan bisa AKTIF dan benar di mana-mana (halaman
   * tamu, gambar OG, berkas kalender semuanya menurunkan tanggal dari sesi)
   * sementara kartu di sini satu-satunya yang berkata "Tanggal belum diatur".
   * Pemiliknya lalu mencari-cari isian yang sebenarnya tak pernah wajib.
   *
   * `data ?? []`, BUKAN `dataOrThrow`: kehilangan label tanggal jauh lebih
   * murah daripada memerahkan seluruh dashboard (alasan yang sama dengan
   * katalog harga di bawah).
   */
  const { data: sesiRows } = await supabase
    .from("invitation_events")
    .select("invitation_id, start_at")
    .in(
      "invitation_id",
      invitations.map((i) => i.id),
    )
    // Sesi tanpa jam DISARING, lalu diurutkan `sort_order` dulu: tanpa itu sesi
    // draf tanpa jam di urutan pertama menutupi sesi berjam sesudahnya
    // (DECISIONS #42).
    .not("start_at", "is", null)
    .order("sort_order", { ascending: true })
    .order("start_at", { ascending: true });

  /** invitation_id → `YYYY-MM-DD` sesi paling awal, di zona undangan itu. */
  const tanggalSesi = new Map<string, string>();
  const zonaById = new Map(
    invitations.map((i) => [
      i.id,
      settingsSchema.safeParse(i.settings).data?.timezone ?? "Asia/Jakarta",
    ]),
  );
  for (const s of sesiRows ?? []) {
    if (tanggalSesi.has(s.invitation_id) || !s.start_at) continue;
    // `.slice(0, 10)` dari bentuk `YYYY-MM-DDTHH:mm` → sama persis dengan
    // bentuk `event_date`, jadi kedua sumber tampil seragam.
    const lokal = utcToLocal(
      s.start_at,
      zonaById.get(s.invitation_id) ?? "Asia/Jakarta",
    );
    if (lokal) tanggalSesi.set(s.invitation_id, lokal.slice(0, 10));
  }

  // Harga paket undangan — untuk memutuskan apakah tombol "Upgrade paket"
  // masuk akal (ada paket aktif yang lebih mahal dari paket undangan ini).
  //
  // `data ?? []`, BUKAN `dataOrThrow`: di sini arah fail-safe-nya berlawanan
  // dengan daftar undangan. Kehilangan satu tombol pintasan tak membohongi
  // siapa pun — halaman `/upgrade` tetap bekerja lewat tautan langsung — jadi
  // memerahkan seluruh dashboard karena katalog harga tak terbaca jauh lebih
  // mahal daripada menyembunyikan tombolnya (bandingkan DECISIONS #45/#46).
  const { data: pkgRows } = await supabase
    .from("packages")
    .select("id, price_idr")
    .eq("is_active", true)
    .eq("kind", "invitation");
  const priceById = new Map((pkgRows ?? []).map((p) => [p.id, p.price_idr]));
  const topPrice = Math.max(0, ...(pkgRows ?? []).map((p) => p.price_idr));
  /**
   * Paket undangan ini masih bisa dinaikkan? Paket yang tak terbaca (mis.
   * dinonaktifkan pemilik toko) dianggap TAK bisa — menawarkan upgrade yang
   * selisihnya tak bisa dihitung lebih buruk daripada tak menawarkannya.
   */
  const bisaUpgrade = (status: string, packageId: string | null) =>
    status === "active" &&
    packageId !== null &&
    (priceById.get(packageId) ?? Number.POSITIVE_INFINITY) < topPrice;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.dashboard.invitationsTitle}
        </h1>
        {invitations.length > 0 ? (
          <Link
            href="/dashboard/undangan/baru"
            className={buttonVariants({ size: "sm" })}
          >
            {copy.dashboard.createCta}
          </Link>
        ) : null}
      </div>

      {invitations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <h2 className="text-lg font-medium">{copy.dashboard.emptyTitle}</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              {copy.dashboard.emptyBody}
            </p>
            <Link
              href="/dashboard/undangan/baru"
              className={cn(buttonVariants(), "mt-2")}
            >
              {copy.dashboard.createCta}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {invitations.map((inv) => (
            <li key={inv.id}>
              <Card>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">/{inv.slug}</p>
                      <p className="text-muted-foreground text-xs">
                        {inv.event_date ??
                          tanggalSesi.get(inv.id) ??
                          "Tanggal belum diatur"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                        statusBadgeClass[inv.status],
                      )}
                    >
                      {copy.dashboard.status[inv.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inv.status === "draft" ||
                    inv.status === "pending_payment" ||
                    inv.status === "expired" ? (
                      <Link
                        href={`/dashboard/undangan/${inv.id}/aktifkan`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        {inv.status === "draft"
                          ? copy.dashboard.cardActivate
                          : inv.status === "pending_payment"
                            ? copy.dashboard.cardPay
                            : copy.dashboard.cardRenew}
                      </Link>
                    ) : null}
                    <Link
                      href={`/dashboard/undangan/${inv.id}/edit`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {copy.dashboard.cardEdit}
                    </Link>
                    {/* Pratinjau pemilik di SEMUA status, tab yang sama
                        (DECISIONS #129). */}
                    <Link
                      href={`/preview/${inv.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {copy.dashboard.cardPreview}
                    </Link>
                    {/* Ganti tema (SPEC §4.4) — daftar ini sudah menyaring
                        undangan ber-`purged_at`; suspended tak bisa. */}
                    {inv.status !== "suspended" ? (
                      <Link
                        href={`/dashboard/undangan/${inv.id}/tema`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {copy.dashboard.cardTheme}
                      </Link>
                    ) : null}
                    <Link
                      href={`/dashboard/undangan/${inv.id}/tamu`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {copy.dashboard.cardGuests}
                    </Link>
                    {inv.status === "active" ? (
                      <Link
                        href={`/dashboard/undangan/${inv.id}/sebar`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {copy.dashboard.cardShare}
                      </Link>
                    ) : null}
                    {bisaUpgrade(inv.status, inv.package_id) ? (
                      <Link
                        href={`/dashboard/undangan/${inv.id}/upgrade`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {copy.dashboard.cardUpgrade}
                      </Link>
                    ) : null}
                    {inv.status === "active" ? (
                      <Link
                        href={`/dashboard/undangan/${inv.id}/momen`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {copy.dashboard.cardMomen}
                      </Link>
                    ) : null}
                    {inv.status === "active" || inv.status === "expired" ? (
                      <Link
                        href={`/dashboard/undangan/${inv.id}/ucapan`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {copy.dashboard.cardGuestbook}
                      </Link>
                    ) : null}
                    {inv.status === "draft" || inv.status === "expired" ? (
                      <DeleteInvitationButton invitationId={inv.id} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
