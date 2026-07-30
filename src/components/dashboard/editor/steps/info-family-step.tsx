"use client";

import { useMemo } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { slugify, slugSchema } from "@/lib/slug";

import { Field } from "../field";
import { SlugEditor } from "../slug-editor";
import type { EditorValues } from "../types";

/** Info dasar family: alamat + nama acara + yang merayakan + orang tua + tanggal. */
export function InfoFamilyStep({
  form,
  invitationId,
  slug,
}: {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  slug: string;
}) {
  const { register, control } = form;
  const eventName = useWatch({ control, name: "content.eventName" }) as
    string | undefined;
  const suggestion = useMemo(() => {
    const s = slugify(eventName ?? "");
    return slugSchema.safeParse(s).success ? s : undefined;
  }, [eventName]);

  return (
    <div className="space-y-4">
      <SlugEditor
        invitationId={invitationId}
        initialSlug={slug}
        suggestion={suggestion}
      />
      <Field label={copy.editor.fields.eventName} htmlFor="eventName">
        <Input
          id="eventName"
          placeholder={copy.editor.fields.eventNamePlaceholder}
          {...register("content.eventName")}
        />
      </Field>
      <Field label={copy.editor.fields.celebrant} htmlFor="celebrant">
        <Input
          id="celebrant"
          placeholder={copy.editor.fields.celebrantPlaceholder}
          {...register("content.celebrant")}
        />
      </Field>
      <Field label={copy.editor.fields.parents} htmlFor="parents">
        <Input
          id="parents"
          placeholder={copy.editor.fields.parentsPlaceholder}
          {...register("content.parents")}
        />
      </Field>
      <Field label={copy.editor.fields.eventDate} htmlFor="eventDate">
        <Input id="eventDate" type="date" {...register("eventDate")} />
      </Field>
    </div>
  );
}
