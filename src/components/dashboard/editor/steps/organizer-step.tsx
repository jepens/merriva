"use client";

import type { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { Field } from "../field";
import { LimitedTextarea } from "../limited-textarea";
import type { EditorValues } from "../types";

/** Detail corporate: deskripsi acara + narahubung (PIC). */
export function OrganizerStep({ form }: { form: UseFormReturn<EditorValues> }) {
  const { register } = form;
  return (
    <div className="space-y-5">
      <Field label={copy.editor.fields.description}>
        <LimitedTextarea
          form={form}
          name="content.description"
          max={L.corporate.description}
          rows={4}
          placeholder={copy.editor.fields.descriptionPlaceholder}
        />
      </Field>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{copy.editor.fields.picTitle}</h3>
        <Field label={copy.editor.fields.picName}>
          <Input maxLength={L.pic.name} {...register("content.pic.name")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={copy.editor.fields.picPhone}>
            <Input maxLength={L.pic.phone} {...register("content.pic.phone")} />
          </Field>
          <Field label={copy.editor.fields.picEmail}>
            <Input
              type="email"
              maxLength={L.pic.email}
              {...register("content.pic.email")}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
