"use client";

import Link from "next/link";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatIdr } from "@/lib/format";
import { packageAllowsTheme, type PackageLimits } from "@/lib/limits";
import { packageFeatures } from "@/lib/package-features";
import { cn } from "@/lib/utils";
import { createCheckoutAction } from "@/server/actions/checkout";

export interface CheckoutPackage {
  code: string;
  name: string;
  priceIdr: number;
  durationMonths: number;
  limits: PackageLimits;
}

/**
 * Pemilih paket + tombol bayar (M3.1). Memanggil `createCheckoutAction` lalu
 * meng-alihkan browser ke payment link Pakasir. Nominal & durasi hanya untuk
 * TAMPILAN — server mengambil harga otoritatif dari `packages` saat membuat order.
 *
 * `free` = akun Admin/Pro (DECISIONS #100): aksi yang sama langsung
 * mengaktifkan lalu mengarahkan ke dashboard, jadi tak ada harga maupun notis
 * pembayaran yang ditampilkan.
 *
 * `themeTier` = tier tema undangan: paket yang tak mencakup tema premium
 * tampil nonaktif dengan penjelasan (DECISIONS #116). Ini tampilan saja —
 * `createCheckoutAction` menolaknya sendiri.
 */
export function PackageChooser({
  invitationId,
  packages,
  free = false,
  themeTier = null,
}: {
  invitationId: string;
  packages: CheckoutPackage[];
  free?: boolean;
  themeTier?: string | null;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onChoose(code: string) {
    setError(null);
    setPending(code);
    try {
      const res = await createCheckoutAction(invitationId, code);
      if (res.status === "redirect") {
        // Biarkan `pending` menyala selama navigasi keluar. `assign` (bukan
        // set `.href`) → tak memicu react-hooks/immutability compiler.
        window.location.assign(res.url);
        return;
      }
      setError(res.message ?? copy.checkout.error);
      setPending(null);
      // Syarat bayar belum terpenuhi (#44): halaman ini basi — mis. jadwal
      // dikosongkan di tab lain. Muat ulang dari server agar daftar syarat
      // beserta tautan perbaikannya menggantikan pemilih paket; pesan di bawah
      // tetap tampil selama pemuatan.
      if (res.reason === "readiness") router.refresh();
    } catch {
      setError(copy.checkout.error);
      setPending(null);
    }
  }

  const anyLocked = packages.some(
    (p) => !packageAllowsTheme(p.limits, themeTier),
  );

  return (
    <div className="space-y-4">
      {anyLocked ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {copy.checkout.premiumThemeNote}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {packages.map((pkg, i) => {
          const isBusy = pending === pkg.code;
          const anyBusy = pending !== null;
          const locked = !packageAllowsTheme(pkg.limits, themeTier);
          const highlight = i === packages.length - 1; // paket teratas (Premium)
          return (
            <Card
              key={pkg.code}
              className={cn(highlight && "border-primary/60 shadow-sm")}
            >
              <CardContent className="flex flex-col gap-4 py-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{pkg.name}</h2>
                    {highlight && !free ? (
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium">
                        {copy.checkout.popular}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    {free ? copy.checkout.freePrice : formatIdr(pkg.priceIdr)}
                  </p>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {packageFeatures(pkg.limits, pkg.durationMonths).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="text-primary mt-0.5 size-4 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={anyBusy || locked}
                  onClick={() => onChoose(pkg.code)}
                  className={cn(
                    buttonVariants({
                      variant: highlight ? "default" : "outline",
                    }),
                    "mt-auto w-full",
                  )}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {free
                        ? copy.checkout.freeActivating
                        : copy.checkout.redirecting}
                    </>
                  ) : locked ? (
                    copy.checkout.premiumThemeOnly
                  ) : free ? (
                    copy.checkout.freeCta
                  ) : (
                    copy.checkout.choose
                  )}
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error ? (
        <p
          // Di ponsel kartu paket bertumpuk, jadi pesan di bawah kisi bisa jatuh
          // di luar layar dan tombolnya terasa diam saja — gulirkan ke pandangan
          // (pola yang sama dengan pesan "Selesai" di editor).
          ref={(el) => {
            el?.scrollIntoView({ block: "nearest" });
          }}
          className="text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* Titik tempat uang berpindah — pelanggan tak boleh bisa berargumen tak
          pernah diberi tahu bahwa masa aktif berbatas dan refund diatur
          terpisah (AUDIT-2026-10-01 A2). Tak ada uang berpindah saat `free`. */}
      {free ? null : (
        <>
          <p className="text-muted-foreground text-center text-xs">
            {copy.checkout.termsNoticeBefore}{" "}
            <Link href="/syarat" className="underline underline-offset-4">
              {copy.marketing.legal.terms.title}
            </Link>{" "}
            {copy.checkout.termsNoticeAnd}{" "}
            <Link href="/refund" className="underline underline-offset-4">
              {copy.marketing.legal.refund.title}
            </Link>
            .
          </p>

          <p className="text-muted-foreground text-center text-xs">
            {copy.checkout.securedBy}
          </p>
        </>
      )}
    </div>
  );
}
