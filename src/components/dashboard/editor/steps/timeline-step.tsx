"use client";

import { useEffect, useRef } from "react";
import {
  useFieldArray,
  useWatch,
  type FieldArrayPath,
  type Path,
  type UseFormReturn,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { storyPhotoAspect } from "@/lib/customizer/theme-options";
import { ceritaTampil } from "@/lib/invitation-content";
import type { Photo } from "@/lib/validation/content";
import { FIELD_LIMITS as L } from "@/lib/validation/content/field-limits";
import { deleteNamedPhotoAction } from "@/server/actions/named-photo";

import { Field } from "../field";
import { AddButton } from "../add-button";
import { LimitedTextarea } from "../limited-textarea";
import { PhotoField } from "../photo-field";
import type { EditorValues, StoryPhotoSlot } from "../types";

/** Path array linimasa per kategori (love story / agenda / doa & harapan). */
export type TimelinePath =
  "content.story" | "content.agenda" | "content.wishes";

/** Batas jumlah entri per daftar linimasa — sama dengan skema server. */
const TIMELINE_MAX: Record<TimelinePath, number> = {
  "content.story": L.wedding.story,
  "content.agenda": L.corporate.agenda,
  "content.wishes": L.family.wishes,
};

export interface TimelineLabels {
  add: string;
  item: string;
  empty: string;
  title: string;
  date: string;
  datePlaceholder: string;
  narrative: string;
}

/**
 * Step linimasa generik — satu struktur (judul, tanggal, narasi) yang dipakai
 * ketiga kategori dengan `name` (field array) + `labels` berbeda. Menggantikan
 * story-step wedding. `content.story|agenda|wishes` semuanya `StoryEntry[]`.
 *
 * Love story (`content.story`) juga boleh punya satu foto per entri (#127):
 * bidangnya hanya tampil bila `photo` ada — tema aktif merendernya.
 */
export function TimelineStep({
  form,
  name,
  labels,
  invitationId,
  photo = null,
}: {
  form: UseFormReturn<EditorValues>;
  name: TimelinePath;
  labels: TimelineLabels;
  /** Wajib untuk love story: membuang berkas foto entri yang dihapus. */
  invitationId?: string;
  /** Foto per entri love story bila tema aktif merendernya; else `null`. */
  photo?: StoryPhotoSlot | null;
}) {
  const { register, control, getValues, setValue, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<EditorValues>,
  });

  // Path template di-cast: `name` union literal → gabungan path valid di union.
  const path = (i: number, field: "title" | "date" | "narrative") =>
    `${name}.${i}.${field}` as Path<EditorValues>;
  const loveStory = name === "content.story";
  const fotoPath = (i: number) => `content.story.${i}.photo` as const;

  // `fields` terbaru untuk callback unggah yang selesai BELAKANGAN (lihat
  // `fotoBerubah`). Diperbarui di effect — menulis ref saat render ditolak
  // aturan react-hooks.
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  });

  // Isi cerita terkini, untuk indeks entri SEBAGAIMANA DIRENDER tema: entri
  // belum lengkap gugur saat render (`ceritaTampil`), jadi rasio bergiliran
  // (warta: lanskap/potret) mengikuti indeks itu — bukan indeks form. Tanpa
  // ini, satu entri setengah jadi di depan membuat bingkai editor berbeda dari
  // yang dilihat tamu. `useWatch`, bukan `watch` saat render: yang terakhir
  // merender ulang seluruh editor tiap ketikan.
  const isiCerita = useWatch({
    control,
    name: "content.story" as Path<EditorValues>,
  }) as Array<{ title?: string; narrative?: string }> | undefined;
  const indeksTampil = (i: number) =>
    (isiCerita ?? []).slice(0, i).filter(ceritaTampil).length;

  /**
   * Foto entri `id` berubah. Unggahan butuh beberapa detik di 4G dan bisa
   * selesai SESUDAH entri lain dihapus (indeks bergeser) atau entrinya sendiri
   * dihapus — closure-nya masih memegang indeks lama. Indeks entri itu dicari
   * ulang SEKARANG lewat id-nya; tanpa ini foto mendarat di entri lain dan
   * foto entri itu jadi yatim. Entri sudah tiada → unggahan barunya dibuang.
   */
  function fotoBerubah(id: string, next: Photo | undefined) {
    const j = fieldsRef.current.findIndex((f) => f.id === id);
    if (j < 0) {
      if (next && invitationId) {
        void deleteNamedPhotoAction(invitationId, next.path);
      }
      return;
    }
    setValue(fotoPath(j), next);
  }

  function hapusEntri(i: number) {
    // Foto entri dibuang bersama entrinya — tak ada sapuan yang membandingkan
    // storage dengan `content`, jadi tanpa ini berkasnya yatim selamanya. Juga
    // saat bidang fotonya tak tampil (tema tanpa foto cerita): fotonya tetap
    // ada di `content`. Dibaca SEBELUM `remove`: sesudahnya indeks `i` milik
    // entri berikutnya.
    const lama = loveStory
      ? (getValues(fotoPath(i)) as Photo | undefined)?.path
      : undefined;
    remove(i);
    if (lama && invitationId) void deleteNamedPhotoAction(invitationId, lama);
  }

  return (
    <div className="space-y-4">
      {loveStory && photo?.galleryFallback ? (
        <p className="text-muted-foreground text-sm">
          {copy.editor.photo.storyFallbackNote}
        </p>
      ) : null}
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.empty}</p>
      ) : null}

      {fields.map((field, i) => (
        <div key={field.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {labels.item} {i + 1}
            </span>
            <Button variant="ghost" size="sm" onClick={() => hapusEntri(i)}>
              {copy.editor.list.remove}
            </Button>
          </div>
          <Field label={labels.title}>
            <Input
              maxLength={L.storyEntry.title}
              {...register(path(i, "title"))}
            />
          </Field>
          <Field label={labels.date}>
            <Input
              placeholder={labels.datePlaceholder}
              maxLength={L.storyEntry.date}
              {...register(path(i, "date"))}
            />
          </Field>
          <Field label={labels.narrative}>
            <LimitedTextarea
              form={form}
              name={path(i, "narrative")}
              max={L.storyEntry.narrative}
            />
          </Field>
          {loveStory && photo && invitationId ? (
            <PhotoField
              invitationId={invitationId}
              label={`${copy.editor.photo.storyLabel} ${i + 1}`}
              hint={copy.editor.photo.storyHint}
              aspect={storyPhotoAspect(photo, indeksTampil(i))}
              value={watch(fotoPath(i)) as Photo | undefined}
              initialUrl={(() => {
                const p = (getValues(fotoPath(i)) as Photo | undefined)?.path;
                return p ? (photo.urls[p] ?? null) : null;
              })()}
              // Tanpa `shouldDirty` — alasan yang sama dengan foto mempelai
              // (couple-step): react-hook-form melempar saat foto dibuang.
              onChange={(next) => fotoBerubah(field.id, next)}
            />
          ) : null}
        </div>
      ))}

      <AddButton
        count={fields.length}
        max={TIMELINE_MAX[name]}
        onAdd={() => append({ title: "", date: "", narrative: "" })}
      >
        {labels.add}
      </AddButton>
    </div>
  );
}
