"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { signInAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

import { FieldError, FormAlert } from "./form-parts";
import { PasswordInput } from "./password-input";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{copy.auth.password}</Label>
          <Link
            href="/reset-password"
            className="text-muted-foreground text-xs hover:underline"
          >
            {copy.auth.forgotPassword}
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldErrors?.password)}
        />
        <FieldError errors={fieldErrors?.password} />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {copy.auth.loginCta}
      </Button>
    </form>
  );
}
