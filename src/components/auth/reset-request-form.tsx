"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { requestPasswordResetAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

import { FieldError, FormAlert } from "./form-parts";
import { TurnstileField } from "./turnstile-field";

/**
 * Minta tantangan Turnstile BARU setiap kali kiriman ditolak dengan token yang
 * sudah terpakai. Urutan aksi auth: Zod → rate limit → Turnstile → DB, jadi
 * penolakan validasi (`fieldErrors`) terjadi sebelum verifikasi dan tokennya
 * masih sah — di situ widget dibiarkan (DECISIONS #46 — koreksi review).
 */
function useTurnstileReset(state: { status: string; fieldErrors?: unknown }) {
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    if (!(state.status === "error" && !state.fieldErrors)) return;
    // setState di callback timer, bukan sinkron di badan efek → tak memicu
    // `set-state-in-effect` (pola yang sama dipakai di seluruh repo ini).
    const id = setTimeout(() => setResetKey((n) => n + 1), 0);
    return () => clearTimeout(id);
  }, [state]);
  return resetKey;
}

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    idleState,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const tsReset = useTurnstileReset(state);
  const done = state.status === "success";

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-1.5">
        <Label htmlFor="email">{copy.auth.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(fieldErrors?.email)}
        />
        <FieldError errors={fieldErrors?.email} />
      </div>

      <TurnstileField resetKey={tsReset} />

      <Button type="submit" className="w-full" disabled={pending || done}>
        {copy.auth.resetCta}
      </Button>
    </form>
  );
}
