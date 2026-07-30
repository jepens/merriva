"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * Tombol salin nilai (nomor rekening/e-wallet) ke clipboard — BERSAMA lintas
 * tema. `className` diatur tema; label di-suntik agar tetap terpusat per tema.
 */
export function CopyButton({
  value,
  labelCopy,
  labelCopied,
  className,
}: {
  value: string;
  labelCopy: string;
  labelCopied: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      // clipboard tak tersedia (konteks non-secure) — abaikan diam-diam.
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onCopy}
      aria-live="polite"
    >
      {done ? <Check size={15} /> : <Copy size={15} />}
      {done ? labelCopied : labelCopy}
    </button>
  );
}
