import Link from "next/link";
import type { ReactNode } from "react";

import { SupportContact } from "@/components/support-contact";
import { Button, buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { signOutAction } from "@/server/actions/auth";
import { requireUser } from "@/server/guards/auth";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser();

  return (
    <div className="bg-muted/20 min-h-dvh">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            {copy.brand.name}
          </Link>
          {/* `flex-wrap`: brand + 3 tautan + Keluar meluber di lebar 360px,
              ukuran layar mayoritas pengguna produk ini. */}
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.dashboard.navInvitations}
            </Link>
            <Link
              href="/dashboard/pesanan"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.dashboard.navOrders}
            </Link>
            <Link
              href="/dashboard/profil"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.dashboard.navProfile}
            </Link>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                {copy.auth.signOut}
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      {/* Dashboard sebelumnya tak punya footer sama sekali — tak ada satu pun
          jalan ke manusia dari dalam produk (AUDIT-2026-10-01 A5). */}
      <footer className="mx-auto max-w-5xl px-4 pb-8">
        <SupportContact variant="line" />
      </footer>
    </div>
  );
}
