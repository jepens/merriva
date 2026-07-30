import Link from "next/link";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { signOutAction } from "@/server/actions/auth";
import { requireAdmin } from "@/server/guards/auth";

/**
 * Layout area admin (SPEC §4.9). `requireAdmin()` menjaga SETIAP route di bawah
 * `(admin)/admin/*`: belum login → `/masuk`; bukan admin → 404. Middleware
 * (`/admin/:path*`) menyegarkan sesi; RLS admin-ALL membatasi data. Tiga lapis.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="bg-muted/20 min-h-dvh">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            {copy.admin.brand}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/admin"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.admin.nav.overview}
            </Link>
            <Link
              href="/admin/undangan"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.admin.nav.invitations}
            </Link>
            <Link
              href="/admin/order"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.admin.nav.orders}
            </Link>
            <Link
              href="/admin/pengguna"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.admin.nav.users}
            </Link>
            <Link
              href="/admin/paket"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.admin.nav.packages}
            </Link>
            <Link
              href="/admin/tema"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.admin.nav.themes}
            </Link>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.admin.nav.toDashboard}
            </Link>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                {copy.auth.signOut}
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
