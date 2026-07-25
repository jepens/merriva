"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { saveInvitationDraftAction } from "@/server/actions/invitation";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Autosave draft berbasis perubahan form (SPEC §4.4). Meng-subscribe perubahan
 * RHF, debounce, lalu memanggil `saveInvitationDraftAction`. Nilai form
 * (`{ content, settings, eventDate }`) langsung menjadi payload — server
 * memvalidasi ulang dengan skema draft.
 */
export function useDraftAutosave<T extends FieldValues>(
  form: UseFormReturn<T>,
  invitationId: string,
  delay = 800,
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = form.watch(() => {
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void (async () => {
          const res = await saveInvitationDraftAction(
            invitationId,
            form.getValues(),
          );
          setStatus(res.status === "error" ? "error" : "saved");
        })();
      }, delay);
    });

    return () => {
      subscription.unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [form, invitationId, delay]);

  return status;
}
