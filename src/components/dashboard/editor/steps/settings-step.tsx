"use client";

import type { UseFormReturn } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";

import { Field } from "../field";
import type { EditorValues } from "../types";

/**
 * Label toggle section. Section KEY "story" menggerbangi LINIMASA (cerita/agenda/
 * doa); labelnya berbeda per kategori → `timelineLabel` (default wedding).
 */
export function SettingsStep({
  form,
  timelineLabel = copy.editor.sections.story,
}: {
  form: UseFormReturn<EditorValues>;
  timelineLabel?: string;
}) {
  const { register } = form;
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
        <Textarea {...register("content.greetingOpen")} />
      </Field>
      <Field label={copy.editor.fields.greetingClose}>
        <Textarea {...register("content.greetingClose")} />
      </Field>
      <Field label={copy.editor.fields.youtubeUrl}>
        <Input
          placeholder="https://youtu.be/…"
          {...register("content.youtubeUrl")}
        />
      </Field>
      <Field label={copy.editor.fields.livestreamUrl}>
        <Input {...register("content.livestreamUrl")} />
      </Field>
    </div>
  );
}
