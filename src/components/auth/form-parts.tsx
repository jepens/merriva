"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ActionState } from "@/server/actions/types";

/** Pesan error per-field (menampilkan pesan pertama). */
export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-destructive text-xs">{errors[0]}</p>;
}

/** Alert tingkat-form untuk pesan error/sukses dari ActionState. */
export function FormAlert({ state }: { state: ActionState }) {
  if (state.status === "error" && state.message) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  if (state.status === "success" && state.message) {
    return (
      <Alert variant="success">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
