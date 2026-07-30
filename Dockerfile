# syntax=docker/dockerfile:1

# ---- Base: Node 22 Alpine + pnpm via corepack ----
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---- Dependencies (frozen lockfile) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts: build Next tidak butuh postinstall dev-tool (supabase/esbuild/playwright).
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- Builder: build Next standalone ----
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* di-INLINE saat build (bukan runtime) → WAJIB tersedia ketika
# `pnpm build` berjalan, jika tidak client Supabase/Turnstile di browser dapat
# nilai `undefined` (login & RSVP rusak). Easypanel meneruskan env service sebagai
# build-arg; `ARG` menerimanya lalu `ENV` mengeksposnya ke proses build. Isi nilai
# ini di Environment service Easypanel SEBELUM build (URL & anon key juga dipakai
# untuk pra-render statis halaman marketing → Supabase harus terjangkau saat build).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MEDIA_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- Runner: image runtime minimal, non-root ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Runtime hanya berisi output standalone + aset statis + public.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# Healthcheck internal container → /api/health (busybox wget; gagal bila status non-2xx).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
