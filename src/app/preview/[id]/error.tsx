"use client";

import { LoadErrorScreen } from "@/components/load-error-screen";
import { copy } from "@/lib/copy";

/**
 * Error boundary pratinjau pemilik (DECISIONS #45): bacaan yang gagal kini
 * melempar alih-alih menampilkan pratinjau tanpa jadwal/galeri, yang membuat
 * pemilik mengira isiannya hilang. Galat sudah dilaporkan ke Sentry di server.
 */
export default function PreviewLoadError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <LoadErrorScreen text={copy.preview.loadError} onRetry={unstable_retry} />
  );
}
