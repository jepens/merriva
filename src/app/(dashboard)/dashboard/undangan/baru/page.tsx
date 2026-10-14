import type { Metadata } from "next";

import { CreateInvitationForm } from "@/components/dashboard/create-invitation-form";
import { copy } from "@/lib/copy";
import { dataOrThrow } from "@/lib/supabase/result";
import {
  CREATE_PATH,
  THEME_PARAM,
  preselectFromCatalog,
  themeFromParam,
  themeCtaHref,
} from "@/lib/theme-cta";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";
import { hasThemeThumb } from "@/server/theme-thumbs";

export const metadata: Metadata = { title: copy.create.title };

export default async function NewInvitationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // `?tema=` datang dari tombol "Gunakan tema ini" di katalog & showcase.
  const diminta = themeFromParam((await searchParams)[THEME_PARAM]);

  // Tujuannya ikut ke `/masuk` lengkap dengan temanya: pengunjung marketing
  // yang belum login adalah justru SASARAN UTAMA tombol itu, dan tanpa ini ia
  // mendarat di dasbor kosong setelah masuk — pilihannya hilang.
  await requireUser(diminta ? themeCtaHref(diminta) : CREATE_PATH);
  const supabase = await createSupabaseServerClient();

  // Katalog tema kosong karena DB berkedip akan menampilkan pemilih tema tanpa
  // satu pun pilihan — pemilik mengira produknya rusak (AUDIT-2026-10-01).
  const themes = dataOrThrow(
    await supabase
      .from("themes")
      .select("slug, name, categories, tier")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    "themes (buat undangan)",
  );

  // Sematkan ketersediaan thumbnail (server fs-check) → kartu pakai mockup foto
  // atau fallback poster spesimen untuk tema yang belum difoto.
  const themeOptions = (themes ?? []).map((t) => ({
    ...t,
    hasThumb: hasThemeThumb(t.slug),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.create.title}
        </h1>
        <p className="text-muted-foreground text-sm">{copy.create.subtitle}</p>
      </div>
      <CreateInvitationForm
        themes={themeOptions}
        preselect={preselectFromCatalog(themeOptions, diminta)}
      />
    </div>
  );
}
