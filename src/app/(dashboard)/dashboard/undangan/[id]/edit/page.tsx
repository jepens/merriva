import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_SETTINGS,
  draftContentSchema,
  emptyContent,
  settingsSchema,
} from "@/lib/validation/content";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.editor.title };

export default async function EditInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  if (!isUuid(id)) notFound();

  const supabase = await createSupabaseServerClient();
  // RLS membatasi ke undangan milik pemilik; baris orang lain → tidak ditemukan.
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, category, status, content, settings, event_date")
    .eq("id", id)
    .maybeSingle();

  if (!inv) notFound();

  const parsedContent = draftContentSchema.safeParse(inv.content);
  const content = parsedContent.success
    ? parsedContent.data
    : draftContentSchema.parse(emptyContent(inv.category));

  const parsedSettings = settingsSchema.safeParse(inv.settings);
  const settings = parsedSettings.success
    ? parsedSettings.data
    : DEFAULT_SETTINGS;
  const eventDate = inv.event_date ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {copy.editor.title}
      </h1>

      {content.category === "wedding" ? (
        <WeddingEditor
          invitationId={inv.id}
          slug={inv.slug}
          defaultValues={{ eventDate, content, settings }}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {copy.editor.unsupportedCategory}
          </p>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {copy.editor.backToDashboard}
          </Link>
        </div>
      )}
    </div>
  );
}
