import { Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { CorporateEditor } from "@/components/dashboard/editor/corporate-editor";
import { FamilyEditor } from "@/components/dashboard/editor/family-editor";
import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { copy } from "@/lib/copy";
import { stepKeyFromParam } from "@/lib/editor-links";
import { isUuid } from "@/lib/id";
import { photoLimitFromPackage, toMediaView } from "@/lib/media";
import { toEventDraft } from "@/lib/schedule";
import { getStorage } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_SETTINGS,
  editableContent,
  settingsSchema,
} from "@/lib/validation/content";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.editor.title };

export default async function EditInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ langkah?: string | string[] }>;
}) {
  const { id } = await params;
  // `?langkah=jadwal` (mis. dari daftar syarat di halaman aktivasi, #44) →
  // editor langsung membuka langkah itu; nilai tak dikenal → langkah pertama.
  const initialStep = stepKeyFromParam((await searchParams).langkah);
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

  // Isi yang tak lolos skema draft tetap ditampilkan (bukan diganti kosong lalu
  // tertimpa autosave) — lihat `editableContent`.
  const content = editableContent(inv.content, inv.category);

  const parsedSettings = settingsSchema.safeParse(inv.settings);
  const settings = parsedSettings.success
    ? parsedSettings.data
    : DEFAULT_SETTINGS;
  const eventDate = inv.event_date ?? "";

  const { data: eventRows } = await supabase
    .from("invitation_events")
    .select("id, name, start_at, end_at, venue_name, address, maps_url")
    .eq("invitation_id", inv.id)
    .order("sort_order", { ascending: true });
  // Sesi tanpa jam mulai (start_at NULL) kembali UTUH dengan isian Mulai kosong.
  const events = (eventRows ?? []).map((e) =>
    toEventDraft(e, settings.timezone),
  );

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

  // Pustaka lagu aktif untuk picker musik (RLS `songs_select_public`: is_active).
  // URL dirakit ke domain sendiri di server → tema/pratinjau tak lihat URL vendor.
  const { data: songRows } = await supabase
    .from("songs")
    .select("id, title, artist, storage_path")
    .eq("is_active", true)
    .order("title", { ascending: true });
  const songs = (songRows ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    url: storage.getPublicUrl(s.storage_path),
  }));

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
          songs={songs}
          initialStep={initialStep}
        />
      ) : content.category === "corporate" ? (
        <CorporateEditor
          invitationId={inv.id}
          slug={inv.slug}
          defaultValues={{ eventDate, content, settings, events }}
          initialMedia={media}
          maxPhotos={maxPhotos}
          songs={songs}
          initialStep={initialStep}
        />
      ) : (
        <FamilyEditor
          invitationId={inv.id}
          slug={inv.slug}
          defaultValues={{ eventDate, content, settings, events }}
          initialMedia={media}
          maxPhotos={maxPhotos}
          songs={songs}
          initialStep={initialStep}
        />
      )}
    </div>
  );
}
