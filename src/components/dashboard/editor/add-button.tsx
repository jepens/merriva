"use client";

import { useId, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

/**
 * Tombol "Tambah" untuk daftar dinamis (cerita, sesi, rekening, …) yang
 * berhenti di batas skema server. Saat penuh ia nonaktif DAN alasannya
 * terlihat — tombol mati tanpa penjelasan terasa seperti form rusak.
 */
export function AddButton({
  count,
  max,
  onAdd,
  children,
}: {
  count: number;
  max: number;
  onAdd: () => void;
  children: ReactNode;
}) {
  const hintId = useId();
  const full = count >= max;
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        disabled={full}
        aria-describedby={full ? hintId : undefined}
        onClick={() => {
          if (!full) onAdd();
        }}
      >
        {children}
      </Button>
      {full ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {copy.editor.list.full(max)}
        </p>
      ) : null}
    </div>
  );
}
