"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";

import { Label } from "@/components/ui/label";

import { useFieldError } from "./editor-errors";

type ControlProps = {
  name?: unknown;
  id?: string;
  "aria-describedby"?: string;
};

/**
 * Bungkus label + kontrol + petunjuk untuk field editor.
 *
 * Kontrol anak (tunggal) dihubungkan secara terprogram: label menunjuk id-nya,
 * dan bila autosave terakhir ditolak di isian ini (pesan Indonesia dari server,
 * SPEC §4.4) kontrol diberi `aria-invalid` + `aria-describedby` ke pesannya —
 * pembaca layar menyebut galat saat fokus kembali ke isian, bukan hanya
 * "Gagal menyimpan" tanpa menyebut isian mana. Nama isian dibaca dari props
 * anak (`{...register(path)}` / `LimitedTextarea`), jadi path tak mungkin
 * berbeda dari yang di-register.
 */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const errorId = useId();
  const control = isValidElement<ControlProps>(children)
    ? (children as ReactElement<ControlProps>)
    : null;
  const name =
    typeof control?.props.name === "string" ? control.props.name : undefined;
  const error = useFieldError(name);
  const controlId = control?.props.id ?? htmlFor ?? autoId;

  const describedBy =
    [control?.props["aria-describedby"], error ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={control ? controlId : htmlFor}>{label}</Label>
      {control
        ? cloneElement(control, {
            id: controlId,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": describedBy,
          } as Partial<ControlProps> & { "aria-invalid"?: boolean })
        : children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="status" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
