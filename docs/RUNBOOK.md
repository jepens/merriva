# RUNBOOK — Pemulihan Merriva

Prosedur singkat pemulihan ketika VPS/aplikasi bermasalah. Prinsip inti: **aplikasi stateless** — seluruh data persisten ada di **Supabase** (dan **R2** mulai M4), sehingga VPS mati **tidak** menghilangkan data. Pemulihan = deploy ulang container + arahkan DNS.

## Komponen & lokasi data

| Komponen | Tempat | Hilang bila VPS mati? |
|---|---|---|
| Aplikasi Next.js | Container Docker di VPS (Easypanel) | Ya — tapi bisa dibangun ulang dari repo Git |
| Database (Postgres + Auth) | Supabase cloud | Tidak |
| Media (foto) | Supabase Storage → R2 (M4) | Tidak |
| Secrets/env | Panel Easypanel (+ password manager pemilik) | Perlu diisi ulang saat provision baru |
| DNS | Cloudflare | Tidak |

## Skenario A — Aplikasi/kontainer rusak (VPS masih hidup)

1. Easypanel → app `merriva` → **Logs** untuk diagnosa.
2. **Redeploy** (atau restart) app. Easypanel membangun ulang dari `main`.
3. Verifikasi: `curl -s https://merriva.id/api/health` → `{"status":"ok","db":"up"}`.

## Skenario B — VPS mati total

1. Provision VPS baru, pasang **Easypanel**.
2. Buat app dari repo Git (Dockerfile), port `3000` — lihat [`DEPLOYMENT.md`](DEPLOYMENT.md) §3–4.
3. Isi ulang **environment variables** di panel (dari password manager) — lihat [`../.env.example`](../.env.example).
4. Attach domain `merriva.id` + SSL.
5. Cloudflare → arahkan DNS `merriva.id` ke IP/host VPS baru (proxy ON).
6. Verifikasi `https://merriva.id/api/health`.

> Karena data di Supabase, tidak ada langkah restore DB pada skenario ini — cukup deploy ulang.

## Backup & restore database

- **Supabase Pro**: backup harian otomatis (retensi 7 hari). Upgrade ke Pro **sebelum** ada klien berbayar.
- **Latihan restore wajib 1×** sebelum launch (checklist M4): restore backup ke project sementara, verifikasi jumlah baris & login.
- Restore PITR/backup dilakukan dari **Supabase Dashboard → Database → Backups**.

## Data migrasi & skema

- Skema dikelola via `supabase/migrations/`. Terapkan ke project: `pnpm supabase db push` (setelah `supabase link`).
- **Selalu** uji migrasi di **staging** dulu; snapshot/backup sebelum migrasi destruktif di production (boundary wajib).

## Checklist kredensial pemulihan (simpan di password manager)

- Supabase: URL + anon + service_role (prod), Access Token, DB password
- Easypanel: akses panel VPS
- Cloudflare: akses akun/DNS
- Domain registrar, Pakasir, Resend, Sentry (sesuai milestone)

## Verifikasi pasca-pemulihan

```bash
curl -s https://merriva.id/api/health   # harap: {"status":"ok","db":"up",...}
```

Pantau juga UptimeRobot kembali hijau dan Sentry tidak menampilkan error baru.
