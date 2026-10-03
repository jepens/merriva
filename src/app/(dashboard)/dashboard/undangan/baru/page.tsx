import type { Metadata } from "next";

import { CreateInvitationForm } from "@/components/dashboard/create-invitation-form";
import { copy } from "@/lib/copy";
import { dataOrThrow } from "@/lib/supabase/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";
import { hasThemeThumb } from "@/server/theme-thumbs";

export const metadata: Metadata = { title: copy.create.title };

export default async function NewInvitationPage() {
  await requireUser();
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
      <CreateInvitationForm themes={themeOptions} />
    </div>
  );
}
