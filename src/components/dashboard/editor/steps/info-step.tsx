"use client";

import { useMemo } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";
import { slugify, slugSchema } from "@/lib/slug";

import { Field } from "../field";
import { SlugEditor } from "../slug-editor";
import type { EditorValues } from "../types";

export function InfoStep({
  form,
  invitationId,
  slug,
}: {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  slug: string;
}) {
  const { register, control } = form;

  // Saran slug dari nama panggilan mempelai (mis. "rina-dan-bima"). Nilai di-cast
  // karena `content` bertipe union (path ini hanya ada pada anggota wedding).
  const groomNick = useWatch({ control, name: "content.groom.nickname" }) as
    string | undefined;
  const brideNick = useWatch({ control, name: "content.bride.nickname" }) as
    string | undefined;
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
          maxLength={L.wedding.title}
          placeholder={copy.editor.fields.titlePlaceholder}
          {...register("content.title")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.editor.fields.groomNickname} htmlFor="groomNick">
          <Input
            id="groomNick"
            maxLength={L.person.nickname}
            {...register("content.groom.nickname")}
          />
        </Field>
        <Field label={copy.editor.fields.brideNickname} htmlFor="brideNick">
          <Input
            id="brideNick"
            maxLength={L.person.nickname}
            {...register("content.bride.nickname")}
          />
        </Field>
      </div>
      <Field label={copy.editor.fields.eventDate} htmlFor="eventDate">
        <Input
          id="eventDate"
          type="date"
          max="9999-12-31"
          {...register("eventDate")}
        />
      </Field>
    </div>
  );
}
