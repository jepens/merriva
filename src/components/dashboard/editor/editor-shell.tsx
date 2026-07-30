"use client";

import {
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  useForm,
  useWatch,
  type Control,
  type UseFormReturn,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { InvitationMediaView } from "@/types/invitation";

import type { EditorValues } from "./types";
import { useDraftAutosave, type SaveStatus } from "./use-autosave";

/** Konteks yang diberikan ke tiap step (form + helper galeri + identitas). */
export interface EditorStepContext {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  slug: string;
  media: InvitationMediaView[];
  setMedia: Dispatch<SetStateAction<InvitationMediaView[]>>;
  maxPhotos: number;
}

/** Definisi satu langkah editor (dipakai lintas kategori via konfigurasi). */
export interface EditorStep {
  key: string;
  label: string;
  render: (ctx: EditorStepContext) => ReactNode;
  complete: (values: EditorValues, mediaCount: number) => boolean;
}

/** Isi default toggle section yang belum di-set (tampil = true). */
function withSectionDefaults(values: EditorValues): EditorValues {
  const s = values.settings.sections;
  return {
    ...values,
    settings: {
      ...values.settings,
      sections: {
        ...s,
        countdown: s.countdown ?? true,
        gallery: s.gallery ?? true,
        story: s.story ?? true,
        envelope: s.envelope ?? true,
      },
    },
  };
}

/**
 * Kerangka editor undangan bersama (SPEC §4.4) — navigasi langkah + indikator
 * simpan + autosave + state galeri. Perbedaan per kategori sepenuhnya ada di
 * array `steps` (label, komponen, kelengkapan). Autosave & validasi server
 * generik lintas kategori (`saveInvitationDraftAction`).
 */
export function EditorShell({
  invitationId,
  slug,
  defaultValues,
  initialMedia,
  maxPhotos,
  steps,
}: {
  invitationId: string;
  slug: string;
  defaultValues: EditorValues;
  initialMedia: InvitationMediaView[];
  maxPhotos: number;
  steps: EditorStep[];
}) {
  const form = useForm<EditorValues>({
    defaultValues: withSectionDefaults(defaultValues),
  });
  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<InvitationMediaView[]>(initialMedia);
  const saveStatus = useDraftAutosave(form, invitationId);

  const ctx: EditorStepContext = {
    form,
    invitationId,
    slug,
    media,
    setMedia,
    maxPhotos,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {copy.editor.address}:{" "}
          <span className="text-foreground font-medium">/{slug}</span>
        </p>
        <SaveIndicator status={saveStatus} />
      </div>

      <StepNav
        control={form.control}
        steps={steps}
        current={step}
        onSelect={setStep}
        mediaCount={media.length}
      />

      <Card>
        <CardContent className="py-6">{steps[step].render(ctx)}</CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          {copy.editor.nav.prev}
        </Button>
        <Button
          disabled={step === steps.length - 1}
          onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
        >
          {copy.editor.nav.next}
        </Button>
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const label =
    status === "saving"
      ? copy.editor.save.saving
      : status === "error"
        ? copy.editor.save.error
        : copy.editor.save.saved;
  return (
    <span
      className={cn(
        "text-xs",
        status === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function StepNav({
  control,
  steps,
  current,
  onSelect,
  mediaCount,
}: {
  control: Control<EditorValues>;
  steps: EditorStep[];
  current: number;
  onSelect: (index: number) => void;
  mediaCount: number;
}) {
  const content = useWatch({ control, name: "content" });
  const eventDate = useWatch({ control, name: "eventDate" });
  const events = useWatch({ control, name: "events" });
  const settings = useWatch({ control, name: "settings" });
  const values = {
    content,
    eventDate: eventDate ?? "",
    events: events ?? [],
    settings,
  } as EditorValues;

  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((s, i) => {
        const done = s.complete(values, mediaCount);
        const active = i === current;
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px]",
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-primary-foreground/20"
                      : "bg-muted",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              {s.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
