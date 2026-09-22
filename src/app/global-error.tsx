"use client";

import "./globals.css";

import { LoadErrorScreen } from "@/components/load-error-screen";
import { copy } from "@/lib/copy";

/**
 * Halaman galat global berbahasa Indonesia (DECISIONS #45) — boundary runtime
 * untuk halaman DINAMIS yang tak punya boundary lebih dekat (auth, admin,
 * marketing dinamis). Bawaan Next berbahasa Inggris.
 *
 * BUKAN halaman 500 statis: di Next 16.2.11 500.html App Router selalu dirakit
 * dari `builtin/app-error.js` dan tak bisa diganti dari sini — jadi render ISR
 * `/{slug}` yang gagal tanpa versi ter-cache tetap disajikan halaman bawaan itu
 * (dibuktikan dengan memeriksa `_global-error.html` hasil `next build`).
 *
 * Menggantikan root layout → `<html>`/`<body>` sendiri. "Coba lagi" memuat ulang
 * halaman penuh; galat berasal dari server, jadi memuat ulang = mencoba lagi.
 */
export default function GlobalError() {
  return (
    <html lang="id">
      <body>
        <LoadErrorScreen
          text={copy.common.loadError}
          onRetry={() => window.location.reload()}
        />
      </body>
    </html>
  );
}
