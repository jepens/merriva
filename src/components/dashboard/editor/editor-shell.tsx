"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
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

import { EditorErrorsContext } from "./editor-errors";
import { stepForPath } from "./step-fields";
import type { EditorValues, SongOption } from "./types";
import {
  useDraftAutosave,
  type FlushResult,
  type SaveStatus,
} from "./use-autosave";

/** Konteks yang diberikan ke tiap step (form + helper galeri + identitas). */
export interface EditorStepContext {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  slug: string;
  media: InvitationMediaView[];
  setMedia: Dispatch<SetStateAction<InvitationMediaView[]>>;
  maxPhotos: number;
  songs: SongOption[];
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
  songs,
  steps,
}: {
  invitationId: string;
  slug: string;
  defaultValues: EditorValues;
  initialMedia: InvitationMediaView[];
  maxPhotos: number;
  songs: SongOption[];
  steps: EditorStep[];
}) {
  const form = useForm<EditorValues>({
    defaultValues: withSectionDefaults(defaultValues),
  });
  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<InvitationMediaView[]>(initialMedia);
  const {
    status: saveStatus,
    flush,
    rejected,
  } = useDraftAutosave(form, invitationId);
  const router = useRouter();
  const [finishing, setFinishing] = useState(false);
  const [finishProblem, setFinishProblem] = useState<Exclude<
    FlushResult,
    "ok"
  > | null>(null);
  const isLast = step === steps.length - 1;
  // Keluhan diturunkan, bukan disimpan: begitu ada simpanan yang berhasil ia
  // hilang sendiri — tak perlu efek yang menyetel state (dan memicu render
  // berantai), dan mustahil tertinggal basi di layar.
  const masalahTampak = finishProblem !== null && saveStatus !== "saved";

  // Langkah yang berisi isian yang ditolak autosave terakhir — pemilik sering
  // sudah pindah langkah saat penolakan datang, jadi penanda di navigasi dan
  // nama langkah di pesan adalah satu-satunya jalan menemukan isiannya.
  const stepKeys = steps.map((s) => s.key);
  const invalidSteps = new Set(
    Object.keys(rejected ?? {})
      .map((path) => stepForPath(path, stepKeys))
      .filter((key): key is string => key !== null),
  );
  const invalidStepLabels = steps
    .filter((s) => invalidSteps.has(s.key))
    .map((s) => s.label)
    .join(", ");

  /**
   * Langkah terakhir → pratinjau (SPEC §4.4). Autosave di-debounce 800 ms, jadi
   * navigasi harus MENUNGGU simpanan tertunda: tanpa ini ketikan terakhir ikut
   * hilang saat editor ter-unmount. Simpan gagal → tetap di halaman, pemilik
   * diberi tahu dan bisa menekan tombolnya lagi.
   */
  const handleFinish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    setFinishProblem(null);
    const hasil = await flush();
    if (hasil !== "ok") {
      setFinishProblem(hasil);
      setFinishing(false);
      return;
    }
    // `finishing` sengaja dibiarkan true: tombol tetap terkunci sampai halaman
    // pratinjau menggantikan editor (tak ada navigasi ganda).
    router.push(`/preview/${invitationId}`);
  }, [finishing, flush, invitationId, router]);

  const ctx: EditorStepContext = {
    form,
    invitationId,
    slug,
    media,
    setMedia,
    maxPhotos,
    songs,
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
        invalid={invalidSteps}
      />

      <Card>
        <CardContent className="py-6">
          <EditorErrorsContext.Provider value={rejected}>
            {steps[step].render(ctx)}
          </EditorErrorsContext.Provider>
        </CardContent>
      </Card>

      {masalahTampak ? (
        <p
          role="alert"
          // Di ponsel baris tombol sering sudah di batas bawah layar: pesan
          // ditaruh DI ATASnya dan digulirkan, supaya kegagalan tak terasa
          // seperti tombol yang diam saja.
          ref={(el) => {
            el?.scrollIntoView({ block: "nearest" });
          }}
          className="text-destructive text-sm"
        >
          {finishProblem !== "rejected"
            ? copy.editor.nav.finishFailed
            : invalidStepLabels
              ? copy.editor.nav.finishRejected(invalidStepLabels)
              : copy.editor.nav.finishRejectedUnknown}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={step === 0 || finishing}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          {copy.editor.nav.prev}
        </Button>
        <Button
          disabled={finishing}
          aria-busy={finishing}
          onClick={
            isLast
              ? () => void handleFinish()
              : () => setStep((s) => Math.min(steps.length - 1, s + 1))
          }
        >
          {isLast
            ? finishing
              ? copy.editor.nav.finishing
              : copy.editor.nav.finish
            : copy.editor.nav.next}
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
      role="status"
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
  invalid,
}: {
  control: Control<EditorValues>;
  steps: EditorStep[];
  current: number;
  onSelect: (index: number) => void;
  mediaCount: number;
  /** Kunci langkah yang berisi isian yang ditolak autosave. */
  invalid: ReadonlySet<string>;
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
              data-step-key={s.key}
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
              {invalid.has(s.key) ? (
                <>
                  <span
                    aria-hidden
                    className="bg-destructive size-1.5 rounded-full"
                  />
                  <span className="sr-only">{copy.editor.stepNeedsFix}</span>
                </>
              ) : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
