"use client";

import type { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";

import { Field } from "../field";
import type { WeddingEditorValues } from "../types";

function PersonFields({
  form,
  side,
  title,
}: {
  form: UseFormReturn<WeddingEditorValues>;
  side: "groom" | "bride";
  title: string;
}) {
  const { register } = form;
  return (
    <div className="space-y-3">
      <h3 className="font-medium">{title}</h3>
      <Field label={copy.editor.fields.fullName}>
        <Input {...register(`content.${side}.name`)} />
      </Field>
      <Field label={copy.editor.fields.fatherName}>
        <Input {...register(`content.${side}.fatherName`)} />
      </Field>
      <Field label={copy.editor.fields.motherName}>
        <Input {...register(`content.${side}.motherName`)} />
      </Field>
      <Field label={copy.editor.fields.childOrder}>
        <Input
          placeholder={copy.editor.fields.childOrderPlaceholder}
          {...register(`content.${side}.childOrder`)}
        />
      </Field>
    </div>
  );
}

export function CoupleStep({
  form,
}: {
  form: UseFormReturn<WeddingEditorValues>;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <PersonFields
        form={form}
        side="groom"
        title={copy.editor.fields.groomTitle}
      />
      <PersonFields
        form={form}
        side="bride"
        title={copy.editor.fields.brideTitle}
      />
    </div>
  );
}
