"use client";

import { createContext, useContext } from "react";

import type { FieldErrors } from "@/server/actions/types";

/**
 * Galat per isian dari penolakan autosave terakhir (kunci = path lengkap,
 * identik dengan `name` isian). `null` = simpanan terakhir diterima.
 */
export const EditorErrorsContext = createContext<FieldErrors | null>(null);

/** Pesan galat pertama untuk isian `name`, bila ada. */
export function useFieldError(name: string | undefined): string | undefined {
  const errors = useContext(EditorErrorsContext);
  if (!name || !errors) return undefined;
  return errors[name]?.[0];
}
