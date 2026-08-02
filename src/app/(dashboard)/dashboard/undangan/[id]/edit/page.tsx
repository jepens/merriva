import { Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { CorporateEditor } from "@/components/dashboard/editor/corporate-editor";
import { FamilyEditor } from "@/components/dashboard/editor/family-editor";
import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { copy } from "@/lib/copy";
import { utcToLocal } from "@/lib/datetime";
import { isUuid } from "@/lib/id";
import { photoLimitFromPackage, toMediaView } from "@/lib/media";
import { getStorage } from "@/lib/storage";
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
    .select(
      "id, slug, category, status, content, settings, event_date, package_id",
    )
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

  const { data: eventRows } = await supabase
    .from("invitation_events")
    .select("name, start_at, end_at, venue_name, address, maps_url")
    .eq("invitation_id", inv.id)
    .order("sort_order", { ascending: true });
  const events = (eventRows ?? []).map((e) => ({
    name: e.name,
    startAt: utcToLocal(e.start_at, settings.timezone),
    endAt: e.end_at ? utcToLocal(e.end_at, settings.timezone) : "",
    venueName: e.venue_name ?? "",
    address: e.address ?? "",
    mapsUrl: e.maps_url ?? "",
  }));

  // Galeri: baris `media` → view (URL domain sendiri) + batas foto paket.
  const { data: mediaRows } = await supabase
    .from("media")
    .select("id, storage_path, width, height")
    .eq("invitation_id", inv.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const storage = getStorage();
  const media = (mediaRows ?? []).map((r) =>
    toMediaView(r, (p) => storage.getPublicUrl(p)),
  );

  let pkgLimits: { max_photos?: number | null } | null = null;
  if (inv.package_id) {
    const { data: pkg } = await supabase
      .from("packages")
      .select("limits")
      .eq("id", inv.package_id)
      .maybeSingle();
    pkgLimits = (pkg?.limits as { max_photos?: number | null } | null) ?? null;
  }
  const maxPhotos = photoLimitFromPackage(pkgLimits);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.editor.title}
        </h1>
        <Link
          href={`/dashboard/undangan/${inv.id}/tampilan`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Palette className="size-4" />
          {copy.appearance.title}
        </Link>
      </div>

      {content.category === "wedding" ? (
        <WeddingEditor
          invitationId={inv.id}
          slug={inv.slug}
          defaultValues={{ eventDate, content, settings, events }}
          initialMedia={media}
          maxPhotos={maxPhotos}
        />
      ) : content.category === "corporate" ? (
        <CorporateEditor
          invitationId={inv.id}
          slug={inv.slug}
          defaultValues={{ eventDate, content, settings, events }}
          initialMedia={media}
          maxPhotos={maxPhotos}
        />
      ) : (
        <FamilyEditor
          invitationId={inv.id}
          slug={inv.slug}
          defaultValues={{ eventDate, content, settings, events }}
          initialMedia={media}
          maxPhotos={maxPhotos}
        />
      )}
    </div>
  );
}
