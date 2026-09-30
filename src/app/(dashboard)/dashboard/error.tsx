"use client";

import { LoadErrorScreen } from "@/components/load-error-screen";
import { SupportContact } from "@/components/support-contact";
import { copy } from "@/lib/copy";

/**
 * Error boundary untuk permukaan dashboard yang BUKAN per-undangan — daftar
 * undangan, profil, dan riwayat pesanan (AUDIT-2026-10-01).
 *
 * Halaman riwayat pesanan memakai `dataOrThrow`, berbeda dari halaman dashboard
 * lain yang memakai `data ?? []`. Itu disengaja: halaman yang gunanya
 * membuktikan pembayaran TIDAK BOLEH menjawab "belum ada pesanan" saat DB
 * bermasalah — kebohongan itu persis yang membuat pelanggan mengira uangnya
 * hilang. Konsekuensinya galat harus punya tempat mendarat; tanpa boundary ini
 * ia naik ke `global-error.tsx` yang mengganti seluruh dokumen sehingga header,
 * navigasi, dan kontak dukungan ikut hilang.
 *
 * Galat sudah dilaporkan ke Sentry di server (`onRequestError`).
 */
export default function DashboardError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="space-y-4">
      <LoadErrorScreen
        text={copy.common.loadError}
        onRetry={unstable_retry}
        layout="inline"
      />
      <SupportContact />
    </div>
  );
}
