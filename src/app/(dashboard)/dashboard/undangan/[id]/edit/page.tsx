import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.editor.title };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createSupabaseServerClient();
  // RLS membatasi ke undangan milik pemilik; baris orang lain → tidak ditemukan.
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, category, status")
    .eq("id", id)
    .maybeSingle();

  if (!inv) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {copy.editor.title}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {copy.create.category[inv.category]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{copy.editor.address}</span>
            <span className="font-medium">/{inv.slug}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">
              {copy.dashboard.status[inv.status]}
            </span>
          </div>
          <p className="text-muted-foreground border-t pt-3">
            {copy.editor.stepsSoon}
          </p>
        </CardContent>
      </Card>

      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {copy.editor.backToDashboard}
      </Link>
    </div>
  );
}
