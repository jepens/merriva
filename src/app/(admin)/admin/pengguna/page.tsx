import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { isUserBanned, wibDate } from "@/lib/admin/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminReinstateUserAction,
  adminSetUserRoleAction,
  adminSuspendUserAction,
} from "@/server/actions/admin-users";
import { requireAdmin } from "@/server/guards/auth";
import type { ProfileRole } from "@/types";

export const metadata: Metadata = { title: copy.admin.users.title };

const PAGE_SIZE = 25;
const SCAN_PER_PAGE = 100;
const MAX_SCAN_PAGES = 20; // pindai hingga ~2000 user (skala MVP)
const c = copy.admin.users;
const selectClass =
  "border-input bg-background h-8 rounded-md border px-2 text-xs";

interface UserRow {
  id: string;
  email: string | null;
  created_at: string;
  role: ProfileRole;
  full_name: string | null;
  phone: string | null;
  banned: boolean;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.page) || 1);
  const msgText =
    sp.msg && sp.msg in copy.admin.msg
      ? copy.admin.msg[sp.msg as keyof typeof copy.admin.msg]
      : null;

  const me = await requireAdmin(); // guard + identitas admin utk penanda "Anda"
  const admin = createSupabaseAdminClient();

  // GoTrue admin `listUsers` TAK punya pencarian/urut server-side → pindai semua
  // halaman lalu filter + paginasi DI MEMORI (pencarian global + hasNext akurat).
  const allUsers: {
    id: string;
    email?: string;
    created_at: string;
    banned_until?: string | null;
  }[] = [];
  let truncated = false;
  for (let p = 1; p <= MAX_SCAN_PAGES; p += 1) {
    const { data } = await admin.auth.admin.listUsers({
      page: p,
      perPage: SCAN_PER_PAGE,
    });
    const chunk = data?.users ?? [];
    allUsers.push(...chunk);
    if (chunk.length < SCAN_PER_PAGE) break;
    if (p === MAX_SCAN_PAGES) truncated = true;
  }
  if (truncated) {
    console.warn(
      `[admin/pengguna] daftar user dipotong pada ${allUsers.length} (>${MAX_SCAN_PAGES}×${SCAN_PER_PAGE}).`,
    );
  }

  // Peran/nama dari `profiles` (auth.users tak menyimpannya). Satu query.
  const profileMap = new Map<
    string,
    { role: ProfileRole; full_name: string | null; phone: string | null }
  >();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, role, full_name, phone")
    .range(0, MAX_SCAN_PAGES * SCAN_PER_PAGE - 1);
  for (const pr of profiles ?? []) {
    profileMap.set(pr.id, {
      role: pr.role,
      full_name: pr.full_name,
      phone: pr.phone,
    });
  }

  let rows: UserRow[] = allUsers.map((u) => {
    const pr = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      role: pr?.role ?? "client",
      full_name: pr?.full_name ?? null,
      phone: pr?.phone ?? null,
      banned: isUserBanned(u.banned_until),
    };
  });
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q),
    );
  }

  const total = rows.length;
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);
  const hasNext = start + PAGE_SIZE < total;

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

      {msgText ? (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            sp.msg?.endsWith("_ok")
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {msgText}
        </div>
      ) : null}

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
                <th className="px-4 py-2 font-medium">{c.colStatus}</th>
                <th className="px-4 py-2 font-medium">{c.colJoined}</th>
                <th className="px-4 py-2 font-medium">{c.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    {copy.admin.common.empty}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const isSelf = r.id === me?.id;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 align-middle">
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
                      <td className="px-4 py-2">
                        {r.banned ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            {c.statusBanned}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {c.statusActive}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {wibDate(r.created_at)}
                      </td>
                      <td className="px-4 py-2">
                        {isSelf ? (
                          <span className="text-muted-foreground text-xs">
                            {c.selfLabel}
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <form
                              action={adminSetUserRoleAction.bind(null, r.id)}
                              className="flex items-center gap-1"
                            >
                              <select
                                name="role"
                                defaultValue={r.role}
                                className={selectClass}
                                aria-label={c.colRole}
                              >
                                <option value="client">{c.roleClient}</option>
                                <option value="admin">{c.roleAdmin}</option>
                              </select>
                              <button
                                className={buttonVariants({
                                  variant: "outline",
                                  size: "sm",
                                })}
                              >
                                {c.roleSave}
                              </button>
                            </form>
                            {r.banned ? (
                              <form
                                action={adminReinstateUserAction.bind(
                                  null,
                                  r.id,
                                )}
                              >
                                <button
                                  className={buttonVariants({
                                    variant: "outline",
                                    size: "sm",
                                  })}
                                >
                                  {c.reinstate}
                                </button>
                              </form>
                            ) : (
                              <form
                                action={adminSuspendUserAction.bind(null, r.id)}
                              >
                                <button
                                  className={buttonVariants({
                                    variant: "ghost",
                                    size: "sm",
                                  })}
                                >
                                  {c.suspend}
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
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
