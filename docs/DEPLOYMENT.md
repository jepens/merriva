# DEPLOYMENT — Merriva (Easypanel + Supabase + Cloudflare)

Panduan langkah-demi-langkah men-deploy Merriva ke VPS via Easypanel dan menghubungkan Supabase, domain, serta monitoring. Ditujukan untuk pemilik. Referensi arsitektur: [`ARCHITECTURE.md`](ARCHITECTURE.md) §8.

> **Prinsip keamanan:** semua nilai rahasia HANYA diisi di panel Easypanel / `.env.local` — tidak pernah di-commit. Daftar variabel ada di [`../.env.example`](../.env.example).

---

## 0. Prasyarat

- Domain `merriva.id` sudah dibeli.
- Akun **Supabase** — buat 2 project: `merriva-staging` & `merriva-prod` (region Singapore).
- Repo **GitHub** berisi kode ini.
- VPS dengan **Easypanel** terpasang.
- Akun **Cloudflare** (DNS), **Sentry** (opsional M0), **UptimeRobot**.

---

## 1. Push repo ke GitHub

```bash
git remote add origin git@github.com:<org>/merriva.git
git push -u origin main
```

CI (`.github/workflows/ci.yml`) otomatis menjalankan lint + typecheck + test di setiap push/PR.

---

## 2. Supabase — terapkan skema

Untuk **tiap** project (staging dulu, lalu prod):

1. Catat dari **Project Settings → API**: `Project URL`, `anon key`, `service_role key`, dan **Project Ref** (bagian subdomain URL).
2. Buat **Access Token** di <https://supabase.com/dashboard/account/tokens>.
3. Terapkan migrasi dari mesin lokal:

   ```bash
   export SUPABASE_ACCESS_TOKEN=<token>
   pnpm supabase link --project-ref <project-ref>   # akan meminta DB password
   pnpm supabase db push                            # terapkan migrasi v1 (termasuk seed packages)
   ```

4. Verifikasi di **Table Editor**: 12 tabel muncul, tabel `packages` berisi 2 baris (basic/premium), RLS aktif (ikon gembok).

> Kembangkan selalu ke **staging** dulu. `db push` ke **prod** dilakukan sadar/manual setelah teruji.

---

## 3. Buat App di Easypanel

1. **Create → App**, sumber **GitHub**, pilih repo `merriva`, branch `main`.
2. **Build**: pilih **Dockerfile** (root repo). Easypanel auto-build saat push ke `main`.
3. **Port**: `3000`.
4. **Health check**: path `/api/health` (Docker `HEALTHCHECK` juga sudah menuju ke sana).

---

## 4. Environment variables (di panel Easypanel)

Isi minimal berikut untuk M0 (sisanya menyusul per milestone):

| Variabel | Nilai |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://merriva.id` |
| `NEXT_PUBLIC_SUPABASE_URL` | dari project **prod** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dari project **prod** |
| `SUPABASE_SERVICE_ROLE_KEY` | dari project **prod** (RAHASIA) |
| `STORAGE_DRIVER` | `supabase` (atau `r2` menjelang launch) |
| `NEXT_PUBLIC_MEDIA_URL` | **WAJIB** host penyaji bucket domain sendiri — **kosong = media 404** (app gagal-keras runtime). R2: `https://cdn.merriva.id`; tetap Supabase: proxy domain sendiri |
| `CRON_SECRET` | string acak panjang |
| `NEXT_PUBLIC_SENTRY_DSN` | dari Sentry (opsional; kosong = Sentry non-aktif) |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | dari Sentry (opsional, untuk sourcemap) |

Menyusul: `PAKASIR_*` (M3), `RESEND_API_KEY` (M3), `TURNSTILE_*` (M2), `R2_*` (M4).

---

## 5. Domain + SSL

1. Di app Easypanel → **Domains** → tambahkan `merriva.id`.
2. Easypanel menerbitkan SSL Let's Encrypt otomatis via Traefik.

## 6. DNS di Cloudflare

1. Arahkan nameserver domain ke Cloudflare.
2. Tambah record `A`/`CNAME` `merriva.id` → IP/host VPS, **proxy ON (oranye)**.
3. Tambah redirect `www.merriva.id` → `merriva.id`.

## 7. Monitoring

- **UptimeRobot**: monitor HTTP(s) ke `https://merriva.id/api/health`, interval 5 menit, alert bila status ≠ 200.
- **Sentry**: isi `NEXT_PUBLIC_SENTRY_DSN` untuk mengaktifkan error tracking (FE+BE).

## 8. Verifikasi

```bash
curl -s https://merriva.id/api/health
# → {"status":"ok","db":"up",...}
```

`db":"up"` menandakan aplikasi terhubung ke Supabase. Jika `db":"down"` cek env Supabase; jika `not_configured` env belum terisi.
