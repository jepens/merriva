"use client";

import { LoadErrorScreen } from "@/components/load-error-screen";
import { copy } from "@/lib/copy";

/**
 * Error boundary halaman per undangan di dashboard (edit, tamu, tampilan,
 * aktivasi, …) — DECISIONS #45. `getEffectiveLimits` kini MELEMPAR galat DB
 * alih-alih pura-pura Basic; tanpa boundary ini galatnya naik ke halaman galat
 * global yang mengganti seluruh dokumen (header & navigasi hilang). Galat sudah
 * dilaporkan ke Sentry di server (`onRequestError`).
 */
export default function InvitationDashboardError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <LoadErrorScreen
      text={copy.common.loadError}
      onRetry={unstable_retry}
      layout="inline"
    />
  );
}
