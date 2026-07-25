import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image kecil untuk Docker/Easypanel — runtime hanya `.next/standalone`.
  output: "standalone",
  reactStrictMode: true,
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
