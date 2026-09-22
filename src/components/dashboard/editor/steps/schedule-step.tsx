"use client";

import { useState, type FocusEvent, type ChangeEvent } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import {
  EVENT_LOCAL_MAX,
  EVENT_LOCAL_MIN,
  isBlankEventDraft,
  isCompleteLocalDateTime,
  newEventId,
} from "@/lib/event-draft";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";

import { Field } from "../field";
import { AddButton } from "../add-button";
import { LimitedTextarea } from "../limited-textarea";
import type { EditorValues } from "../types";

export function ScheduleStep({ form }: { form: UseFormReturn<EditorValues> }) {
  const { register, control } = form;
  // `keyName: "key"`: kunci render RHF TIDAK boleh bernama `id`, karena `id`
  // adalah id sesi di DB (DECISIONS #43) — dua pengenal berbeda di satu objek.
  const { fields, append, remove } = useFieldArray({
    control,
    name: "events",
    keyName: "key",
  });

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {copy.editor.schedule.tzHint}
      </p>

      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {copy.editor.schedule.empty}
        </p>
      ) : null}

      {fields.map((field, i) => (
        <div key={field.key} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {copy.editor.schedule.session} {i + 1}
            </span>
            <Button variant="ghost" size="sm" onClick={() => remove(i)}>
              {copy.editor.list.remove}
            </Button>
          </div>
          <Field label={copy.editor.schedule.name}>
            <Input
              placeholder={copy.editor.schedule.namePlaceholder}
              maxLength={L.event.name}
              {...register(`events.${i}.name`)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <StartField form={form} index={i} />
            <Field label={copy.editor.schedule.end}>
              <Input
                type="datetime-local"
                min={EVENT_LOCAL_MIN}
                max={EVENT_LOCAL_MAX}
                {...register(`events.${i}.endAt`)}
              />
            </Field>
          </div>
          <Field label={copy.editor.schedule.venue}>
            <Input
              maxLength={L.event.venueName}
              {...register(`events.${i}.venueName`)}
            />
          </Field>
          <Field label={copy.editor.schedule.address}>
            <LimitedTextarea
              form={form}
              name={`events.${i}.address`}
              max={L.event.address}
            />
          </Field>
          <Field label={copy.editor.schedule.mapsUrl}>
            <Input
              placeholder="https://maps.google.com/…"
              maxLength={L.event.mapsUrl}
              {...register(`events.${i}.mapsUrl`)}
            />
          </Field>
        </div>
      ))}

      <AddButton
        count={fields.length}
        max={L.event.sessions}
        onAdd={() =>
          append({
            id: newEventId(),
            name: "",
            startAt: "",
            endAt: "",
            venueName: "",
            address: "",
            mapsUrl: "",
          })
        }
      >
        {copy.editor.schedule.add}
      </AddButton>
    </div>
  );
}

/**
 * Isian "Mulai" satu sesi (DECISIONS #42).
 *
 * - Sesi berisi yang jamnya belum lengkap tetap TERSIMPAN, tetapi belum tampil
 *   ke tamu — catatan kuning memberitahu pemilik alih-alih diam.
 * - Pengaman: selama pemilik MENYUNTING jam sesi yang sudah berjam, nilai
 *   antara yang belum lengkap TIDAK menimpa jam tersimpan. `datetime-local`
 *   melapor "" selama salah satu segmennya kosong, dan Chrome desktop
 *   memancarkan tahun setengah jadi saat tahun diketik ulang ("0002-…",
 *   "0020-…", "0202-…" sebelum "2027-…"). Dulu hanya "" yang ditahan, sehingga
 *   tahun antara lolos, tersimpan tanpa jam, dan sesi hilang dari undangan
 *   aktif. Kini SETIAP nilai yang tak lolos aturan bersama (`lib/event-draft`)
 *   ditahan sampai isiannya lengkap kembali; untuk membuang sesi, "Hapus".
 *   `onBlur` ikut dijaga karena react-hook-form membaca ulang nilai DOM saat blur.
 */
function StartField({
  form,
  index,
}: {
  form: UseFormReturn<EditorValues>;
  index: number;
}) {
  const path = `events.${index}.startAt` as const;
  const reg = form.register(path);
  const value = useWatch({ control: form.control, name: path });
  const session = useWatch({ control: form.control, name: `events.${index}` });
  const [kept, setKept] = useState(false);

  function guard<
    E extends ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>,
  >(handler: (event: E) => unknown) {
    return (event: E) => {
      if (
        !isCompleteLocalDateTime(event.target.value) &&
        isCompleteLocalDateTime(form.getValues(path))
      ) {
        setKept(true);
        return;
      }
      setKept(false);
      return handler(event);
    };
  }

  // "Jam sebelumnya masih tersimpan" hanya boleh diucapkan bila memang benar.
  const keptValid = kept && isCompleteLocalDateTime(value);
  const missing =
    !keptValid &&
    !isBlankEventDraft(session ?? {}) &&
    !isCompleteLocalDateTime(value);
  const hint = keptValid
    ? copy.editor.schedule.startKept
    : missing
      ? copy.editor.schedule.startMissing
      : undefined;

  return (
    <>
      <Field label={copy.editor.schedule.start} hint={hint} hintTone="warning">
        <Input
          type="datetime-local"
          min={EVENT_LOCAL_MIN}
          max={EVENT_LOCAL_MAX}
          {...reg}
          onChange={guard(reg.onChange)}
          onBlur={guard(reg.onBlur)}
        />
      </Field>
      {/* Region status yang SELALU ada (WCAG 4.1.3): catatan yang muncul saat
        isian sedang difokus tak diumumkan bila hanya lewat aria-describedby,
        dan region yang baru disisipkan bersama teksnya sering diabaikan
        pembaca layar. Di luar Field: Field menghubungkan label ke SATU anak.
        sr-only = diposisikan absolut, jadi tak memakan sel grid. */}
      <span role="status" className="sr-only">
        {hint ?? ""}
      </span>
    </>
  );
}
