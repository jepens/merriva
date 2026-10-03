import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * 404 di dalam dashboard pemilik (AUDIT-2026-10-01).
 *
 * Ada 20 pemanggilan `notFound()` di pohon `/dashboard` — id undangan yang
 * salah salin, undangan yang sudah dihapus, baris pasca-retensi. Semuanya dulu
 * mendarat di `src/app/not-found.tsx`, yang teksnya ditulis untuk TAMU
 * undangan: "undangannya sudah tidak aktif", dengan tombol ke beranda
 * MARKETING. Pemilik yang sekadar salah menyalin id dibuang keluar dari sesi
 * kerjanya sambil diberi kecemasan palsu bahwa undangannya mati.
 *
 * Statis (tanpa I/O), jadi aman dirender di jalur galat.
 */
export default function DashboardNotFound() {
  const t = copy.notFoundPage;
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-muted-foreground/60 text-5xl font-semibold tracking-tight">
        {t.code}
      </p>
      <h1 className="text-xl font-semibold tracking-tight">{t.ownerTitle}</h1>
      <p className="text-muted-foreground max-w-md text-sm text-balance">
        {t.ownerBody}
      </p>
      <Link href="/dashboard" className={cn(buttonVariants(), "mt-2")}>
        {t.ownerCta}
      </Link>
    </main>
  );
}
