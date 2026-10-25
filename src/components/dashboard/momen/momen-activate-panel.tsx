"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatIdr } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  activateFreeMomenAction,
  createMomenCheckoutAction,
} from "@/server/actions/momen-checkout";

export interface MomenTier {
  code: string;
  priceIdr: number;
  quotaPeserta: number | null;
}

const m = copy.momen.activate;

/**
 * Panel aktivasi add-on Album Momen (dashboard). Tier gratis (`momen_5`) =
 * `activateFreeMomenAction` lalu refresh (album muncul → manager). Tier berbayar
 * = `createMomenCheckoutAction` → alih ke Pakasir (pola sama PackageChooser).
 *
 * `free` = akun Admin/Pro (DECISIONS #100): halaman hanya mengirim tier
 * teratas, dan aksi berbayar yang sama mengaktifkannya tanpa Pakasir.
 */
export function MomenActivatePanel({
  invitationId,
  tiers,
  free = false,
}: {
  invitationId: string;
  tiers: MomenTier[];
  free?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pesertaLabel(quota: number | null): string {
    return quota === null ? m.pesertaUnlimited : m.peserta(quota);
  }

  async function activateFree() {
    setError(null);
    setPending("momen_5");
    try {
      const res = await activateFreeMomenAction(invitationId);
      if (res.status === "ok") {
        router.refresh();
        return;
      }
      setError(res.message ?? m.error);
    } catch {
      setError(m.error);
    } finally {
      setPending(null);
    }
  }

  async function buy(code: string) {
    setError(null);
    setPending(code);
    try {
      const res = await createMomenCheckoutAction(invitationId, code);
      if (res.status === "redirect") {
        window.location.assign(res.url);
        return;
      }
      setError(res.message ?? m.error);
      setPending(null);
    } catch {
      setError(m.error);
      setPending(null);
    }
  }

  const anyBusy = pending !== null;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{m.intro}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {tiers.map((t) => {
          const isFree = t.priceIdr === 0;
          // Label saja; jalurnya tetap ditentukan `isFree` (tier gratis punya
          // aksinya sendiri, tier lain lewat checkout yang membebaskan Admin/Pro).
          const gratis = free || isFree;
          const isBusy = pending === t.code;
          const highlight = t.quotaPeserta === null; // tier ∞
          return (
            <Card
              key={t.code}
              className={cn(highlight && "border-primary/60 shadow-sm")}
            >
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="space-y-1">
                  <h3 className="font-semibold">
                    {pesertaLabel(t.quotaPeserta)}
                  </h3>
                  <p className="text-xl font-bold tracking-tight">
                    {gratis ? m.free : formatIdr(t.priceIdr)}
                  </p>
                </div>
                <ul className="text-muted-foreground space-y-1 text-xs">
                  <li className="flex items-center gap-1.5">
                    <Check className="text-primary size-3.5" /> 6 filter film
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="text-primary size-3.5" /> Reveal +
                    moderasi
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="text-primary size-3.5" /> QR meja + unduh
                    ZIP
                  </li>
                </ul>
                <button
                  type="button"
                  disabled={anyBusy}
                  onClick={() =>
                    isFree ? void activateFree() : void buy(t.code)
                  }
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
                      {gratis ? m.freeActivating : m.redirecting}
                    </>
                  ) : gratis ? (
                    m.freeCta
                  ) : (
                    m.paidCta
                  )}
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {free ? null : (
        <p className="text-muted-foreground text-center text-xs">
          {m.securedBy}
        </p>
      )}
    </div>
  );
}
