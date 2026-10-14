"use client";

import type { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { Field } from "../field";
import { PhotoField } from "../photo-field";
import type { EditorValues, NamedPhotoUrls } from "../types";

function PersonFields({
  form,
  side,
  title,
  invitationId,
  photoUrl,
}: {
  form: UseFormReturn<EditorValues>;
  side: "groom" | "bride";
  title: string;
  invitationId: string;
  photoUrl: string | null;
}) {
  const { register, setValue, watch } = form;
  const photoPath = watch(`content.${side}.photo`) as string | undefined;
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
      {/* Hanya PATH yang masuk form; autosave yang menuliskannya ke `content`.
          Tema sudah merendernya sejak lama (fallback monogram bila kosong) —
          yang belum ada justru tombolnya (SPEC §4.4 langkah 2). */}
      <PhotoField
        invitationId={invitationId}
        label={
          side === "groom"
            ? copy.editor.photo.groomLabel
            : copy.editor.photo.brideLabel
        }
        hint={copy.editor.photo.personHint}
        // 4:5 = 0,8. Wadah foto mempelai di keenam tema yang merendernya
        // berkisar 1,24-1,35 (potret); 4:5 adalah yang PALING LEBAR di
        // antaranya, jadi tema hanya memangkas sedikit di sisi dan tak
        // pernah memotong atas-bawah yang berisi wajah.
        aspect={4 / 5}
        value={photoPath}
        initialUrl={photoUrl}
        onChange={(path) =>
          setValue(`content.${side}.photo`, path, { shouldDirty: true })
        }
      />
    </div>
  );
}

export function CoupleStep({
  form,
  invitationId,
  photoUrls,
}: {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  photoUrls: NamedPhotoUrls;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <PersonFields
        form={form}
        invitationId={invitationId}
        photoUrl={photoUrls.groom ?? null}
        side="groom"
        title={copy.editor.fields.groomTitle}
      />
      <PersonFields
        form={form}
        invitationId={invitationId}
        photoUrl={photoUrls.bride ?? null}
        side="bride"
        title={copy.editor.fields.brideTitle}
      />
    </div>
  );
}
