"use client";

import { LoadErrorScreen } from "@/components/load-error-screen";
import { copy } from "@/lib/copy";

/**
 * Error boundary halaman Album Momen `/{slug}/momen` (DECISIONS #45) — route
 * DINAMIS, jadi galat bacaan yang kini dilempar sampai ke sini dan tamu
 * mendapat "Coba lagi", bukan 404 atau "album belum aktif".
 *
 * SENGAJA tidak dipasang di segmen `/{slug}`: boundary adalah komponen KLIEN,
 * sehingga `lib/copy.ts` + tombol ikut ke bundel halaman undangan — anggaran
 * JS-nya terlampaui (64 KB gzip; SPEC §4.5 LCP < 2,5 dtk di 4G, ditangkap CI).
 * Render ISR `/{slug}` pun tak pernah memakai boundary segmen: Next melempar
 * ulang galat pada prerender (`handleISRError`) lalu menyajikan versi baik
 * terakhir atau halaman 500 statis bawaan. Galat navigasi klien di halaman
 * undangan jatuh ke `app/global-error.tsx`.
 *
 * Galat sudah dilaporkan ke Sentry di server (`onRequestError`).
 */
export default function MomenLoadError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <LoadErrorScreen text={copy.public.loadError} onRetry={unstable_retry} />
  );
}
