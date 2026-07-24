import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image kecil untuk Docker/Easypanel — runtime hanya `.next/standalone`.
  output: "standalone",
  reactStrictMode: true,
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
