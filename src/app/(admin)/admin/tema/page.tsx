import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dataOrThrow } from "@/lib/supabase/result";
import { adminUpdateThemeAction } from "@/server/actions/admin-catalog";
import { requireAdmin } from "@/server/guards/auth";
import type { InvitationCategory, ThemeTier } from "@/types";

export const metadata: Metadata = { title: copy.admin.themes.title };

const c = copy.admin.themes;
const CATEGORIES: InvitationCategory[] = ["wedding", "corporate", "family"];
const fieldClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm";
const labelClass = "text-muted-foreground text-xs";

interface ThemeRow {
  id: string;
  slug: string;
  name: string;
  categories: InvitationCategory[];
  tier: ThemeTier;
  sort_order: number;
  is_active: boolean;
}

export default async function AdminThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  await requireAdmin(); // defense-in-depth (page pakai service_role)
  const { msg } = await searchParams;
  const msgText =
    msg && msg in copy.admin.msg
      ? copy.admin.msg[msg as keyof typeof copy.admin.msg]
      : null;

  const admin = createSupabaseAdminClient();
  const themes = dataOrThrow(
    await admin
      .from("themes")
      .select("id, slug, name, categories, tier, sort_order, is_active")
      .order("sort_order", { ascending: true }),
    "themes (admin)",
  ) as ThemeRow[];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
        <p className="text-muted-foreground text-sm">{c.subtitle}</p>
      </div>

      {msgText ? (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            msg === "theme_ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {msgText}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {themes.map((theme) => (
          <Card key={theme.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {theme.name}{" "}
                <span className="text-muted-foreground font-mono text-xs">
                  ({theme.slug})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={adminUpdateThemeAction.bind(null, theme.id)}
                className="space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className={labelClass}>{c.name}</span>
                    <input
                      name="name"
                      defaultValue={theme.name}
                      className={fieldClass}
                      required
                    />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>{c.tier}</span>
                    <select
                      name="tier"
                      defaultValue={theme.tier}
                      className={fieldClass}
                    >
                      <option value="standard">{c.tierStandard}</option>
                      <option value="premium">{c.tierPremium}</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>{c.sortOrder}</span>
                    <input
                      name="sortOrder"
                      type="number"
                      min={0}
                      max={9999}
                      defaultValue={theme.sort_order}
                      className={fieldClass}
                      required
                    />
                  </label>
                </div>

                <div className="space-y-1">
                  <span className={labelClass}>{c.categories}</span>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {CATEGORIES.map((cat) => (
                      <label key={cat} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="categories"
                          value={cat}
                          defaultChecked={theme.categories.includes(cat)}
                          className="size-4"
                        />
                        <span>{copy.admin.categoryLabel[cat]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={theme.is_active}
                    className="size-4"
                  />
                  <span>{c.active}</span>
                </label>

                <Button type="submit" size="sm">
                  {c.save}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
