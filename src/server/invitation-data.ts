import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { copy } from "@/lib/copy";
import { sesuaikanKePaket } from "@/lib/customizer/resolve";
import type { ThemeOptions } from "@/lib/customizer/theme-options";
import { parseContentForRender } from "@/lib/invitation-content";
import { displayPath, isCustomMusicPath, toMediaView } from "@/lib/media";
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

/**
 * Path musik unggahan undangan ini yang objeknya MASIH HIDUP menurut
 * `music_uploads` (DECISIONS #121) — syarat perakit render memutar
 * `content.customMusic`. `content` bisa merujuk objek yang sudah tiada:
 * takedown lalu kunci dibuka (tab editor lama menulis rujukannya kembali), atau
 * autosave yang tertunda melewati 24 jam sehingga cron sudah menyapu objeknya.
 * Tanpa syarat ini tamu memutar URL 404, bukan lagu pustaka.
 *
 * `music_uploads` HANYA service_role (RLS tanpa policy): pemanggil memakai
 * admin client, dan di jalur pemilik baru SESUDAH kepemilikan undangan
 * terverifikasi lewat client pemilik.
 */
export async function liveCustomMusicPaths(
  client: SupabaseClient<Database>,
  invitationId: string,
): Promise<string[]> {
  // Galat DB DILEMPAR (DECISIONS #45): kedipan DB tak boleh di-cache ISR
  // sebagai undangan yang musik unggahannya "tak hidup".
  const rows = dataOrThrow(
    await client
      .from("music_uploads")
      .select("path")
      .eq("invitation_id", invitationId)
      .is("removed_at", null),
    "music_uploads",
  );
  return (rows ?? []).map((r) => r.path);
}

function isHttpsUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function buildInvitationData(args: {
  /** Id undangan — pengikat path musik unggahan (`isCustomMusicPath`). */
  invitationId: string;
  slug: string;
  category: InvitationCategory;
  content: unknown;
  settings: unknown;
  eventDate: string | null;
  eventRows: EventRow[];
  mediaRows: MediaRow[];
  watermark: boolean;
  /** `limits.youtube` paket — flag fitur video untuk KEDUA sumber (FASE J). */
  videoAllowed: boolean;
  /** `limits.maxPhotos` paket — jumlah foto galeri yang BOLEH tampil (#116). */
  maxPhotos: number;
  /** Options tema undangan ini; `null` = tema tanpa kustomisasi. */
  themeOptions: ThemeOptions | null;
  /** Lagu pustaka terpilih (`resolveMusic`). Kalah oleh musik unggahan yang sah. */
  music: InvitationData["music"];
  /** `invitations.music_locked_at` terisi — musik unggahan dikunci admin. */
  musicLocked: boolean;
  /** `liveCustomMusicPaths` — objek musik unggahan yang belum dihapus. */
  liveMusicPaths: readonly string[];
}): InvitationData {
  // Premium = tanpa watermark — konvensi gerbang Premium yang sama dengan aksi
  // Tampilan (DECISIONS #13).
  const premium = !args.watermark;

  const settingsParsed = settingsSchema.safeParse(args.settings);
  const parsedSettings = settingsParsed.success
    ? settingsParsed.data
    : DEFAULT_SETTINGS;
  // "Yang tampil = yang dibayar" (DECISIONS #116): kustomisasi di luar paket
  // yang berlaku SEKARANG kembali ke bawaan tema — satu titik untuk halaman
  // publik & pratinjau, data tersimpan tak disentuh.
  const settings =
    parsedSettings.custom && args.themeOptions
      ? {
          ...parsedSettings,
          custom: sesuaikanKePaket(
            args.themeOptions,
            parsedSettings.custom,
            premium,
          ),
        }
      : parsedSettings;
  const parsed = parseContentForRender(args.content, args.category);
  // Gerbang paket untuk video, SATU titik untuk halaman publik & pratinjau:
  // paket tanpa fitur video tak menerima video unggahan maupun tautan YouTube,
  // walau `content` menyimpannya (mis. tersimpan sebelum turun paket, atau
  // ditulis langsung lewat autosave). Tautan dibuang dari `content` juga —
  // bukan hanya `video` di-null-kan — karena tema membaca `youtubeUrl` dari
  // sana; tanpa ini lubang penegakan `limits.youtube` tetap terbuka.
  const gated = args.videoAllowed
    ? parsed
    : { ...parsed, youtubeUrl: undefined, video: undefined };
  // Live streaming: fitur Premium (SPEC §2) dan hanya URL https — skema draft
  // sengaja longgar saat mengetik (hanya menolak skema berbahaya), jadi bentuk
  // tautannya dipastikan di sini sebelum menjadi `href` di tema.
  const content =
    premium && isHttpsUrl(gated.livestreamUrl)
      ? gated
      : { ...gated, livestreamUrl: undefined };

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
  // Hanya N foto pertama sesuai paket (urutan galeri pemilik) — foto di atas
  // batas tetap tersimpan dan kembali tampil saat naik paket (#116).
  const media: InvitationMediaView[] = args.mediaRows
    .slice(0, Math.max(0, args.maxPhotos))
    .map((r) => toMediaView(r, (p) => storage.getPublicUrl(p)));

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

  // Video unggahan → URL domain sendiri (path objek penuh, bukan prefix).
  const v = content.video;
  const video = v
    ? {
        url: storage.getPublicUrl(v.path),
        posterUrl: v.poster ? storage.getPublicUrl(v.poster) : null,
        width: v.width,
        height: v.height,
      }
    : null;

  // Musik unggahan (DECISIONS #121) — gerbang SATU titik untuk halaman publik &
  // pratinjau, pola yang sama dengan video: hanya Premium, tidak dikunci admin,
  // path-nya benar-benar objek milik undangan INI (`content` ditulis klien;
  // path undangan lain atau bentuk asing diabaikan), DAN objeknya masih hidup
  // menurut `music_uploads` (rujukan basi sesudah takedown + buka kunci, atau
  // objek yang sudah disapu cron, akan memutar 404). Gagal gerbang → lagu
  // pustaka. Rujukannya TIDAK dihapus saat turun paket (diputar lagi bila naik
  // paket); takedown yang membuang rujukan + objeknya, dan kunci menahan
  // rujukan yang ditulis ulang tab editor lama. Rujukan rusak sudah gugur jadi
  // `undefined` di skema (`.catch` di `commonContentFields`).
  //
  // Judulnya SELALU label generik: `name` adalah nama berkas asli di perangkat
  // pemilik (bisa memuat nama orang, "unduhan-yt", dsb.) — hanya untuk editor,
  // tak pernah dikirim ke tamu. Karena itu juga `customMusic` dibuang dari
  // `content` yang diterima tema: tema tak membacanya, dan tanpa ini nama
  // berkas ikut payload halaman publik begitu sebuah tema meneruskan
  // `content` ke komponen klien.
  const customMusic = content.customMusic;
  const music =
    premium &&
    !args.musicLocked &&
    customMusic &&
    isCustomMusicPath(args.invitationId, customMusic.path) &&
    args.liveMusicPaths.includes(customMusic.path)
      ? {
          url: storage.getPublicUrl(customMusic.path),
          title: copy.editor.customMusic.unnamed,
        }
      : args.music;

  return {
    slug: args.slug,
    category: args.category,
    eventDate: args.eventDate,
    content: { ...content, customMusic: undefined },
    settings,
    events,
    media,
    coverPhoto,
    groomPhoto,
    bridePhoto,
    video,
    music,
    watermark: args.watermark,
  };
}
