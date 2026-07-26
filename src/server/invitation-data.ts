import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseContentForRender } from "@/lib/invitation-content";
import { toMediaView } from "@/lib/media";
import { getStorage } from "@/lib/storage";
import { DEFAULT_SETTINGS, settingsSchema } from "@/lib/validation/content";
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
  start_at: string;
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
  const { data } = await client
    .from("songs")
    .select("title, storage_path, is_active")
    .eq("id", songId)
    .maybeSingle();
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

  const events: InvitationEventView[] = args.eventRows.map((e) => ({
    id: e.id,
    name: e.name,
    startAt: e.start_at,
    endAt: e.end_at,
    venueName: e.venue_name,
    address: e.address,
    mapsUrl: e.maps_url,
  }));

  const storage = getStorage();
  const media: InvitationMediaView[] = args.mediaRows.map((r) =>
    toMediaView(r, (p) => storage.getPublicUrl(p)),
  );

  return {
    slug: args.slug,
    category: args.category,
    eventDate: args.eventDate,
    content,
    settings,
    events,
    media,
    music: args.music,
    watermark: args.watermark,
  };
}
