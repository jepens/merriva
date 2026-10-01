"use client";

import { useActionState } from "react";

import { FieldError, FormAlert } from "@/components/auth/form-parts";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { changePasswordAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

/**
 * Ganti kata sandi dari dalam akun (AUDIT-2026-10-01 B1). Sebelum ini
 * satu-satunya jalur adalah berpura-pura lupa kata sandi dan menunggu email.
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    idleState,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-1.5">
        <Label htmlFor="current">{copy.auth.passwordCurrent}</Label>
        <PasswordInput
          id="current"
          name="current"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldErrors?.current)}
        />
        <FieldError errors={fieldErrors?.current} />
      </div>

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

      <Button type="submit" disabled={pending}>
        {copy.auth.changePasswordCta}
      </Button>
    </form>
  );
}
