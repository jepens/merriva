import Link from "next/link";
import type { ReactNode } from "react";

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
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {copy.dashboard.navInvitations}
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
    </div>
  );
}
