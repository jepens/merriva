import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { wibDate } from "@/lib/admin/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProfileRole } from "@/types";

export const metadata: Metadata = { title: copy.admin.users.title };

const PAGE_SIZE = 25;
const c = copy.admin.users;

interface UserRow {
  id: string;
  email: string | null;
  created_at: string;
  role: ProfileRole;
  full_name: string | null;
  phone: string | null;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page) || 1);

  const admin = createSupabaseAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({
    page,
    perPage: PAGE_SIZE,
  });
  const users = list?.users ?? [];
  const hasNext = users.length === PAGE_SIZE;

  // Peran/nama dari `profiles` (auth.users tak menyimpannya).
  const ids = users.map((u) => u.id);
  const profileMap = new Map<
    string,
    { role: ProfileRole; full_name: string | null; phone: string | null }
  >();
  if (ids.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, role, full_name, phone")
      .in("id", ids);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, {
        role: p.role,
        full_name: p.full_name,
        phone: p.phone,
      });
    }
  }

  let rows: UserRow[] = users.map((u) => {
    const p = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      role: p?.role ?? "client",
      full_name: p?.full_name ?? null,
      phone: p?.phone ?? null,
    };
  });
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q),
    );
  }

  const href = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/pengguna?${s}` : "/admin/pengguna";
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
          defaultValue={sp.q ?? ""}
          placeholder={c.searchPlaceholder}
          className="border-input bg-background h-9 w-64 rounded-md border px-3 text-sm"
        />
        <button className={buttonVariants({ size: "sm" })}>
          {copy.admin.common.searchCta}
        </button>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium">{c.colEmail}</th>
                <th className="px-4 py-2 font-medium">{c.colName}</th>
                <th className="px-4 py-2 font-medium">{c.colPhone}</th>
                <th className="px-4 py-2 font-medium">{c.colRole}</th>
                <th className="px-4 py-2 font-medium">{c.colJoined}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    {copy.admin.common.empty}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      {r.email ?? copy.admin.common.dash}
                    </td>
                    <td className="px-4 py-2">
                      {r.full_name ?? copy.admin.common.dash}
                    </td>
                    <td className="px-4 py-2">
                      {r.phone ?? copy.admin.common.dash}
                    </td>
                    <td className="px-4 py-2">
                      {r.role === "admin" ? c.roleAdmin : c.roleClient}
                    </td>
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
