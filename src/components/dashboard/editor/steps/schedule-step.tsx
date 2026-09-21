"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { Field } from "../field";
import { AddButton } from "../add-button";
import { LimitedTextarea } from "../limited-textarea";
import type { EditorValues } from "../types";

export function ScheduleStep({ form }: { form: UseFormReturn<EditorValues> }) {
  const { register, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "events" });

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {copy.editor.schedule.tzHint}
      </p>

      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {copy.editor.schedule.empty}
        </p>
      ) : null}

      {fields.map((field, i) => (
        <div key={field.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {copy.editor.schedule.session} {i + 1}
            </span>
            <Button variant="ghost" size="sm" onClick={() => remove(i)}>
              {copy.editor.list.remove}
            </Button>
          </div>
          <Field label={copy.editor.schedule.name}>
            <Input
              placeholder={copy.editor.schedule.namePlaceholder}
              maxLength={L.event.name}
              {...register(`events.${i}.name`)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={copy.editor.schedule.start}>
              <Input
                type="datetime-local"
                max="9999-12-31T23:59"
                {...register(`events.${i}.startAt`)}
              />
            </Field>
            <Field label={copy.editor.schedule.end}>
              <Input
                type="datetime-local"
                max="9999-12-31T23:59"
                {...register(`events.${i}.endAt`)}
              />
            </Field>
          </div>
          <Field label={copy.editor.schedule.venue}>
            <Input
              maxLength={L.event.venueName}
              {...register(`events.${i}.venueName`)}
            />
          </Field>
          <Field label={copy.editor.schedule.address}>
            <LimitedTextarea
              form={form}
              name={`events.${i}.address`}
              max={L.event.address}
            />
          </Field>
          <Field label={copy.editor.schedule.mapsUrl}>
            <Input
              placeholder="https://maps.google.com/…"
              maxLength={L.event.mapsUrl}
              {...register(`events.${i}.mapsUrl`)}
            />
          </Field>
        </div>
      ))}

      <AddButton
        count={fields.length}
        max={L.event.sessions}
        onAdd={() =>
          append({
            name: "",
            startAt: "",
            endAt: "",
            venueName: "",
            address: "",
            mapsUrl: "",
          })
        }
      >
        {copy.editor.schedule.add}
      </AddButton>
    </div>
  );
}
