"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { updatePasswordAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

import { FieldError, FormAlert } from "./form-parts";
import { PasswordInput } from "./password-input";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    idleState,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-1.5">
        <Label htmlFor="password">{copy.auth.passwordNew}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          hint={copy.auth.passwordHint}
          aria-invalid={Boolean(fieldErrors?.password)}
        />
        <FieldError errors={fieldErrors?.password} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">{copy.auth.passwordConfirm}</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldErrors?.confirm)}
        />
        <FieldError errors={fieldErrors?.confirm} />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {copy.auth.updatePasswordCta}
      </Button>
    </form>
  );
}
