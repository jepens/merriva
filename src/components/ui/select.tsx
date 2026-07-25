import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Select native (kompatibel `{...register(...)}` RHF untuk enum).
export type SelectProps = ComponentProps<"select">;

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "border-input focus-visible:ring-ring h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
