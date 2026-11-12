"use client";

import { useContext } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { copy } from "@/lib/copy";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { EditorUploadContext } from "../editor-shell";
import { Field } from "../field";
import { LimitedTextarea } from "../limited-textarea";
import { MusicField } from "../music-field";
import type {
  EditorValues,
  MusicSlotView,
  SongOption,
  VideoSlotView,
} from "../types";
import { VideoField } from "../video-field";

/**
 * Label toggle section. Section KEY "story" menggerbangi LINIMASA (cerita/agenda/
 * doa); labelnya berbeda per kategori → `timelineLabel` (default wedding).
 * `songs` = pustaka lagu aktif (dirakit di server) untuk picker musik latar.
 * `music` = gerbang Premium + kunci admin + path & URL lagu sendiri yang masih
 * hidup (DECISIONS #121); status unggahnya diteruskan ke kerangka editor lewat
 * `EditorUploadContext`.
 * `video` = gerbang paket + URL video tersimpan (FASE J, dirakit di server).
 */
export function SettingsStep({
  form,
  invitationId,
  songs,
  music,
  video,
  timelineLabel = copy.editor.sections.story,
}: {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  songs: SongOption[];
  music: MusicSlotView;
  video: VideoSlotView;
  timelineLabel?: string;
}) {
  const { register, control } = form;
  // Unggahan lagu yang sedang berjalan menahan "Selesai" di kerangka editor.
  const onUploadingChange = useContext(EditorUploadContext);
  const videoValue = useWatch({ control, name: "content.video" });
  const kutipan = useWatch({ control, name: "content.quote.text" }) as
    string | undefined;
  const customMusicValue = useWatch({ control, name: "content.customMusic" });
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

      <MusicField
        invitationId={invitationId}
        allowed={music.allowed}
        lockedAt={music.lockedAt}
        value={customMusicValue}
        initialPath={music.path}
        initialUrl={music.url}
        // Tanpa `shouldDirty`, sama seperti video (DECISIONS #108).
        onChange={(next) => form.setValue("content.customMusic", next)}
        onBusyChange={onUploadingChange}
      />

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
      {/* Kutipan ayat/quote (SPEC §4.4 langkah 7, DECISIONS #133) — dirender
          semua tema yang punya bagian kutipan; dulu tak ada isiannya sama sekali. */}
      <Field label={copy.editor.fields.quoteText}>
        <LimitedTextarea
          form={form}
          name="content.quote.text"
          max={L.quote.text}
        />
      </Field>
      <Field label={copy.editor.fields.quoteSource}>
        <Input
          placeholder={copy.editor.fields.quoteSourcePlaceholder}
          maxLength={L.quote.source}
          {...register("content.quote.source")}
        />
      </Field>
      {/* Hanya selama kutipan masih kosong — tak pernah menimpa ketikan. */}
      {!kutipan?.trim() ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            form.setValue(
              "content.quote.text",
              copy.editor.fields.quotePresetText,
            );
            form.setValue(
              "content.quote.source",
              copy.editor.fields.quotePresetSource,
            );
          }}
        >
          {copy.editor.fields.quotePreset}
        </Button>
      ) : null}
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
      <Field
        label={copy.editor.fields.livestreamUrl}
        hint={copy.editor.fields.livestreamHint}
      >
        <Input
          placeholder={copy.editor.fields.livestreamPlaceholder}
          maxLength={L.common.livestreamUrl}
          {...register("content.livestreamUrl")}
        />
      </Field>
    </div>
  );
}
