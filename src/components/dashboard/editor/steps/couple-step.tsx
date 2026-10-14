"use client";

import type { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import type { Photo } from "@/lib/validation/content";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { Field } from "../field";
import { PhotoField } from "../photo-field";
import type { EditorValues, PhotoSlots, PhotoSlotView } from "../types";

function PersonFields({
  form,
  side,
  title,
  invitationId,
  slot,
}: {
  form: UseFormReturn<EditorValues>;
  side: "groom" | "bride";
  title: string;
  invitationId: string;
  /** `undefined` = tema aktif tak merender foto pihak ini. */
  slot: PhotoSlotView | undefined;
}) {
  const { register, setValue, watch } = form;
  const photo = watch(`content.${side}.photo`) as Photo | undefined;
  return (
    <div className="space-y-3">
      <h3 className="font-medium">{title}</h3>
      <Field label={copy.editor.fields.fullName}>
        <Input
          maxLength={L.person.name}
          {...register(`content.${side}.name`)}
        />
      </Field>
      <Field label={copy.editor.fields.fatherName}>
        <Input
          maxLength={L.person.fatherName}
          {...register(`content.${side}.fatherName`)}
        />
      </Field>
      <Field label={copy.editor.fields.motherName}>
        <Input
          maxLength={L.person.motherName}
          {...register(`content.${side}.motherName`)}
        />
      </Field>
      <Field label={copy.editor.fields.childOrder}>
        <Input
          placeholder={copy.editor.fields.childOrderPlaceholder}
          maxLength={L.person.childOrder}
          {...register(`content.${side}.childOrder`)}
        />
      </Field>
      {/* Bidangnya hanya muncul bila TEMA AKTIF memang merender foto ini, dan
          rasio bingkainya datang dari tema itu juga (THEME-CONTRACT §2).
          Yang masuk form hanya `{ path, x, y, zoom }`; autosave yang
          menuliskannya ke `content`. */}
      {slot ? (
        <PhotoField
          invitationId={invitationId}
          label={
            side === "groom"
              ? copy.editor.photo.groomLabel
              : copy.editor.photo.brideLabel
          }
          hint={copy.editor.photo.personHint}
          aspect={slot.aspect}
          value={photo}
          initialUrl={slot.url}
          onChange={(next) =>
            setValue(`content.${side}.photo`, next, { shouldDirty: true })
          }
        />
      ) : null}
    </div>
  );
}

export function CoupleStep({
  form,
  invitationId,
  photoSlots,
}: {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  photoSlots: PhotoSlots;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <PersonFields
        form={form}
        invitationId={invitationId}
        slot={photoSlots.groom}
        side="groom"
        title={copy.editor.fields.groomTitle}
      />
      <PersonFields
        form={form}
        invitationId={invitationId}
        slot={photoSlots.bride}
        side="bride"
        title={copy.editor.fields.brideTitle}
      />
    </div>
  );
}
