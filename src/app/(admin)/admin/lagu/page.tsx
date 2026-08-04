import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminAddSongAction,
  adminDeleteSongAction,
  adminToggleSongAction,
} from "@/server/actions/admin-songs";

export const metadata: Metadata = { title: copy.admin.songs.title };

const c = copy.admin.songs;
const fieldClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm";
const labelClass = "text-muted-foreground text-xs";

interface SongRow {
  id: string;
  title: string;
  artist: string | null;
  storage_path: string;
  is_active: boolean;
}

export default async function AdminSongsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;
  const msgText =
    msg && msg in copy.admin.msg
      ? copy.admin.msg[msg as keyof typeof copy.admin.msg]
      : null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("songs")
    .select("id, title, artist, storage_path, is_active")
    .order("title", { ascending: true });
  const songs = (data ?? []) as SongRow[];
  const storage = getStorage();

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
        <p className="text-muted-foreground text-sm">{c.subtitle}</p>
      </div>

      {msgText ? (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            msg === "song_ok" || msg === "song_deleted"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {msgText}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{c.addTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {c.licenseNote}
          </p>
          <form action={adminAddSongAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className={labelClass}>{c.fieldTitle}</span>
                <input
                  name="title"
                  className={fieldClass}
                  required
                  maxLength={120}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>{c.fieldArtist}</span>
                <input name="artist" className={fieldClass} maxLength={120} />
              </label>
            </div>
            <label className="space-y-1">
              <span className={labelClass}>{c.fieldFile}</span>
              <input
                type="file"
                name="file"
                accept="audio/*"
                className="text-sm"
                required
              />
            </label>
            <Button type="submit" size="sm">
              {c.add}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{c.listTitle}</h2>
      </div>

      {songs.length === 0 ? (
        <p className="text-muted-foreground text-sm">{c.empty}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {songs.map((song) => (
            <Card key={song.id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{song.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {song.artist ?? copy.admin.common.dash}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      song.is_active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {song.is_active ? c.active : c.inactive}
                  </span>
                </div>

                {/* Pratinjau audio musik latar. */}
                <audio
                  controls
                  preload="none"
                  src={storage.getPublicUrl(song.storage_path)}
                  className="w-full"
                />

                <div className="flex items-center gap-2">
                  <form action={adminToggleSongAction.bind(null, song.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      {song.is_active ? c.deactivate : c.activate}
                    </Button>
                  </form>
                  <form action={adminDeleteSongAction.bind(null, song.id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      {c.delete}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
