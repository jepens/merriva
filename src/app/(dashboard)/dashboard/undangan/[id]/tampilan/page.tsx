import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppearanceEditor } from "@/components/dashboard/appearance/appearance-editor";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { defaultCustomSettings } from "@/lib/customizer/theme-options";
import { isUuid } from "@/lib/id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation/content";
import { getEffectiveLimits } from "@/server/limits";
import { requireUser } from "@/server/guards/auth";
import { getThemeOptions } from "@/themes/theme-options-registry";

export const metadata: Metadata = { title: copy.appearance.title };

/**
 * Halaman kustomisasi tampilan (Fase G / CUSTOMIZER-SPEC §7). HANYA pemilik
 * (RLS + filter user_id). Merakit options tema + status Premium + `settings.custom`
 * awal, lalu merender editor klien (preview tema asli + bottom sheet). Dinamis
 * (auth cookie) → tak ter-cache.
 */
export default async function AppearancePage({
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
    .select("id, slug, settings, theme_id, package_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!inv) notFound();

  const { data: theme } = await supabase
    .from("themes")
    .select("slug")
    .eq("id", inv.theme_id)
    .maybeSingle();
  const options = theme?.slug ? getThemeOptions(theme.slug) : null;

  const backHref = `/dashboard/undangan/${id}/edit`;

  // Tema belum mendeklarasikan options → fitur tak muncul (tetap berfungsi normal).
  if (!options) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">{copy.appearance.title}</h1>
        <p className="text-muted-foreground text-sm">
          {copy.appearance.unsupported}
        </p>
        <Link
          href={backHref}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {copy.appearance.back}
        </Link>
      </div>
    );
  }

  const premium = !(await getEffectiveLimits(supabase, inv.package_id))
    .watermark;
  const parsedSettings = settingsSchema.safeParse(inv.settings);
  const initialCustom =
    parsedSettings.data?.custom ?? defaultCustomSettings(options);

  return (
    <AppearanceEditor
      invitationId={inv.id}
      previewSrc={`/preview/${inv.id}?embed=1`}
      backHref={backHref}
      options={options}
      premium={premium}
      initialCustom={initialCustom}
    />
  );
}
