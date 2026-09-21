"use client";

import { useId, type ComponentProps } from "react";
import { useWatch, type Path, type UseFormReturn } from "react-hook-form";

import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

import type { EditorValues } from "./types";

/**
 * Textarea ber-batas untuk isian panjang (narasi, deskripsi, alamat, sapaan).
 * `maxLength` = batas skema server (FIELD_LIMITS), jadi autosave tak pernah
 * menolaknya karena kepanjangan. Penghitung terlihat membuat pemotongan oleh
 * `maxLength` — mis. saat menempel teks panjang — tidak terjadi diam-diam.
 * Satuan hitung = unit UTF-16, sama dengan `maxLength` HTML dan `.max()` Zod.
 */
export function LimitedTextarea({
  form,
  name,
  max,
  "aria-describedby": describedBy,
  ...rest
}: {
  form: UseFormReturn<EditorValues>;
  name: Path<EditorValues>;
  max: number;
} & Omit<ComponentProps<typeof Textarea>, "name" | "maxLength" | "form">) {
  const counterId = useId();
  const value = useWatch({ control: form.control, name });
  const length = typeof value === "string" ? value.length : 0;
  return (
    <>
      <Textarea
        maxLength={max}
        {...rest}
        // Penghitung + deskripsi dari `Field` (mis. pesan galat) DIGABUNG —
        // yang satu tak boleh menimpa yang lain.
        aria-describedby={[counterId, describedBy].filter(Boolean).join(" ")}
        {...form.register(name)}
      />
      <p
        id={counterId}
        className={cn(
          "text-right text-xs tabular-nums",
          length >= max ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {copy.editor.counter(length, max)}
      </p>
    </>
  );
}
