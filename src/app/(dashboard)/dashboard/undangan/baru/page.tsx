import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.dashboard.builderSoonTitle };

/**
 * Placeholder pembuat undangan. Pembuat multi-langkah 3 kategori diimplementasikan
 * pada increment M1.3 (form + autosave + slug checker).
 */
export default async function NewInvitationPage() {
  await requireUser();

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>{copy.dashboard.builderSoonTitle}</CardTitle>
        <CardDescription>{copy.dashboard.builderSoon}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {copy.dashboard.backToList}
        </Link>
      </CardContent>
    </Card>
  );
}
