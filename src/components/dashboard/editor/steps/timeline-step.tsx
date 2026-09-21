"use client";

import {
  useFieldArray,
  type FieldArrayPath,
  type Path,
  type UseFormReturn,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { Field } from "../field";
import { AddButton } from "../add-button";
import { LimitedTextarea } from "../limited-textarea";
import type { EditorValues } from "../types";

/** Path array linimasa per kategori (love story / agenda / doa & harapan). */
export type TimelinePath =
  "content.story" | "content.agenda" | "content.wishes";

/** Batas jumlah entri per daftar linimasa — sama dengan skema server. */
const TIMELINE_MAX: Record<TimelinePath, number> = {
  "content.story": L.wedding.story,
  "content.agenda": L.corporate.agenda,
  "content.wishes": L.family.wishes,
};

export interface TimelineLabels {
  add: string;
  item: string;
  empty: string;
  title: string;
  date: string;
  datePlaceholder: string;
  narrative: string;
}

/**
 * Step linimasa generik — satu struktur (judul, tanggal, narasi) yang dipakai
 * ketiga kategori dengan `name` (field array) + `labels` berbeda. Menggantikan
 * story-step wedding. `content.story|agenda|wishes` semuanya `StoryEntry[]`.
 */
export function TimelineStep({
  form,
  name,
  labels,
}: {
  form: UseFormReturn<EditorValues>;
  name: TimelinePath;
  labels: TimelineLabels;
}) {
  const { register, control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<EditorValues>,
  });

  // Path template di-cast: `name` union literal → gabungan path valid di union.
  const path = (i: number, field: "title" | "date" | "narrative") =>
    `${name}.${i}.${field}` as Path<EditorValues>;

  return (
    <div className="space-y-4">
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.empty}</p>
      ) : null}

      {fields.map((field, i) => (
        <div key={field.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {labels.item} {i + 1}
            </span>
            <Button variant="ghost" size="sm" onClick={() => remove(i)}>
              {copy.editor.list.remove}
            </Button>
          </div>
          <Field label={labels.title}>
            <Input
              maxLength={L.storyEntry.title}
              {...register(path(i, "title"))}
            />
          </Field>
          <Field label={labels.date}>
            <Input
              placeholder={labels.datePlaceholder}
              maxLength={L.storyEntry.date}
              {...register(path(i, "date"))}
            />
          </Field>
          <Field label={labels.narrative}>
            <LimitedTextarea
              form={form}
              name={path(i, "narrative")}
              max={L.storyEntry.narrative}
            />
          </Field>
        </div>
      ))}

      <AddButton
        count={fields.length}
        max={TIMELINE_MAX[name]}
        onAdd={() => append({ title: "", date: "", narrative: "" })}
      >
        {labels.add}
      </AddButton>
    </div>
  );
}
