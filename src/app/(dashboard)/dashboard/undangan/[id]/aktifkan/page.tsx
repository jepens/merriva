import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  ActivationBlockers,
  UnscheduledNote,
} from "@/components/dashboard/activation-blockers";
import {
  PackageChooser,
  type CheckoutPackage,
} from "@/components/dashboard/package-chooser";
import { buttonVariants } from "@/components/ui/button";
import {
  activationReadiness,
  fetchReadinessEvents,
} from "@/lib/activation-readiness";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { resolveLimits } from "@/lib/limits";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPaymentExempt, requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.checkout.title };

/**
 * Halaman aktivasi (SPEC §4.8 Flow A langkah 6): pilih paket → checkout. Dinamis
 * (auth). Undangan harus milik pemanggil (RLS) & berstatus dapat-dibayar; `active`
 * → tak perlu bayar (redirect ke dashboard). Harga dari `packages` (DB-driven).
 */
export default async function ActivateInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!isUuid(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, status, slug, purged_at, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();
  // Data pribadi sudah dihapus permanen (retensi) → dashboard menyembunyikannya;
  // halaman aktivasi pun tak boleh jadi pintu belakang untuk membayarnya.
  if (inv.purged_at) notFound();
  if (inv.status === "active") redirect("/dashboard");
  if (inv.status === "suspended") notFound();

  // Syarat bayar yang bisa diperbaiki pemilik (SPEC §4.8 langkah 0, #44): alamat
  // masih `draft-…` (404 & terkunci setelah aktif) dan belum ada sesi berjam
  // (tamu tak tahu kapan acaranya). SEMUA ditampilkan sekaligus; penahan yang
  // sama di createCheckoutAction. Galat query jadwal → halaman tak mengklaim
  // "jadwal kosong" yang tak bisa dipastikan; penahan server gagal-tertutup.
  const { data: eventRows, error: eventsError } = await fetchReadinessEvents(
    supabase,
    inv.id,
  );
  const readiness = activationReadiness(inv, eventRows ?? []);
  const blockers = eventsError
    ? readiness.blockers.filter((b) => b !== "schedule")
    : readiness.blockers;

  if (blockers.length > 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {copy.checkout.title}
          </h1>
        </div>
        <ActivationBlockers invitationId={inv.id} blockers={blockers} />
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {copy.checkout.back}
        </Link>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("packages")
    .select("code, name, price_idr, duration_months, limits, is_active")
    .eq("is_active", true)
    .eq("kind", "invitation") // hanya paket undangan (bukan add-on Momen)
    .order("price_idr", { ascending: true })
    // Pemecah seri: "paket teratas" (`slice(-1)` di bawah) harus sama dengan
    // yang dipakai draft admin/Pro (`getEffectiveLimits`, DECISIONS #115).
    .order("code", { ascending: true });

  const packages: CheckoutPackage[] = (rows ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    priceIdr: p.price_idr,
    durationMonths: p.duration_months,
    limits: resolveLimits(p.limits),
  }));

  // Katalog kosong → JANGAN rangkai halaman beli. Dua hal di bawah terbit
  // tanpa bergantung pada isi daftar: subjudulnya menjanjikan "Pilih paket …
  // Pembayaran aman via QRIS", dan `PackageChooser` menaruh notis "Dengan
  // melanjutkan pembayaran…" + "diproses oleh Pakasir" DI LUAR `.map` kartunya.
  // Jadi katalog kosong menghasilkan legalese pembayaran di atas grid tanpa
  // satu pun barang — lebih buruk daripada sekadar daftar kosong. Halaman harga
  // publik sudah menggerbangi keduanya dengan cara yang sama.
  if (packages.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.checkout.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {copy.checkout.packageUnavailable}
        </p>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {copy.checkout.back}
        </Link>
      </div>
    );
  }

  // Admin & Pro tak pernah ditagih (DECISIONS #100) — hanya undangan MILIK
  // sendiri (admin melihat semua undangan lewat RLS). Langsung paket teratas:
  // urutan harga naik, jadi yang terakhir.
  const free =
    inv.user_id === user.id && (await isPaymentExempt(supabase, user.id));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.checkout.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {free ? copy.checkout.freeSubtitle : copy.checkout.subtitle}
        </p>
      </div>

      <UnscheduledNote invitationId={inv.id} names={readiness.unscheduled} />

      <PackageChooser
        invitationId={id}
        packages={free ? packages.slice(-1) : packages}
        free={free}
      />

      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {copy.checkout.back}
      </Link>
    </div>
  );
}
