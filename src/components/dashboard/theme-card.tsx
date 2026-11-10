import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeThumb } from "@/components/dashboard/theme-thumb";
import { ThemeMockup } from "@/components/theme-mockup";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Kartu tema di dashboard — dipakai pemilih tema saat MEMBUAT undangan dan
 * halaman GANTI tema (SPEC §4.4), supaya keduanya tampil sama. Mockup foto bila
 * thumbnail ada, poster spesimen bila belum. Tombol aksi diisi pemanggil.
 */
export function ThemeCard({
  slug,
  name,
  tier,
  hasThumb,
  selected = false,
  badge,
  children,
}: {
  slug: string;
  name: string;
  tier: string;
  hasThumb: boolean;
  /** Bingkai sorot + tanda centang di pojok. */
  selected?: boolean;
  /** Label di kanan nama; bawaannya tier tema ("Standar"/"Premium"). */
  badge?: ReactNode;
  children: ReactNode;
}) {
  const tierLabel =
    tier === "premium" ? copy.create.tier.premium : copy.create.tier.standard;
  return (
    <div
      className={cn(
        "bg-card relative overflow-hidden rounded-xl border transition-colors",
        selected ? "border-primary ring-primary ring-1" : "border-border",
      )}
    >
      {hasThumb ? (
        <ThemeMockup slug={slug} name={name} />
      ) : (
        <ThemeThumb slug={slug} name={name} />
      )}
      {selected ? (
        <span className="bg-primary text-primary-foreground absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{name}</p>
          <span className="text-muted-foreground text-xs">
            {badge ?? tierLabel}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
