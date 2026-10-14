import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleButton } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/auth/register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { safeNextPath } from "@/lib/safe-redirect";
import { getSessionUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: "Daftar" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  const user = await getSessionUser();
  if (user) {
    // `safeNextPath` menolak URL absolut & protocol-relative (anti open
    // redirect) dan jatuh ke `/dashboard` bila kosong.
    redirect(safeNextPath(next));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.auth.registerTitle}</CardTitle>
        <CardDescription>{copy.auth.registerSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm next={next} />

        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">
            {copy.auth.orSeparator}
          </span>
          <span className="bg-border h-px flex-1" />
        </div>

        {/* Dua jalur, dua cara meneruskan `next`: Google membacanya langsung
            dari form ini, sedangkan pendaftaran email berakhir di "cek email
            Anda" tanpa redirect sehingga tujuannya dititipkan ke cookie dan
            diambil lagi di `/auth/confirm` (DECISIONS #80). */}
        <GoogleButton next={next} />

        <p className="text-muted-foreground text-center text-sm">
          <Link
            href={next ? `/masuk?next=${encodeURIComponent(next)}` : "/masuk"}
            className="hover:underline"
          >
            {copy.auth.toLogin}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
