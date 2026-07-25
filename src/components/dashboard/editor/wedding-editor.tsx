"use client";

import { useState } from "react";
import { useForm, useWatch, type Control } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { EventDraft, WeddingDraft } from "@/lib/validation/content";

import type { InvitationMediaView } from "@/types/invitation";

import { CoupleStep } from "./steps/couple-step";
import { EnvelopeStep } from "./steps/envelope-step";
import { GalleryStep } from "./steps/gallery-step";
import { InfoStep } from "./steps/info-step";
import { ScheduleStep } from "./steps/schedule-step";
import { SettingsStep } from "./steps/settings-step";
import { StoryStep } from "./steps/story-step";
import type { WeddingEditorValues } from "./types";
import { useDraftAutosave, type SaveStatus } from "./use-autosave";

const STEP_KEYS = [
  "info",
  "couple",
  "schedule",
  "gallery",
  "story",
  "envelope",
  "settings",
] as const;
type StepKey = (typeof STEP_KEYS)[number];

function isStepComplete(
  key: StepKey,
  content: WeddingDraft,
  eventDate: string,
  events: EventDraft[],
  mediaCount: number,
): boolean {
  switch (key) {
    case "info":
      return Boolean(
        content.title ||
        (content.groom?.nickname && content.bride?.nickname) ||
        eventDate,
      );
    case "couple":
      return Boolean(content.groom?.name && content.bride?.name);
    case "schedule":
      return events.some((e) => Boolean(e.startAt));
    case "gallery":
      return mediaCount > 0;
    case "story":
      return (content.story?.length ?? 0) > 0;
    case "envelope":
      return Boolean(content.envelope?.enabled);
    case "settings":
      return Boolean(content.greetingOpen || content.greetingClose);
    default:
      return false;
  }
}

/** Isi default toggle section yang belum di-set (tampil = true). */
function withSectionDefaults(values: WeddingEditorValues): WeddingEditorValues {
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

export function WeddingEditor({
  invitationId,
  slug,
  defaultValues,
  initialMedia,
  maxPhotos,
}: {
  invitationId: string;
  slug: string;
  defaultValues: WeddingEditorValues;
  initialMedia: InvitationMediaView[];
  maxPhotos: number;
}) {
  const form = useForm<WeddingEditorValues>({
    defaultValues: withSectionDefaults(defaultValues),
  });
  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<InvitationMediaView[]>(initialMedia);
  const saveStatus = useDraftAutosave(form, invitationId);
  const currentKey = STEP_KEYS[step];

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
        current={step}
        onSelect={setStep}
        mediaCount={media.length}
      />

      <Card>
        <CardContent className="py-6">
          {currentKey === "info" ? (
            <InfoStep form={form} invitationId={invitationId} slug={slug} />
          ) : currentKey === "couple" ? (
            <CoupleStep form={form} />
          ) : currentKey === "schedule" ? (
            <ScheduleStep form={form} />
          ) : currentKey === "gallery" ? (
            <GalleryStep
              invitationId={invitationId}
              maxPhotos={maxPhotos}
              media={media}
              setMedia={setMedia}
            />
          ) : currentKey === "story" ? (
            <StoryStep form={form} />
          ) : currentKey === "envelope" ? (
            <EnvelopeStep form={form} />
          ) : currentKey === "settings" ? (
            <SettingsStep form={form} />
          ) : (
            <p className="text-muted-foreground text-sm">
              {copy.editor.stepSoon}
            </p>
          )}
        </CardContent>
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
          disabled={step === STEP_KEYS.length - 1}
          onClick={() => setStep((s) => Math.min(STEP_KEYS.length - 1, s + 1))}
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
  current,
  onSelect,
  mediaCount,
}: {
  control: Control<WeddingEditorValues>;
  current: number;
  onSelect: (index: number) => void;
  mediaCount: number;
}) {
  const content = useWatch({ control, name: "content" });
  const eventDate = useWatch({ control, name: "eventDate" });
  const events = useWatch({ control, name: "events" });

  return (
    <ol className="flex flex-wrap gap-2">
      {STEP_KEYS.map((key, i) => {
        const done = isStepComplete(
          key,
          content,
          eventDate ?? "",
          events ?? [],
          mediaCount,
        );
        const active = i === current;
        return (
          <li key={key}>
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
              {copy.editor.steps[key]}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
