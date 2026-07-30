"use client";

import { useMemo } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { slugify, slugSchema } from "@/lib/slug";

import { Field } from "../field";
import { SlugEditor } from "../slug-editor";
import type { EditorValues } from "../types";

/** Info dasar corporate: alamat + nama acara + penyelenggara + tanggal. */
export function InfoCorporateStep({
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
      <Field label={copy.editor.fields.organizer} htmlFor="organizer">
        <Input
          id="organizer"
          placeholder={copy.editor.fields.organizerPlaceholder}
          {...register("content.organizer")}
        />
      </Field>
      <Field label={copy.editor.fields.eventDate} htmlFor="eventDate">
        <Input id="eventDate" type="date" {...register("eventDate")} />
      </Field>
    </div>
  );
}
