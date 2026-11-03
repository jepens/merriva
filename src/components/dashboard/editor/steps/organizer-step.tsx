"use client";

import type { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import type { Photo } from "@/lib/validation/content";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { Field } from "../field";
import { LimitedTextarea } from "../limited-textarea";
import { PhotoField } from "../photo-field";
import type { EditorValues, PhotoSlotView } from "../types";

/** Detail corporate: logo perusahaan + deskripsi acara + narahubung (PIC). */
export function OrganizerStep({
  form,
  invitationId,
  logoSlot,
}: {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  /** `undefined` = tema aktif tak merender logo. */
  logoSlot: PhotoSlotView | undefined;
}) {
  const { register, setValue, watch } = form;
  const logo = watch("content.logo") as Photo | undefined;
  return (
    <div className="space-y-5">
      {logoSlot ? (
        <PhotoField
          invitationId={invitationId}
          label={copy.editor.photo.logoLabel}
          hint={copy.editor.photo.logoHint}
          aspect={logoSlot.aspect}
          value={logo}
          initialUrl={logoSlot.url}
          // Tanpa `shouldDirty` — lihat couple-step.tsx (TypeError RHF 7.90).
          onChange={(next) => setValue("content.logo", next)}
        />
      ) : null}

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
