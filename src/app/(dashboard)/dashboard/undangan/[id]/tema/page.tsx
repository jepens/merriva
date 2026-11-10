import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ThemeSwitcher,
  type SwitchThemeOption,
} from "@/components/dashboard/theme-switcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { UPGRADABLE_STATUSES } from "@/lib/invitation-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dataOrThrow } from "@/lib/supabase/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bolehGantiTema, temaPremiumTerkunci } from "@/lib/theme-switch";
import { getEffectiveLimits } from "@/server/limits";
import { requireUser } from "@/server/guards/auth";
import { hasThemeThumb } from "@/server/theme-thumbs";
import { getThemeLoader } from "@/themes/registry";

export const metadata: Metadata = { title: copy.themeSwitch.title };

/**
 * Ganti tema undangan (SPEC §4.4 "Ganti tema", DECISIONS #124). HANYA pemilik
 * (RLS + filter user_id). Daftar = tema aktif yang sekategori dan kodenya
 * terpasang, plus tema yang sedang dipakai walau sudah dinonaktifkan. Dinamis
 * (auth cookie) → tak ter-cache. Galat DB dilempar ke `error.tsx` (DECISIONS
 * #45) — daftar kosong karena kedipan DB tak boleh terlihat seperti "tak ada
 * tema".
 */
export default async function GantiTemaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!isUuid(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const inv = dataOrThrow(
    await supabase
      .from("invitations")
      .select("id, status, category, theme_id, package_id, purged_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    "invitations (ganti tema)",
  );
  if (!inv) notFound();

  const backHref = `/dashboard/undangan/${id}/edit`;
  const back = (
    <Link
      href={backHref}
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {copy.themeSwitch.back}
    </Link>
  );

  if (!bolehGantiTema(inv)) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {back}
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.themeSwitch.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {copy.themeSwitch.notAllowed}
        </p>
      </div>
    );
  }

  const [themes, limits] = await Promise.all([
    supabase
      .from("themes")
      .select("id, slug, name, categories, tier, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    getEffectiveLimits(supabase, inv.package_id, user.id),
  ]);
  const rows = dataOrThrow(themes, "themes (ganti tema)") ?? [];
  // Tema SEKARANG yang sudah dinonaktifkan disembunyikan RLS
  // (`themes_select_public`) dari pelanggan — padahal SPEC §4.4 memintanya
  // tetap tampil sebagai "Dipakai sekarang". Kepemilikan sudah terverifikasi di
  // atas, jadi baris itu dibaca lewat service-role (pola checkout.ts).
  if (!rows.some((t) => t.id === inv.theme_id)) {
    const current = dataOrThrow(
      await createSupabaseAdminClient()
        .from("themes")
        .select("id, slug, name, categories, tier, is_active")
        .eq("id", inv.theme_id)
        .maybeSingle(),
      "themes (tema sekarang)",
    );
    if (current) rows.unshift(current);
  }

  const options: SwitchThemeOption[] = rows
    .filter(
      (t) =>
        t.id === inv.theme_id ||
        (t.is_active &&
          t.categories.includes(inv.category) &&
          getThemeLoader(t.slug) !== null),
    )
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      tier: t.tier,
      hasThumb: hasThemeThumb(t.slug),
      current: t.id === inv.theme_id,
      locked: temaPremiumTerkunci(t.tier, inv, limits),
    }));
  const pilihanLain = options.some((t) => !t.current);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        {back}
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.themeSwitch.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {copy.themeSwitch.subtitle}
        </p>
        <p className="text-muted-foreground text-sm">
          {copy.themeSwitch.resetNote}
        </p>
      </div>
      {inv.status === "active" ? (
        <Alert>
          <AlertDescription>{copy.themeSwitch.liveNote}</AlertDescription>
        </Alert>
      ) : null}
      {pilihanLain ? (
        <ThemeSwitcher
          invitationId={inv.id}
          themes={options}
          live={inv.status === "active"}
          upgradeHref={
            UPGRADABLE_STATUSES.has(inv.status)
              ? `/dashboard/undangan/${inv.id}/upgrade`
              : null
          }
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {copy.themeSwitch.noTheme}
        </p>
      )}
    </div>
  );
}
