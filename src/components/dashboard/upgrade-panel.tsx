"use client";

import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatIdr } from "@/lib/format";
import type { PackageLimits } from "@/lib/limits";
import { packageFeatures } from "@/lib/package-features";
import { cn } from "@/lib/utils";
import { createUpgradeCheckoutAction } from "@/server/actions/upgrade";

/**
 * Panel upgrade paket (AUDIT-2026-10-01 B3). Mencerminkan `package-chooser.tsx`
 * agar hanya ada satu pola "pilih lalu dialihkan ke Pakasir" di produk ini.
 *
 * Yang berbeda, dan sengaja: harga yang dipampang adalah SELISIH, masa aktif
 * yang tersisa disebut di atas tombol, dan daftar fitur paket tujuan tidak
 * memuat baris "Masa aktif N bulan" — upgrade tidak membelinya.
 */

const u = copy.upgrade;

export interface UpgradeChoice {
  code: string;
  name: string;
  priceIdr: number;
  differenceIdr: number;
  limits: PackageLimits;
}

export function UpgradePanel({
  invitationId,
  currentName,
  currentPriceIdr,
  activeUntilLabel,
  daysLeft,
  choices,
}: {
  invitationId: string;
  currentName: string;
  currentPriceIdr: number;
  activeUntilLabel: string;
  daysLeft: number | null;
  choices: UpgradeChoice[];
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onChoose(code: string) {
    setError(null);
    setPending(code);
    try {
      const res = await createUpgradeCheckoutAction(invitationId, code);
      if (res.status === "redirect") {
        // `pending` dibiarkan menyala selama navigasi keluar (pola yang sama
        // dengan pemilih paket aktivasi).
        window.location.assign(res.url);
        return;
      }
      setError(res.message ?? u.error);
      setPending(null);
      // Halaman ini bisa basi: masa aktif berakhir, harga katalog berubah, atau
      // order upgrade dibuat di tab lain. Muat ulang dari server agar yang
      // tampil adalah keadaan sebenarnya, bukan penawaran yang sudah mati.
      router.refresh();
    } catch {
      setError(u.error);
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <dl className="bg-muted/40 space-y-1.5 rounded-lg px-4 py-3 text-sm">
        <div className="flex flex-wrap justify-between gap-3">
          <dt className="text-muted-foreground">{u.currentLabel}</dt>
          <dd className="font-medium">
            {currentName}{" "}
            <span className="text-muted-foreground font-normal">
              · {formatIdr(currentPriceIdr)}
            </span>
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-3">
          <dt className="text-muted-foreground">{u.activeUntilLabel}</dt>
          <dd className="font-medium">
            {activeUntilLabel}
            {daysLeft !== null ? (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {u.daysLeft(daysLeft)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      {/* Dipasang DI ATAS pilihan, bukan sebagai catatan kaki: inilah satu hal
          yang paling mudah disalahpahami pada pembelian ini. */}
      <Alert>
        <AlertDescription>{u.periodNotice}</AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        {choices.map((choice) => {
          const isBusy = pending === choice.code;
          const anyBusy = pending !== null;
          return (
            <Card key={choice.code} className="border-primary/60 shadow-sm">
              <CardContent className="flex flex-col gap-4 py-5">
                <div className="space-y-1">
                  <h2 className="flex items-center gap-1.5 text-lg font-semibold">
                    <ArrowUpRight className="text-primary size-4 shrink-0" />
                    {choice.name}
                  </h2>
                  <p className="text-2xl font-bold tracking-tight">
                    {formatIdr(choice.differenceIdr)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {u.payHint} · {u.targetPrice} {formatIdr(choice.priceIdr)} −{" "}
                    {u.currentPrice} {formatIdr(currentPriceIdr)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">
                    {u.gainsTitle}
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {/* `null` = tanpa baris "Masa aktif N bulan" (B3). */}
                    {packageFeatures(choice.limits, null).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="text-primary mt-0.5 size-4 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={anyBusy}
                  onClick={() => onChoose(choice.code)}
                  className={cn(buttonVariants(), "mt-auto w-full")}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {u.redirecting}
                    </>
                  ) : (
                    u.cta
                  )}
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error ? (
        <p
          ref={(el) => {
            el?.scrollIntoView({ block: "nearest" });
          }}
          className="text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* Titik tempat uang berpindah (AUDIT-2026-10-01 A2) — sama dengan
          pemilih paket aktivasi. */}
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
    </div>
  );
}
