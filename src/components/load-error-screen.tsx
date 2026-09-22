"use client";

import { Button } from "@/components/ui/button";

/**
 * Layar "belum bisa dimuat" untuk error boundary (DECISIONS #45). Netral (tanpa
 * tema): tema tak termuat saat data gagal dibaca.
 *
 * - `screen` (bawaan): memenuhi layar — halaman undangan, pratinjau, global.
 * - `inline`: di dalam layout dashboard (header & navigasi tetap ada; layout
 *   sudah punya `<main>`).
 *
 * `onRetry` di boundary segmen = `unstable_retry` Next (muat ulang data server
 * lalu render ulang). Di halaman galat global = muat ulang halaman penuh.
 */
export function LoadErrorScreen({
  text,
  onRetry,
  layout = "screen",
}: {
  text: { title: string; body: string; retry: string };
  onRetry: () => void;
  layout?: "screen" | "inline";
}) {
  const content = (
    <div className="max-w-sm space-y-4 text-center" role="alert">
      <h1 className="text-lg font-semibold tracking-tight">{text.title}</h1>
      <p className="text-muted-foreground text-sm">{text.body}</p>
      <Button onClick={onRetry}>{text.retry}</Button>
    </div>
  );
  if (layout === "inline") {
    return <div className="flex justify-center py-16">{content}</div>;
  }
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4">
      {content}
    </main>
  );
}
