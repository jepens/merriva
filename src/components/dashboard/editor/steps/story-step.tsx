"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";

import { Field } from "../field";
import type { WeddingEditorValues } from "../types";

export function StoryStep({
  form,
}: {
  form: UseFormReturn<WeddingEditorValues>;
}) {
  const { register, control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "content.story",
  });

  return (
    <div className="space-y-4">
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {copy.editor.list.storyEmpty}
        </p>
      ) : null}

      {fields.map((field, i) => (
        <div key={field.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {copy.editor.list.storyItem} {i + 1}
            </span>
            <Button variant="ghost" size="sm" onClick={() => remove(i)}>
              {copy.editor.list.remove}
            </Button>
          </div>
          <Field label={copy.editor.fields.storyTitle}>
            <Input {...register(`content.story.${i}.title`)} />
          </Field>
          <Field label={copy.editor.fields.storyDate}>
            <Input
              placeholder={copy.editor.fields.storyDatePlaceholder}
              {...register(`content.story.${i}.date`)}
            />
          </Field>
          <Field label={copy.editor.fields.storyNarrative}>
            <Textarea {...register(`content.story.${i}.narrative`)} />
          </Field>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => append({ title: "", date: "", narrative: "" })}
      >
        {copy.editor.list.addStory}
      </Button>
    </div>
  );
}
