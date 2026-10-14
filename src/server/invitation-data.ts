import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { copy } from "@/lib/copy";
import { parseContentForRender } from "@/lib/invitation-content";
import { displayPath, toMediaView } from "@/lib/media";
import { scheduledEvents } from "@/lib/schedule";
import { getStorage } from "@/lib/storage";
import { dataOrThrow } from "@/lib/supabase/result";
import { DEFAULT_SETTINGS, settingsSchema } from "@/lib/validation/content";
import type { Photo } from "@/lib/validation/content";
import type { InvitationCategory } from "@/types";
import type { Database } from "@/types/database";
import type {
  InvitationData,
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

/**
 * Perakit `InvitationData` (kontrak tema, SPEC §7.1) dari baris DB. Dipakai oleh
 * halaman preview (M1.5) dan kelak halaman publik `/{slug}` (M2). Tema TIDAK
 * mengambil data sendiri — semua di-parse & di-resolve di sini (URL media =
 * domain sendiri via `getStorage`). Parsing konten (pure) ada di
 * `lib/invitation-content.ts`.
 */

interface EventRow {
  id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  address: string | null;
  maps_url: string | null;
}

interface MediaRow {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
}

/**
 * Resolusi musik latar terpilih (`settings.songId` → `songs`) menjadi URL domain
 * sendiri. NULL bila tak dipilih / lagu nonaktif / tak ada. Dipakai halaman
 * publik (M2) & pratinjau. (Library lagu diisi kemudian — SPEC §5; sampai itu
 * hasil praktisnya null.)
 */
export async function resolveMusic(
  client: SupabaseClient<Database>,
  songId: string | null | undefined,
): Promise<InvitationData["music"]> {
  if (!songId) return null;
  // Galat DB DILEMPAR (DECISIONS #45): lagu yang tak ada/nonaktif = tanpa musik,
  // tetapi kedipan DB tak boleh di-cache ISR sebagai undangan tanpa musik.
  const data = dataOrThrow(
    await client
      .from("songs")
      .select("title, storage_path, is_active")
      .eq("id", songId)
      .maybeSingle(),
    "songs",
  );
  if (!data || !data.is_active || !data.storage_path) return null;
  return {
    url: getStorage().getPublicUrl(data.storage_path),
    title: data.title,
  };
}

export function buildInvitationData(args: {
  slug: string;
  category: InvitationCategory;
  content: unknown;
  settings: unknown;
  eventDate: string | null;
  eventRows: EventRow[];
  mediaRows: MediaRow[];
  watermark: boolean;
  music: InvitationData["music"];
}): InvitationData {
  const settingsParsed = settingsSchema.safeParse(args.settings);
  const settings = settingsParsed.success
    ? settingsParsed.data
    : DEFAULT_SETTINGS;
  const content = parseContentForRender(args.content, args.category);

  // Hanya sesi BERJAM yang sampai ke tema (DECISIONS #42): sesi draft tanpa jam
  // tersimpan agar isian pemilik tak hilang, tetapi tak pernah tampil ke tamu.
  // Disaring di sini — satu titik untuk halaman publik & pratinjau — sehingga
  // kontrak tema tak berubah dan `events[0]` selalu sesi terjadwal pertama
  // (label tanggal hero & hitung mundur di ke-10 tema).
  const events: InvitationEventView[] = scheduledEvents(args.eventRows).map(
    (e) => ({
      id: e.id,
      name: e.name.trim() || copy.public.eventFallbackName,
      startAt: e.start_at,
      endAt: e.end_at,
      venueName: e.venue_name,
      address: e.address,
      mapsUrl: e.maps_url,
    }),
  );

  const storage = getStorage();
  const media: InvitationMediaView[] = args.mediaRows.map((r) =>
    toMediaView(r, (p) => storage.getPublicUrl(p)),
  );

  // Foto bernama (sampul/mempelai) → URL domain sendiri (SPEC §6.4: tema tak
  // pernah menerima storage_path mentah untuk foto ini). Mempelai hanya untuk
  // kategori wedding; coverPhoto berlaku semua kategori.
  //
  // Yang disimpan di `content` adalah PREFIX 2-varian, sama seperti
  // `media.storage_path` — bukan path objek. Satu bentuk untuk semua foto
  // membuat penghapusan retensi bisa memakai jalur yang sama
  // (`mediaObjectPaths`), dan itulah yang menutup lubang di migrasi
  // 20261014120000. Tema diberi varian DISPLAY: foto mempelai ada di bawah
  // lipatan (tak memengaruhi LCP) dan wajah manusia yang pecah lebih mahal
  // daripada byte-nya. Varian thumb dipakai pratinjau 80px di editor.
  const resolve = (p?: Photo) =>
    p
      ? {
          url: storage.getPublicUrl(displayPath(p.path)),
          x: p.x,
          y: p.y,
          zoom: p.zoom,
        }
      : null;
  const coverPhoto = resolve(content.coverPhoto);
  const groomPhoto =
    content.category === "wedding" ? resolve(content.groom.photo) : null;
  const bridePhoto =
    content.category === "wedding" ? resolve(content.bride.photo) : null;

  return {
    slug: args.slug,
    category: args.category,
    eventDate: args.eventDate,
    content,
    settings,
    events,
    media,
    coverPhoto,
    groomPhoto,
    bridePhoto,
    music: args.music,
    watermark: args.watermark,
  };
}
