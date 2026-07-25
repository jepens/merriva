"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { L } from "./labels";

/** Tombol salin nomor rekening/e-wallet ke clipboard (amplop digital). */
export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      // clipboard tak tersedia (mis. konteks non-secure) — abaikan diam-diam.
    }
  }

  return (
    <button
      type="button"
      className="er-btn er-btn--solid"
      onClick={onCopy}
      aria-live="polite"
    >
      {done ? <Check size={15} /> : <Copy size={15} />}
      {done ? L.envelope.copied : L.envelope.copy}
    </button>
  );
}
