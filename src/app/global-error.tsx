"use client";

/**
 * Halaman galat global berbahasa Indonesia (DECISIONS #45) — boundary runtime
 * untuk halaman DINAMIS yang tak punya boundary lebih dekat (auth, admin,
 * marketing dinamis). Bawaan Next berbahasa Inggris.
 *
 * TANPA IMPOR APA PUN — termasuk `lib/copy.ts`, komponen Button, dan CSS global.
 * Berkas ini masuk ke graf klien SETIAP route, jadi satu impor `copy` saja
 * mendorong bundel JS halaman undangan tamu melewati anggarannya (71–73 KB >
 * 64 KB gzip; tertangkap gerbang anggaran CI, bukan test). Karena itu teksnya
 * ditulis di sini dan gayanya inline; `tests/unit/load-error-screen.test.tsx`
 * menjaganya tetap sama persis dengan `copy.common.loadError`.
 *
 * BUKAN halaman 500 statis: di Next 16.2.11 500.html App Router selalu dirakit
 * dari `builtin/app-error.js` dan tak bisa diganti dari sini — render ISR
 * `/{slug}` yang gagal tanpa versi ter-cache tetap disajikan halaman bawaan itu
 * (dibuktikan dengan memeriksa `_global-error.html` hasil `next build`).
 *
 * Menggantikan root layout → `<html>`/`<body>` sendiri. "Coba lagi" memuat ulang
 * halaman penuh; galatnya dari server, jadi memuat ulang = mencoba lagi.
 */
export default function GlobalError() {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
          background: "#fff",
          color: "#0a0a0a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div role="alert" style={{ maxWidth: "24rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            Halaman belum bisa dimuat
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#525252", marginTop: 12 }}>
            Terjadi gangguan saat memuat halaman ini. Coba lagi sebentar lagi.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#171717",
              color: "#fafafa",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
