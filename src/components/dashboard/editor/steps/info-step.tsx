"use client";

import type { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";

import { Field } from "../field";
import type { WeddingEditorValues } from "../types";

export function InfoStep({
  form,
}: {
  form: UseFormReturn<WeddingEditorValues>;
}) {
  const { register } = form;
  return (
    <div className="space-y-4">
      <Field label={copy.editor.fields.title} htmlFor="title">
        <Input
          id="title"
          placeholder={copy.editor.fields.titlePlaceholder}
          {...register("content.title")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.editor.fields.groomNickname} htmlFor="groomNick">
          <Input id="groomNick" {...register("content.groom.nickname")} />
        </Field>
        <Field label={copy.editor.fields.brideNickname} htmlFor="brideNick">
          <Input id="brideNick" {...register("content.bride.nickname")} />
        </Field>
      </div>
      <Field
        label={copy.editor.fields.eventDate}
        htmlFor="eventDate"
        hint={copy.editor.slugFixedNote}
      >
        <Input id="eventDate" type="date" {...register("eventDate")} />
      </Field>
    </div>
  );
}
