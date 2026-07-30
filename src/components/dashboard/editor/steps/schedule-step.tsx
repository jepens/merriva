"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";

import { Field } from "../field";
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
              {...register(`events.${i}.name`)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={copy.editor.schedule.start}>
              <Input
                type="datetime-local"
                {...register(`events.${i}.startAt`)}
              />
            </Field>
            <Field label={copy.editor.schedule.end}>
              <Input type="datetime-local" {...register(`events.${i}.endAt`)} />
            </Field>
          </div>
          <Field label={copy.editor.schedule.venue}>
            <Input {...register(`events.${i}.venueName`)} />
          </Field>
          <Field label={copy.editor.schedule.address}>
            <Textarea {...register(`events.${i}.address`)} />
          </Field>
          <Field label={copy.editor.schedule.mapsUrl}>
            <Input
              placeholder="https://maps.google.com/…"
              {...register(`events.${i}.mapsUrl`)}
            />
          </Field>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
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
      </Button>
    </div>
  );
}
