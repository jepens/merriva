"use client";

import type { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { Field } from "../field";
import { LimitedTextarea } from "../limited-textarea";
import { PhotoField } from "../photo-field";
import type { EditorValues } from "../types";

/** Detail corporate: logo perusahaan + deskripsi acara + narahubung (PIC). */
export function OrganizerStep({
  form,
  invitationId,
  logoUrl,
}: {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  logoUrl: string | null;
}) {
  const { register, setValue, watch } = form;
  const logoPath = watch("content.logo") as string | undefined;
  return (
    <div className="space-y-5">
      <PhotoField
        invitationId={invitationId}
        label={copy.editor.photo.logoLabel}
        hint={copy.editor.photo.logoHint}
        value={logoPath}
        initialUrl={logoUrl}
        onChange={(path) =>
          setValue("content.logo", path, { shouldDirty: true })
        }
      />

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
