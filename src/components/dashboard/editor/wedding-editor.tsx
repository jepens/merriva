"use client";

import { useState } from "react";
import {
  useForm,
  useWatch,
  type Control,
  type UseFormReturn,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type {
  InvitationSettings,
  WeddingDraft,
} from "@/lib/validation/content";

import { useDraftAutosave, type SaveStatus } from "./use-autosave";

export type WeddingEditorValues = {
  eventDate: string;
  content: WeddingDraft;
  settings: InvitationSettings;
};

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
): boolean {
  switch (key) {
    case "info":
      return Boolean(
        content.title ||
        (content.groom?.nickname && content.bride?.nickname) ||
        eventDate,
      );
    default:
      // Langkah lain menyusul (M1.3c) — belum ada kriteria selesai.
      return false;
  }
}

export function WeddingEditor({
  invitationId,
  slug,
  defaultValues,
}: {
  invitationId: string;
  slug: string;
  defaultValues: WeddingEditorValues;
}) {
  const form = useForm<WeddingEditorValues>({ defaultValues });
  const [step, setStep] = useState(0);
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

      <StepNav control={form.control} current={step} onSelect={setStep} />

      <Card>
        <CardContent className="py-6">
          {currentKey === "info" ? (
            <InfoStep form={form} />
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
}: {
  control: Control<WeddingEditorValues>;
  current: number;
  onSelect: (index: number) => void;
}) {
  const content = useWatch({ control, name: "content" });
  const eventDate = useWatch({ control, name: "eventDate" });

  return (
    <ol className="flex flex-wrap gap-2">
      {STEP_KEYS.map((key, i) => {
        const done = isStepComplete(key, content, eventDate ?? "");
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

function InfoStep({ form }: { form: UseFormReturn<WeddingEditorValues> }) {
  const { register } = form;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">{copy.editor.fields.title}</Label>
        <Input
          id="title"
          placeholder={copy.editor.fields.titlePlaceholder}
          {...register("content.title")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="groomNick">{copy.editor.fields.groomNickname}</Label>
          <Input id="groomNick" {...register("content.groom.nickname")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brideNick">{copy.editor.fields.brideNickname}</Label>
          <Input id="brideNick" {...register("content.bride.nickname")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="eventDate">{copy.editor.fields.eventDate}</Label>
        <Input id="eventDate" type="date" {...register("eventDate")} />
      </div>
      <p className="text-muted-foreground text-xs">
        {copy.editor.slugFixedNote}
      </p>
    </div>
  );
}
