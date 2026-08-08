"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { requestPasswordResetAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

import { FieldError, FormAlert } from "./form-parts";
import { TurnstileField } from "./turnstile-field";

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    idleState,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
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

      <TurnstileField />

      <Button type="submit" className="w-full" disabled={pending || done}>
        {copy.auth.resetCta}
      </Button>
    </form>
  );
}
