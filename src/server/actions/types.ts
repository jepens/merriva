/**
 * Bentuk state yang dikembalikan Server Action ke form (pola `useActionState`).
 * `fieldErrors` selaras dengan `ZodError.flatten().fieldErrors`.
 */
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: FieldErrors }
  | { status: "success"; message?: string };

export const idleState: ActionState = { status: "idle" };

/** Bantu bentuk state error dari hasil `safeParse` yang gagal. */
export function fieldErrorState(
  fieldErrors: FieldErrors,
  message?: string,
): ActionState {
  return { status: "error", fieldErrors, message };
}

export function errorState(message: string): ActionState {
  return { status: "error", message };
}
