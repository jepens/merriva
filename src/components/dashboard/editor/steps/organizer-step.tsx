"use client";

import type { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";

import { Field } from "../field";
import type { EditorValues } from "../types";

/** Detail corporate: deskripsi acara + narahubung (PIC). */
export function OrganizerStep({ form }: { form: UseFormReturn<EditorValues> }) {
  const { register } = form;
  return (
    <div className="space-y-5">
      <Field label={copy.editor.fields.description}>
        <Textarea
          rows={4}
          placeholder={copy.editor.fields.descriptionPlaceholder}
          {...register("content.description")}
        />
      </Field>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{copy.editor.fields.picTitle}</h3>
        <Field label={copy.editor.fields.picName}>
          <Input {...register("content.pic.name")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={copy.editor.fields.picPhone}>
            <Input {...register("content.pic.phone")} />
          </Field>
          <Field label={copy.editor.fields.picEmail}>
            <Input type="email" {...register("content.pic.email")} />
          </Field>
        </div>
      </div>
    </div>
  );
}
