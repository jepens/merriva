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
import {
  displayPath,
  isCustomMusicPath,
  OG_ASPECT,
  toMediaView,
} from "@/lib/media";
import { toEventDraft } from "@/lib/schedule";
import { getStorage } from "@/lib/storage";
import { getThemeOptions } from "@/themes/theme-options-registry";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_SETTINGS,
  editableContent,
  settingsSchema,
} from "@/lib/validation/content";
import { requireUser } from "@/server/guards/auth";
import { liveCustomMusicPaths } from "@/server/invitation-data";
import { getEffectiveLimits } from "@/server/limits";
import type {
  MusicSlotView,
  PhotoSlots,
} from "@/components/dashboard/editor/types";

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
      "id, slug, category, status, content, settings, event_date, package_id, theme_id, user_id, music_locked_at",
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

  // Batas paket efektif — sumber yang sama dengan Tampilan, Tamu, pratinjau,
  // dan route unggah video. Draft milik admin/Pro memakai paket teratas
  // (DECISIONS #115); `inv.user_id`, bukan user sesi, karena admin juga bisa
  // membuka draft pelanggan di sini.
  const limits = await getEffectiveLimits(
    supabase,
    inv.package_id,
    inv.user_id,
  );
  const maxPhotos = limits.maxPhotos;

  // Video (FASE J): gerbang paket `limits.youtube` + URL tersimpan. Gerbang ini
  // hanya untuk tampilan editor — route unggah dan perakit render menegakkannya
  // sendiri di server.
  const v = content.video;
  const video = {
    allowed: limits.youtube,
    url: v ? storage.getPublicUrl(v.path) : null,
    posterUrl: v?.poster ? storage.getPublicUrl(v.poster) : null,
  };

  // Lagu sendiri (DECISIONS #121): Premium = tanpa watermark (konvensi gerbang
  // live streaming; draft admin/Pro sudah dapat paket teratas lewat
  // `getEffectiveLimits`). Path di `content` ditulis klien, jadi URL hanya
  // dirakit untuk objek musik milik undangan INI yang masih hidup menurut
  // `music_uploads` — objek yang sudah disapu/di-takedown tak diberi pemutar
  // (editor tetap menampilkan nama + tombol Hapus dari nilai form). Seperti
  // video, gerbang di sini hanya tampilan — route unggah dan perakit render
  // menegakkannya.
  //
  // `music_uploads` hanya service_role: dibaca lewat admin client SESUDAH
  // kepemilikan terverifikasi (`inv` dibaca client pemilik di bawah RLS), dan
  // hanya bila memang ada rujukan yang perlu diperiksa.
  const cm = content.customMusic;
  let pathHidup: string | null = null;
  if (cm && isCustomMusicPath(inv.id, cm.path)) {
    const hidup = await liveCustomMusicPaths(
      createSupabaseAdminClient(),
      inv.id,
    );
    if (hidup.includes(cm.path)) pathHidup = cm.path;
  }
  const music: MusicSlotView = {
    allowed: !limits.watermark,
    lockedAt: inv.music_locked_at,
    path: pathHidup,
    url: pathHidup ? storage.getPublicUrl(pathHidup) : null,
  };

  // Bidang foto di editor dirakit dari apa yang TEMA AKTIF nyatakan dirender
  // (THEME-CONTRACT §2) — bukan dari daftar tetap. Tema yang tak menyebut
  // `groom`/`bride` tak menampilkan bidangnya sama sekali, jadi tak ada lagi
  // bidang unggah yang isinya tak pernah muncul di mana pun.
  const { data: tema } = await supabase
    .from("themes")
    .select("slug")
    .eq("id", inv.theme_id)
    .maybeSingle();
  const opsiTema = tema?.slug ? getThemeOptions(tema.slug) : null;
  const slotTema = opsiTema?.media?.slots;
  // Prinsip yang sama untuk galeri: tema tanpa section `gallery` (sakinah) tak
  // ditawari unggah galeri — fotonya memakan kuota paket tanpa pernah tampil.
  // Tema tanpa `options` → perilaku lama (galeri ditawarkan).
  const showGallery =
    !opsiTema || opsiTema.sections.some((s) => s.id === "gallery");

  // Varian DISPLAY: bingkai penyesuaian bisa diperbesar sampai 4x, dan thumb
  // 400px akan terlihat pecah persis saat pemilik sedang menilai framing.
  const pathSlot = (id: string): string | undefined => {
    if (id === "cover") return content.coverPhoto?.path;
    if (id === "logo")
      return content.category === "corporate" ? content.logo?.path : undefined;
    if (id === "groom")
      return content.category === "wedding"
        ? content.groom?.photo?.path
        : undefined;
    if (id === "bride")
      return content.category === "wedding"
        ? content.bride?.photo?.path
        : undefined;
    return undefined;
  };
  // Foto SAMPUL adalah pengecualian yang disengaja dari aturan "dirakit dari
  // tema": ia selalu dirender `/api/og` sebagai gambar pratinjau tautan
  // WhatsApp, jadi slotnya selalu ada, dan bawaannya memakai rasio KANVAS OG —
  // bingkai penyesuaian di editor = potongan yang dikirim ke WhatsApp. Tema yang
  // JUGA merender sampul di halamannya (`warta`: halaman muka koran) menimpanya
  // lewat `media.slots` — slot temanya menang (urutan di bawah) dan ditandai
  // `inTheme`, supaya editor tak lagi menyebutnya "bukan di halaman undangan".
  const slotSampul = { id: "cover", aspect: OG_ASPECT } as const;
  const photoSlots: PhotoSlots = Object.fromEntries(
    [slotSampul, ...(slotTema ?? [])].map((slot) => {
      const p = pathSlot(slot.id);
      return [
        slot.id,
        {
          aspect: slot.aspect,
          url: p ? storage.getPublicUrl(displayPath(p)) : null,
          ...(slot === slotSampul ? {} : { inTheme: true }),
        },
      ];
    }),
  );

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
          photoSlots={photoSlots}
          music={music}
          video={video}
          initialStep={initialStep}
          showGallery={showGallery}
        />
      ) : content.category === "corporate" ? (
        <CorporateEditor
          invitationId={inv.id}
          slug={inv.slug}
          defaultValues={{ eventDate, content, settings, events }}
          initialMedia={media}
          maxPhotos={maxPhotos}
          songs={songs}
          photoSlots={photoSlots}
          music={music}
          video={video}
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
          photoSlots={photoSlots}
          music={music}
          video={video}
          initialStep={initialStep}
        />
      )}
    </div>
  );
}
