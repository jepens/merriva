import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/**
 * Header keamanan (AUDIT-2026-09-04 KEA-5 — sebelumnya TIDAK ADA satu pun).
 *
 * `Permissions-Policy: camera=(self)` WAJIB: Album Momen memakai `getUserMedia`
 * di `/[slug]/momen` (same-origin). HSTS hanya di production — mengirimnya dari
 * `next dev` akan memaksa https pada `localhost` dan mematikan dev server.
 */
const isProd = process.env.NODE_ENV === "production";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  // Halaman undangan & `/preview/*` sengaja SAMEORIGIN: `PreviewFrame` +
  // `appearance-editor` membingkainya dari dashboard (same-origin).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

// Permukaan ter-auth: aksi destruktif (hapus undangan, reveal album) tak boleh
// bisa di-clickjack → larang pembingkaian sepenuhnya. `frame-ancestors`
// mengalahkan `X-Frame-Options` di browser yang mendukung keduanya.
const noFrameHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  // Image kecil untuk Docker/Easypanel — runtime hanya `.next/standalone`.
  output: "standalone",
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: baseSecurityHeaders },
      // CSS tema = aset ber-HASH ISI (`/themes/{slug}.{hash}.css`, dihasilkan
      // `scripts/build-theme-css.mjs`) → nama berubah saat isinya berubah,
      // jadi aman di-cache selamanya. Tanpa ini `public/` default-nya
      // `max-age=0` dan setiap kunjungan ulang membayar satu request
      // revalidasi di jalur RENDER-BLOCKING.
      {
        source: "/themes/:file*.css",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      { source: "/dashboard/:path*", headers: noFrameHeaders },
      { source: "/admin/:path*", headers: noFrameHeaders },
    ];
  },
  images: {
    // Tanpa optimisasi on-the-fly (SPEC §6.4): foto sudah dikompres jadi 2 varian
    // WebP di klien & disajikan dari domain sendiri; `sharp` sengaja tidak dibundel.
    unoptimized: true,
  },
  experimental: {
    // Upload galeri (M1.4) mengirim 2 varian WebP satu foto per aksi lewat
    // Server Action. Default 1MB terlalu ketat untuk varian 1600px berkualitas;
    // 3MB memberi ruang aman (storage tetap membatasi 2MB/berkas).
    serverActions: { bodySizeLimit: "3mb" },
  },
};

/**
 * Sentry hanya membungkus konfigurasi bila DSN tersedia (production).
 * Tanpa DSN (dev/CI/M0 sebelum kredensial), build memakai config polos —
 * plugin Sentry tidak pernah berjalan sehingga build tetap hijau.
 */
const config: NextConfig = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      disableLogger: true,
      telemetry: false,
      // Upload sourcemap hanya bila auth token tersedia.
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    })
  : nextConfig;

export default config;
