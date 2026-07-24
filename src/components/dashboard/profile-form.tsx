"use client";

import { useActionState } from "react";

import { FieldError, FormAlert } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { updateProfileAction } from "@/server/actions/profile";
import { idleState } from "@/server/actions/types";

export function ProfileForm({
  email,
  defaultName,
  defaultPhone,
}: {
  email: string;
  defaultName: string;
  defaultPhone: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    idleState,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-1.5">
        <Label htmlFor="email">{copy.auth.email}</Label>
        <Input id="email" type="email" value={email} disabled readOnly />
        <p className="text-muted-foreground text-xs">
          {copy.dashboard.emailReadonlyHint}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="full_name">{copy.auth.fullName}</Label>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          defaultValue={defaultName}
          required
          aria-invalid={Boolean(fieldErrors?.full_name)}
        />
        <FieldError errors={fieldErrors?.full_name} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">{copy.auth.phone}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={defaultPhone}
          aria-invalid={Boolean(fieldErrors?.phone)}
        />
        <p className="text-muted-foreground text-xs">{copy.auth.phoneHint}</p>
        <FieldError errors={fieldErrors?.phone} />
      </div>

      <Button type="submit" disabled={pending}>
        {copy.common.save}
      </Button>
    </form>
  );
}
