import Link from "next/link";
import type { ReactNode } from "react";

import { copy } from "@/lib/copy";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-muted/30 flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-2xl font-semibold tracking-tight">
        {copy.brand.name}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
