"use client";

import { LoadErrorScreen } from "@/components/load-error-screen";
import { copy } from "@/lib/copy";

/**
 * Error boundary panel admin (AUDIT-2026-10-01).
 *
 * Dipasang BERSAMA perubahan yang membuat bacaan admin melempar. Sebelumnya
 * seluruh halaman admin memakai `const { data } = await admin…` tanpa memeriksa
 * `error`, sehingga satu kedipan DB menghasilkan tabel KOSONG yang tampak
 * meyakinkan — "tidak ada order", "tidak ada pengguna" — padahal datanya ada.
 * Pada panel yang dipakai untuk rekonsiliasi uang, itu kelas kebohongan yang
 * paling mahal.
 *
 * Tanpa boundary ini galatnya naik ke `global-error.tsx` yang mengganti seluruh
 * dokumen: header, navigasi, dan jalan kembali ikut hilang.
 *
 * `SupportContact` SENGAJA tidak dipakai di sini — admin adalah tim Merriva
 * sendiri, bukan pelanggan yang perlu dialihkan ke alamat dukungan.
 */
export default function AdminError({
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
