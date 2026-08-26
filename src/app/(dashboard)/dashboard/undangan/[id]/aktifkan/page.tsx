import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  PackageChooser,
  type CheckoutPackage,
} from "@/components/dashboard/package-chooser";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { resolveLimits } from "@/lib/limits";
import { isDraftSlug } from "@/lib/slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";

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
  await requireUser();
  if (!isUuid(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, status, slug")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();
  if (inv.status === "active") redirect("/dashboard");
  if (inv.status === "suspended") notFound();

  // Slug masih `draft-…`: alamat publik 404 & terkunci setelah aktif → arahkan
  // pemilik mengatur alamat di editor dulu (sebelum bayar). Backstop juga di
  // createCheckoutAction.
  if (isDraftSlug(inv.slug)) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {copy.checkout.title}
          </h1>
        </div>
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <h2 className="text-lg font-medium">
              {copy.checkout.setSlugTitle}
            </h2>
            <p className="text-muted-foreground mx-auto max-w-md text-sm">
              {copy.checkout.setSlugBody}
            </p>
            <Link
              href={`/dashboard/undangan/${id}/edit`}
              className={buttonVariants()}
            >
              {copy.checkout.setSlugCta}
            </Link>
          </CardContent>
        </Card>
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
    .order("price_idr", { ascending: true });

  const packages: CheckoutPackage[] = (rows ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    priceIdr: p.price_idr,
    durationMonths: p.duration_months,
    limits: resolveLimits(p.limits),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.checkout.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {copy.checkout.subtitle}
        </p>
      </div>

      <PackageChooser invitationId={id} packages={packages} />

      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {copy.checkout.back}
      </Link>
    </div>
  );
}
