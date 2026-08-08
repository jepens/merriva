import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { wibDate } from "@/lib/admin/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/server/guards/auth";
import type { InvitationStatus } from "@/types";

export const metadata: Metadata = { title: copy.admin.invitations.title };

const PAGE_SIZE = 25;
const c = copy.admin.invitations;
const STATUSES = Object.keys(copy.admin.statusLabel) as InvitationStatus[];

interface Row {
  id: string;
  slug: string;
  category: keyof typeof copy.admin.categoryLabel;
  status: InvitationStatus;
  active_until: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireAdmin(); // defense-in-depth (page pakai service_role)
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = STATUSES.includes(sp.status as InvitationStatus)
    ? (sp.status as InvitationStatus)
    : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("invitations")
    .select(
      "id, slug, category, status, active_until, created_at, profiles(full_name)",
      {
        count: "exact",
      },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (q) query = query.ilike("slug", `%${q}%`);
  if (status) query = query.eq("status", status);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const hasNext = from + PAGE_SIZE < total;

  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/undangan?${s}` : "/admin/undangan";
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
        <p className="text-muted-foreground text-sm">{c.subtitle}</p>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={c.searchPlaceholder}
          className="border-input bg-background h-9 w-56 rounded-md border px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{copy.admin.common.all}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {copy.admin.statusLabel[s]}
            </option>
          ))}
        </select>
        <button className={buttonVariants({ size: "sm" })}>
          {copy.admin.common.searchCta}
        </button>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium">{c.colSlug}</th>
                <th className="px-4 py-2 font-medium">{c.colCategory}</th>
                <th className="px-4 py-2 font-medium">{c.colStatus}</th>
                <th className="px-4 py-2 font-medium">{c.colOwner}</th>
                <th className="px-4 py-2 font-medium">{c.colActiveUntil}</th>
                <th className="px-4 py-2 font-medium">{c.colCreated}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    {copy.admin.common.empty}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/undangan/${r.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.slug}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {copy.admin.categoryLabel[r.category]}
                    </td>
                    <td className="px-4 py-2">
                      {copy.admin.statusLabel[r.status]}
                    </td>
                    <td className="px-4 py-2">
                      {r.profiles?.full_name ?? copy.admin.common.dash}
                    </td>
                    <td className="px-4 py-2">{wibDate(r.active_until)}</td>
                    <td className="px-4 py-2">{wibDate(r.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {copy.admin.common.page(page)}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={href(page - 1)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {copy.admin.common.prev}
            </Link>
          ) : null}
          {hasNext ? (
            <Link
              href={href(page + 1)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {copy.admin.common.next}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
