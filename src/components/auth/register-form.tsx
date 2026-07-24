"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { signUpAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

import { FieldError, FormAlert } from "./form-parts";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUpAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const done = state.status === "success";

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-1.5">
        <Label htmlFor="full_name">{copy.auth.fullName}</Label>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          required
          aria-invalid={Boolean(fieldErrors?.full_name)}
        />
        <FieldError errors={fieldErrors?.full_name} />
      </div>

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
        <Label htmlFor="phone">{copy.auth.phone}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={Boolean(fieldErrors?.phone)}
        />
        <p className="text-muted-foreground text-xs">{copy.auth.phoneHint}</p>
        <FieldError errors={fieldErrors?.phone} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{copy.auth.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldErrors?.password)}
        />
        <FieldError errors={fieldErrors?.password} />
      </div>

      <Button type="submit" className="w-full" disabled={pending || done}>
        {copy.auth.registerCta}
      </Button>
    </form>
  );
}
