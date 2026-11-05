import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppearanceEditor } from "@/components/dashboard/appearance/appearance-editor";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  lengkapiUrutanSection,
  sesuaikanKePaket,
} from "@/lib/customizer/resolve";
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

  const premium = !(await getEffectiveLimits(supabase, inv.package_id, user.id))
    .watermark;
  const parsedSettings = settingsSchema.safeParse(inv.settings);
  const saved = parsedSettings.data?.custom;
  // Section yang ditambahkan ke tema sesudah pemilik menyimpan (mis. `video`)
  // dilengkapi di sini juga — tanpa itu editor mengirim daftar tak lengkap dan
  // server menolak setiap simpanan (lihat `lengkapiUrutanSection`).
  //
  // Lalu disesuaikan ke paket yang berlaku SEKARANG (DECISIONS #116), sama
  // dengan yang tampil di undangan: pemilik yang turun paket (refund upgrade,
  // perpanjangan Basic, alih kepemilikan) dulu memuat pilihan Premium lamanya
  // dan setiap simpanan — bahkan sekadar mengubah urutan — ditolak server.
  const initialCustom = saved
    ? sesuaikanKePaket(
        options,
        { ...saved, sections: lengkapiUrutanSection(options, saved.sections) },
        premium,
      )
    : defaultCustomSettings(options);

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
