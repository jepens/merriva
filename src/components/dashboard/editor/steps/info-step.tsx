"use client";

import { useMemo } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { slugify, slugSchema } from "@/lib/slug";

import { Field } from "../field";
import { SlugEditor } from "../slug-editor";
import type { WeddingEditorValues } from "../types";

export function InfoStep({
  form,
  invitationId,
  slug,
}: {
  form: UseFormReturn<WeddingEditorValues>;
  invitationId: string;
  slug: string;
}) {
  const { register, control } = form;

  // Saran slug dari nama panggilan mempelai (mis. "rina-dan-bima").
  const groomNick = useWatch({ control, name: "content.groom.nickname" });
  const brideNick = useWatch({ control, name: "content.bride.nickname" });
  const suggestion = useMemo(() => {
    const base = [groomNick, brideNick].filter(Boolean).join("-dan-");
    const s = slugify(base);
    // Hanya tawarkan saran yang benar-benar lolos aturan slug (mis. bukan kata
    // terpesan / awalan draft- / terlalu pendek) agar klik saran tak berujung error.
    return slugSchema.safeParse(s).success ? s : undefined;
  }, [groomNick, brideNick]);

  return (
    <div className="space-y-4">
      <SlugEditor
        invitationId={invitationId}
        initialSlug={slug}
        suggestion={suggestion}
      />
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
      <Field label={copy.editor.fields.eventDate} htmlFor="eventDate">
        <Input id="eventDate" type="date" {...register("eventDate")} />
      </Field>
    </div>
  );
}
