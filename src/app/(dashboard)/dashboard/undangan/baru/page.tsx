import type { Metadata } from "next";

import { CreateInvitationForm } from "@/components/dashboard/create-invitation-form";
import { copy } from "@/lib/copy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";
import { hasThemeThumb } from "@/server/theme-thumbs";

export const metadata: Metadata = { title: copy.create.title };

export default async function NewInvitationPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: themes } = await supabase
    .from("themes")
    .select("slug, name, categories, tier")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

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
