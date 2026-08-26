import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { resolveLimits } from "@/lib/limits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminUpdatePackageAction } from "@/server/actions/admin-catalog";
import { requireAdmin } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.admin.packages.title };

const c = copy.admin.packages;
const fieldClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm";
const labelClass = "text-muted-foreground text-xs";

export default async function AdminPackagesPage({
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
  const { data: packages } = await admin
    .from("packages")
    .select("code, name, price_idr, duration_months, is_active, limits")
    .eq("kind", "invitation") // editor paket undangan; add-on Momen dikelola terpisah
    .order("price_idr", { ascending: true });

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
        <p className="text-muted-foreground text-sm">{c.subtitle}</p>
      </div>

      {msgText ? (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            msg === "pkg_ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {msgText}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {(packages ?? []).map((pkg) => {
          const limits = resolveLimits(pkg.limits);
          return (
            <Card key={pkg.code}>
              <CardHeader>
                <CardTitle className="text-base">
                  {pkg.name}{" "}
                  <span className="text-muted-foreground font-mono text-xs">
                    ({pkg.code})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action={adminUpdatePackageAction.bind(null, pkg.code)}
                  className="space-y-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className={labelClass}>{c.name}</span>
                      <input
                        name="name"
                        defaultValue={pkg.name}
                        className={fieldClass}
                        required
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>{c.price}</span>
                      <input
                        name="priceIdr"
                        type="number"
                        min={0}
                        defaultValue={pkg.price_idr}
                        className={fieldClass}
                        required
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>{c.duration}</span>
                      <input
                        name="durationMonths"
                        type="number"
                        min={1}
                        max={60}
                        defaultValue={pkg.duration_months}
                        className={fieldClass}
                        required
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>{c.maxPhotos}</span>
                      <input
                        name="maxPhotos"
                        type="number"
                        min={1}
                        max={1000}
                        defaultValue={limits.maxPhotos}
                        className={fieldClass}
                        required
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={labelClass}>{c.maxGuests}</span>
                      <input
                        name="maxGuests"
                        type="number"
                        min={1}
                        defaultValue={limits.maxGuests ?? 150}
                        className={fieldClass}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <Toggle
                      name="guestsUnlimited"
                      label={c.guestsUnlimited}
                      defaultChecked={limits.maxGuests === null}
                    />
                    <Toggle
                      name="youtube"
                      label={c.youtube}
                      defaultChecked={limits.youtube}
                    />
                    <Toggle
                      name="allThemes"
                      label={c.allThemes}
                      defaultChecked={limits.allThemes}
                    />
                    <Toggle
                      name="watermark"
                      label={c.watermark}
                      defaultChecked={limits.watermark}
                    />
                    <Toggle
                      name="isActive"
                      label={c.active}
                      defaultChecked={pkg.is_active}
                    />
                  </div>

                  <Button type="submit" size="sm">
                    {c.save}
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4"
      />
      <span>{label}</span>
    </label>
  );
}
