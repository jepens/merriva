# Merriva

Platform SaaS **undangan digital + digital guestbook** untuk pasar Indonesia — merriva.id.
Fase saat ini: **MVP Fase 1 — undangan digital self-service**. Status: **Milestone M0 (Fondasi)**.

Dokumen sumber kebenaran ada di [`SPEC.md`](SPEC.md) dan folder [`docs/`](docs/). Instruksi agen coding: [`CLAUDE.md`](CLAUDE.md).

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 + shadcn/ui · Supabase cloud (Postgres + RLS + Auth + Storage) · media via `lib/storage/` (driver `supabase` | `r2`) · pembayaran Pakasir → BinderPay QRIS (beralih saat `BINDERPAY_PARTNER_ID` diisi — DECISIONS #102) · email Resend · anti-spam Turnstile · Sentry · deploy Dockerfile (Next standalone) → Easypanel di VPS.

## Prasyarat

- Node.js **22+**
- pnpm **11+** (`npm install -g pnpm` atau via corepack)
- Docker (untuk Supabase lokal & verifikasi image)

## Setup lokal

```bash
pnpm install
cp .env.example .env.local   # lalu isi nilainya (lihat docs/ARCHITECTURE.md §8)
pnpm dev                     # http://localhost:3000
```

## Perintah

```bash
pnpm dev                  # dev server
pnpm build && pnpm start  # build & run production lokal
pnpm lint                 # ESLint + Prettier check
pnpm format               # Prettier --write
pnpm typecheck            # tsc --noEmit
pnpm test                 # unit test (Vitest)
pnpm test:e2e             # Playwright (butuh env; jalankan `pnpm exec playwright install` sekali)
pnpm supabase <cmd>       # Supabase CLI (mis. `pnpm supabase db push`)
```

## Database (Supabase)

Skema dikelola lewat migrasi di [`supabase/migrations/`](supabase/migrations/).

```bash
pnpm supabase start                       # Postgres lokal + terapkan migrasi + seed (butuh Docker)
pnpm supabase migration new <nama>        # migrasi baru
pnpm supabase link --project-ref <ref>    # tautkan ke project staging/prod
pnpm supabase db push                     # terapkan migrasi ke project yang ter-link
```

## Struktur

Lihat [`SPEC.md` §7](SPEC.md). Ringkas: `src/app/` (route groups + `api/*`), `src/themes/` (satu folder per tema + `registry.ts`), `src/components/`, `src/lib/` (supabase, storage, payment, validation, copy), `src/server/` (actions/services/guards), `supabase/` (migrations + seed), `tests/` (unit + e2e).

## Deploy

Lihat [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (Easypanel + DNS + env) dan [`docs/RUNBOOK.md`](docs/RUNBOOK.md) (pemulihan). Deploy = push `main` → CI hijau → job promote memajukan branch `production` → Easypanel Auto Deploy (DECISIONS #64). Health check: `GET /api/health` (probe lengkap ber-DB, untuk UptimeRobot/`ops:verify`); `HEALTHCHECK` kontainer memakai liveness `GET /api/health?probe=live` — jangan isi health check di panel Easypanel.
