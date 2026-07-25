"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { isDraftSlug, slugSchema } from "@/lib/slug";
import { cn } from "@/lib/utils";
import {
  checkSlugAvailabilityAction,
  updateInvitationSlugAction,
  type SlugCheckResult,
} from "@/server/actions/invitation";

/**
 * Editor slug undangan dengan cek ketersediaan real-time (SPEC §4 Flow A langkah
 * 5). Jalur simpannya terpisah dari autosave editor. Status format diturunkan
 * saat render (umpan balik instan); hanya hasil cek keunikan yang disimpan di
 * state, di-set di dalam callback async debounce (bukan di badan efek → tanpa
 * cascading render). Simpan hanya aktif saat status "tersedia".
 */

const DEBOUNCE_MS = 500;

type Remote = {
  slug: string;
  status: SlugCheckResult["status"];
  message?: string;
};

type Tone = "muted" | "ok" | "bad";
type View = { tone: Tone; text?: string; node?: ReactNode; retry?: boolean };

export function SlugEditor({
  invitationId,
  initialSlug,
  suggestion,
}: {
  invitationId: string;
  initialSlug: string;
  suggestion?: string;
}) {
  const router = useRouter();
  const draftUnset = isDraftSlug(initialSlug);
  const [committed, setCommitted] = useState(initialSlug);
  const [value, setValue] = useState(draftUnset ? "" : initialSlug);
  const [remote, setRemote] = useState<Remote | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSave] = useTransition();
  // Token untuk membuang hasil cek usang (balapan debounce).
  const reqId = useRef(0);

  const trimmed = value.trim();
  const parsed = useMemo(() => slugSchema.safeParse(trimmed), [trimmed]);
  const unchanged = trimmed === "" || trimmed === committed;
  // Nilai valid & berbeda dari yang tersimpan → layak dicek keunikannya.
  const candidate = !unchanged && parsed.success ? parsed.data : null;
  const hasResult = remote?.slug === candidate;

  useEffect(() => {
    if (candidate === null) return;
    if (hasResult) return; // hasil untuk nilai ini sudah ada
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      const res = await checkSlugAvailabilityAction(invitationId, candidate);
      if (id !== reqId.current) return; // usang, abaikan
      setRemote({ slug: candidate, status: res.status, message: res.message });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [candidate, hasResult, invitationId]);

  const isAvailable = hasResult && remote?.status === "available";

  function onChange(next: string) {
    setValue(next.toLowerCase());
    if (saved) setSaved(false);
  }

  function onSave() {
    if (!isAvailable || candidate === null) return;
    startSave(async () => {
      const res = await updateInvitationSlugAction(invitationId, candidate);
      if (res.status === "success") {
        reqId.current += 1; // batalkan cek yang mungkin tertunda
        setRemote(null);
        setCommitted(res.slug);
        setValue(res.slug);
        setSaved(true);
        router.refresh();
      } else if (res.reason === "taken") {
        setRemote({ slug: candidate, status: "taken" });
      } else if (res.reason === "not_draft") {
        setRemote({
          slug: candidate,
          status: "invalid",
          message: copy.editor.slug.notDraft,
        });
      } else if (res.reason === "invalid") {
        setRemote({ slug: candidate, status: "invalid", message: res.message });
      } else {
        setRemote({ slug: candidate, status: "error" });
      }
    });
  }

  const view = deriveView({
    unchanged,
    saved,
    draftUnset,
    trimmed,
    committed,
    parseError: parsed.success ? undefined : parsed.error.issues[0]?.message,
    remote: hasResult ? remote : null,
  });

  const canSuggest =
    Boolean(suggestion) && suggestion !== trimmed && suggestion !== committed;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="slug">{copy.editor.slug.label}</Label>
      <div className="flex items-stretch">
        <span className="text-muted-foreground bg-muted inline-flex items-center rounded-l-md border border-r-0 px-3 text-sm">
          {copy.editor.slug.prefix}
        </span>
        <Input
          id="slug"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={copy.editor.slug.placeholder}
          className="rounded-l-none"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={view.tone === "bad"}
          aria-describedby="slug-status"
        />
        <Button
          type="button"
          size="sm"
          className="ml-2"
          onClick={onSave}
          disabled={!isAvailable || isSaving}
        >
          {isSaving ? copy.editor.slug.saving : copy.editor.slug.save}
        </Button>
      </div>

      <p
        id="slug-status"
        role="status"
        aria-live="polite"
        className={cn(
          "text-xs",
          view.tone === "ok"
            ? "text-emerald-600"
            : view.tone === "bad"
              ? "text-destructive"
              : "text-muted-foreground",
        )}
      >
        {view.node ?? view.text}
        {view.retry ? (
          <button
            type="button"
            onClick={() => setRemote(null)}
            className="text-primary ml-2 underline-offset-2 hover:underline"
          >
            {copy.editor.slug.retry}
          </button>
        ) : null}
      </p>

      {canSuggest ? (
        <button
          type="button"
          onClick={() => onChange(suggestion as string)}
          className="text-primary text-xs underline-offset-2 hover:underline"
        >
          {copy.editor.slug.suggestion} {suggestion}
        </button>
      ) : null}
    </div>
  );
}

/** Status tampilan diturunkan murni dari input + hasil cek (tanpa efek). */
function deriveView(args: {
  unchanged: boolean;
  saved: boolean;
  draftUnset: boolean;
  trimmed: string;
  committed: string;
  parseError?: string;
  remote: Remote | null;
}): View {
  const {
    unchanged,
    saved,
    draftUnset,
    trimmed,
    committed,
    parseError,
    remote,
  } = args;

  if (unchanged) {
    if (saved) return { tone: "ok", text: copy.editor.slug.saved };
    if (draftUnset && trimmed === "")
      return { tone: "muted", text: copy.editor.slug.unset };
    return {
      tone: "muted",
      node: (
        <>
          {copy.editor.slug.current}{" "}
          <span className="text-foreground font-medium">/{committed}</span>
        </>
      ),
    };
  }

  if (parseError) return { tone: "bad", text: parseError };

  if (remote) {
    if (remote.status === "available")
      return { tone: "ok", text: copy.editor.slug.available };
    if (remote.status === "taken")
      return { tone: "bad", text: copy.editor.slug.taken };
    if (remote.status === "invalid")
      return { tone: "bad", text: remote.message ?? copy.editor.slug.hint };
    return { tone: "bad", text: copy.editor.slug.error, retry: true };
  }

  return { tone: "muted", text: copy.editor.slug.checking };
}
