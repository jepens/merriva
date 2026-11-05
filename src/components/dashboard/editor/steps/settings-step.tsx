"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { copy } from "@/lib/copy";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { Field } from "../field";
import { LimitedTextarea } from "../limited-textarea";
import type { EditorValues, SongOption, VideoSlotView } from "../types";
import { VideoField } from "../video-field";

/**
 * Label toggle section. Section KEY "story" menggerbangi LINIMASA (cerita/agenda/
 * doa); labelnya berbeda per kategori → `timelineLabel` (default wedding).
 * `songs` = pustaka lagu aktif (dirakit di server) untuk picker musik latar.
 * `video` = gerbang paket + URL video tersimpan (FASE J, dirakit di server).
 */
export function SettingsStep({
  form,
  invitationId,
  songs,
  video,
  timelineLabel = copy.editor.sections.story,
}: {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  songs: SongOption[];
  video: VideoSlotView;
  timelineLabel?: string;
}) {
  const { register, control } = form;
  const videoValue = useWatch({ control, name: "content.video" });
  const m = copy.editor.music;
  // Pratinjau: lacak pilihan aktif agar `<audio>` menunjuk lagu terpilih.
  const songId = useWatch({ control, name: "settings.songId" });
  const selectedSong = songId
    ? (songs.find((s) => s.id === songId) ?? null)
    : null;
  const sectionToggles = [
    { key: "countdown", label: copy.editor.sections.countdown },
    { key: "gallery", label: copy.editor.sections.gallery },
    { key: "story", label: timelineLabel },
    { key: "envelope", label: copy.editor.sections.envelope },
  ] as const;
  return (
    <div className="space-y-5">
      <Field label={copy.editor.fields.timezone} htmlFor="tz">
        <Select id="tz" {...register("settings.timezone")}>
          <option value="Asia/Jakarta">WIB — Asia/Jakarta</option>
          <option value="Asia/Makassar">WITA — Asia/Makassar</option>
          <option value="Asia/Jayapura">WIT — Asia/Jayapura</option>
        </Select>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox {...register("settings.moderateGuestbook")} />
        {copy.editor.fields.moderateGuestbook}
      </label>

      <div className="space-y-2">
        <Field label={m.label} htmlFor="song">
          <Select
            id="song"
            disabled={songs.length === 0}
            {...register("settings.songId", {
              setValueAs: (v) => (v ? v : undefined),
            })}
          >
            <option value="">{m.none}</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.artist ? `${s.title} — ${s.artist}` : s.title}
              </option>
            ))}
          </Select>
        </Field>
        {songs.length === 0 ? (
          <p className="text-muted-foreground text-xs">{m.empty}</p>
        ) : (
          <p className="text-muted-foreground text-xs">{m.hint}</p>
        )}
        {selectedSong ? (
          <audio
            key={selectedSong.id}
            controls
            preload="none"
            src={selectedSong.url}
            className="w-full"
          />
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">
          {copy.editor.fields.sectionLegend}
        </legend>
        {sectionToggles.map((s) => (
          <label key={s.key} className="flex items-center gap-2 text-sm">
            <Checkbox {...register(`settings.sections.${s.key}`)} />
            {s.label}
          </label>
        ))}
      </fieldset>

      <Field label={copy.editor.fields.greetingOpen}>
        <LimitedTextarea
          form={form}
          name="content.greetingOpen"
          max={L.common.greeting}
        />
      </Field>
      <Field label={copy.editor.fields.greetingClose}>
        <LimitedTextarea
          form={form}
          name="content.greetingClose"
          max={L.common.greeting}
        />
      </Field>
      <VideoField
        invitationId={invitationId}
        allowed={video.allowed}
        value={videoValue}
        initialUrl={video.url}
        initialPosterUrl={video.posterUrl}
        // Tanpa `shouldDirty` — nilai objek yang bisa jadi `undefined` memicu
        // TypeError RHF 7.90 (DECISIONS #108).
        onChange={(next) => form.setValue("content.video", next)}
      >
        <Field label={copy.editor.fields.youtubeUrl}>
          <Input
            placeholder="https://youtu.be/…"
            maxLength={L.common.youtubeUrl}
            {...register("content.youtubeUrl")}
          />
        </Field>
      </VideoField>
      <Field label={copy.editor.fields.livestreamUrl}>
        <Input
          maxLength={L.common.livestreamUrl}
          {...register("content.livestreamUrl")}
        />
      </Field>
    </div>
  );
}
