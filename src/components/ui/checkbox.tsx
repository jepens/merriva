import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Checkbox native (kompatibel `{...register(...)}` RHF → nilai boolean).
export type CheckboxProps = ComponentProps<"input">;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        "border-input accent-primary focus-visible:ring-ring size-4 shrink-0 rounded focus-visible:ring-1 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
