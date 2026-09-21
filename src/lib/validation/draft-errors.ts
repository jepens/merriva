import type { z } from "zod";

import { copy } from "@/lib/copy";

const v = copy.editor.validation;

/**
 * Peta pesan per-parse untuk penolakan skema draft (DECISIONS #41). Pesan
 * bawaan Zod berbahasa Inggris ("Too big: expected string to have <=2000
 * characters") diganti kalimat Indonesia, sesuai SPEC §4.4. Pesan kustom yang
 * ditulis di skema (mis. "Tautan tidak valid", "Nama bank wajib diisi") tetap
 * menang: Zod 4 mendahulukan pesan skema atas peta per-parse.
 *
 * Sengaja per-parse, BUKAN `z.config()` global — konfigurasi global akan
 * mengubah diam-diam pesan belasan aksi lain beserta test-nya.
 */
export const draftErrorMap: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === "too_big") {
    const n = Number(issue.maximum);
    return issue.origin === "array" ? v.tooMany(n) : v.tooLong(n);
  }
  if (issue.code === "too_small") return v.required;
  return v.invalid;
};

/**
 * Kelompokkan issue per PATH LENGKAP (`content.story.0.narrative`) — identik
 * dengan `name` isian react-hook-form, jadi editor bisa menaruh pesan tepat di
 * isian yang bermasalah. `flatten()` dulu meratakan semuanya ke kunci teratas
 * (`content`), sehingga pemilik tak pernah tahu isian mana yang ditolak.
 * Issue tanpa path (tingkat akar) dikumpulkan di `_form`.
 */
export function draftFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
