import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { wibDate } from "@/lib/admin/display";
import { formatIdr } from "@/lib/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/server/guards/auth";
import type { OrderStatus } from "@/types";

export const metadata: Metadata = { title: copy.admin.orders.title };

const PAGE_SIZE = 25;
const c = copy.admin.orders;
const STATUSES = Object.keys(copy.admin.orderStatusLabel) as OrderStatus[];

interface Row {
  id: string;
  order_code: string;
  status: OrderStatus;
  amount_idr: number;
  payment_method: string | null;
  created_at: string;
  paid_at: string | null;
  raw_notification: unknown;
  invitations: { id: string; slug: string } | null;
  profiles: { full_name: string | null } | null;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireAdmin(); // defense-in-depth (page pakai service_role)
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = STATUSES.includes(sp.status as OrderStatus)
    ? (sp.status as OrderStatus)
    : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("orders")
    .select(
      "id, order_code, status, amount_idr, payment_method, created_at, paid_at, raw_notification, invitations(id, slug), profiles(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (q) query = query.ilike("order_code", `%${q.toUpperCase()}%`);
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
    return s ? `/admin/order?${s}` : "/admin/order";
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
              {copy.admin.orderStatusLabel[s]}
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
                <th className="px-4 py-2 font-medium">{c.colCode}</th>
                <th className="px-4 py-2 font-medium">{c.colStatus}</th>
                <th className="px-4 py-2 font-medium">{c.colAmount}</th>
                <th className="px-4 py-2 font-medium">{c.colInvitation}</th>
                <th className="px-4 py-2 font-medium">{c.colOwner}</th>
                <th className="px-4 py-2 font-medium">{c.colCreated}</th>
                <th className="px-4 py-2 font-medium">{c.colNotification}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    {copy.admin.common.empty}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono">{r.order_code}</td>
                    <td className="px-4 py-2">
                      {copy.admin.orderStatusLabel[r.status]}
                    </td>
                    <td className="px-4 py-2">{formatIdr(r.amount_idr)}</td>
                    <td className="px-4 py-2">
                      {r.invitations ? (
                        <Link
                          href={`/admin/undangan/${r.invitations.id}`}
                          className="hover:underline"
                        >
                          {r.invitations.slug}
                        </Link>
                      ) : (
                        copy.admin.common.dash
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.profiles?.full_name ?? copy.admin.common.dash}
                    </td>
                    <td className="px-4 py-2">{wibDate(r.created_at)}</td>
                    <td className="px-4 py-2">
                      {r.raw_notification ? (
                        <details>
                          <summary className="text-muted-foreground cursor-pointer text-xs hover:underline">
                            {c.viewRaw}
                          </summary>
                          <pre className="bg-muted/50 mt-2 max-w-xs overflow-x-auto rounded p-2 text-[11px] leading-snug break-all whitespace-pre-wrap">
                            {JSON.stringify(r.raw_notification, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        c.rawNone
                      )}
                    </td>
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
