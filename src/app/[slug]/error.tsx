"use client";

import { LoadErrorScreen } from "@/components/load-error-screen";
import { copy } from "@/lib/copy";

/**
 * Error boundary segmen `/{slug}` — DECISIONS #45. Tampil untuk render DINAMIS:
 * Album Momen `/{slug}/momen` (selalu dinamis) dan navigasi sisi klien. Render
 * ISR `/{slug}` sendiri TIDAK sampai ke sini: pada prerender Next melempar ulang
 * galat sebelum boundary ini dirender (`handleISRError`) — versi baik terakhir
 * disajikan bila ada (revalidasi berbasis waktu), selain itu halaman 500 statis
 * bawaan Next (tak bisa diganti, lihat `app/global-error.tsx`). Galat sudah
 * dilaporkan ke Sentry di server.
 */
export default function InvitationLoadError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <LoadErrorScreen text={copy.public.loadError} onRetry={unstable_retry} />
  );
}
