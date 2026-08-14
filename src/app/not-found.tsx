import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * 404 global berbahasa Indonesia (menggantikan default Next berbahasa Inggris).
 * Dirender untuk `notFound()` mana pun — termasuk tamu yang membuka slug undangan
 * salah/kedaluwarsa. Statis (tak ada I/O) → aman & ringan.
 */
export default function NotFound() {
  const t = copy.notFoundPage;
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-muted-foreground/60 text-6xl font-semibold tracking-tight">
        {t.code}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
      <p className="text-muted-foreground max-w-md text-sm text-balance">
        {t.body}
      </p>
      <Link href="/" className={cn(buttonVariants(), "mt-2")}>
        {t.cta}
      </Link>
    </main>
  );
}
