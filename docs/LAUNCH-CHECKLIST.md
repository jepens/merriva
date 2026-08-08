# LAUNCH-CHECKLIST — Peta kesiapan go-live Merriva

**Status kode:** MVP **M0–M4 pada dasarnya selesai** — seluruh jalur inti terbukti
di kode (fondasi + migrasi/RLS, auth, editor, halaman publik & tamu, checkout +
webhook Pakasir + cron + email + enforcement limit, panel admin + 10 tema +
marketing + driver R2 + harness k6). **Sisa menuju launch = eksekusi OPS** yang
tak bisa dilakukan dari repo (deploy, DNS, monitoring eksternal, plan berbayar,
uji lapangan). Checklist ini mengurutkannya dari nol → go-live.

> Detail langkah infra: [`DEPLOYMENT.md`](DEPLOYMENT.md) · pemulihan bencana:
> [`RUNBOOK.md`](RUNBOOK.md) · arsitektur/integrasi: [`ARCHITECTURE.md`](ARCHITECTURE.md).
> `[ ]` di sini = tindakan OPS pemilik (bukan pekerjaan kode).

---

## Fase 1 — Provisioning & deploy awal (→ DEPLOYMENT.md §0–§8)

- [ ] Prasyarat: domain `merriva.id`, 2 project Supabase (staging + prod, region Singapore), repo GitHub, VPS + Easypanel, akun Cloudflare
- [ ] Terapkan migrasi ke Supabase **staging → prod**: `pnpm supabase link` lalu `pnpm supabase db push`
  - ⚠️ **Termasuk migrasi `20260804190000_widen_media_bucket_audio`** (bucket `media` menerima MIME audio + 8 MB) — WAJIB ada sebelum pustaka lagu dipakai, kalau tidak unggah audio ditolak 415.
  - Verify: Table Editor menampilkan 12 tabel, `packages` berisi 2 baris, RLS aktif (gembok).
- [ ] App Easypanel dari repo (auto-deploy saat push `main`), Dockerfile, port `3000`, healthcheck `/api/health`
- [ ] Env production terisi (lihat tabel di bawah)
- [ ] Domain + SSL (Easypanel/Traefik), DNS Cloudflare **proxy ON**, redirect `www` → apex
- [ ] Verify: `curl https://merriva.id/api/health` → `{"status":"ok","db":"up"}`

## Fase 2 — Konfigurasi layanan pihak ketiga

- [ ] **Pakasir**: project production; set webhook URL → `https://merriva.id/api/webhooks/pakasir`; isi `PAKASIR_PROJECT_SLUG` + `PAKASIR_API_KEY`
- [ ] **Resend**: verifikasi domain (SPF/DKIM); `RESEND_API_KEY` + `EMAIL_FROM` (alamat di domain terverifikasi)
- [ ] **Turnstile**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
- [ ] **Email verifikasi signup** aktif via Supabase Auth (bawaan). _(Opsional: arahkan SMTP Supabase Auth → Resend agar email verifikasi seragam dengan kuitansi/reminder.)_
- [ ] **Leaked Password Protection** aktif (Supabase → Auth → Policies) — tolak password yang pernah bocor (HaveIBeenPwned). _Temuan security advisor; toggle dashboard, bukan kode._

## Fase 3 — Cron (Easypanel scheduled jobs)

Ketiga endpoint dipanggil dengan header `Authorization: Bearer $CRON_SECRET`:

- [ ] `POST /api/cron/expire-orders` — tiap ~1 jam (rekonsiliasi + batalkan order > 24 jam + `transactioncancel`)
- [ ] `POST /api/cron/expire-invitations` — harian (undangan `active` lewat masa aktif → `expired` + revalidate ISR)
- [ ] `POST /api/cron/expiry-reminders` — harian (email pengingat H-14)
- Verify: panggil manual dengan Bearer benar → `200`; tanpa/ salah secret → `401`.

## Fase 4 — Konten & data awal (via panel admin)

- [ ] **Pustaka lagu**: unggah trek **berlisensi/bebas-royalti** di `/admin/lagu` ([`MUSIC-LIBRARY.md`](MUSIC-LIBRARY.md)) — kalau kosong, musik latar undangan **senyap**.
- [ ] **Paket & harga** di `/admin/paket` sesuai rencana jual (berlaku langsung tanpa deploy)
- [ ] **Tema aktif** di `/admin/tema` sesuai yang ditawarkan
- [ ] **Akun admin**: set `profiles.role = 'admin'` untuk akun pemilik via SQL (tak ada signup admin — DATA-MODEL §1). Selanjutnya kelola peran/suspend user lewat `/admin/pengguna`.

## Fase 5 — Keandalan database & media

- [ ] **Supabase Pro** (backup harian, retensi 7 hari) — sebelum ada klien berbayar (free tier auto-pause + egress 5 GB tak cukup)
- [ ] **Latihan restore backup 1×** (RUNBOOK): restore ke project sementara, verifikasi jumlah baris & login
- [ ] _(Opsional, saat media membesar)_ **Aktivasi R2**: isi `R2_*`, set `STORAGE_DRIVER=r2` + `NEXT_PUBLIC_MEDIA_URL=https://cdn.merriva.id`, CNAME `cdn.merriva.id`, jalankan `pnpm migrate-media` (ARCHITECTURE §6.4). **Boleh launch dulu dengan Supabase storage**; pindah ke R2 sebelum event klien ramai.

## Fase 6 — Monitoring & keamanan edge

- [ ] **UptimeRobot** → `https://merriva.id/api/health`, interval 5 menit, alert bila ≠ 200
- [ ] **Sentry** aktif: isi `NEXT_PUBLIC_SENTRY_DSN` (kosong = Sentry non-aktif); picu 1 error uji → pastikan masuk
- [ ] **Cloudflare Cache Rule** untuk `/api/og/*` (Eligible for cache, cache key = path) → serap beban render OG di CDN (mitigasi DoS asimetris; security review #2)
- [ ] **Cloudflare WAF Rate Limiting** di edge sebagai lapis pertama (rate-limit app = backstop per-proses; security review #1)
- [ ] **Turnstile**: kunci _allowed hostnames_ widget ke `merriva.id` di dashboard Cloudflare (server sudah cek hostname; ini lapis utama)
- [ ] **Supabase Auth**: aktifkan _Secure password change_ (re-auth ganti sandi) + review `[auth.rate_limit]`/`[auth.captcha]` project cloud

## Fase 7 — Uji pra-launch (SPEC §10) — WAJIB sebelum umum

- [ ] Buka undangan dari **WA in-app browser di Android & iOS asli** (bukan hanya Chrome desktop)
- [ ] **Lighthouse mobile ≥ 90 pada 3 tema** (LCP < 2,5 dtk di 4G)
- [ ] **Bayar production nominal kecil (Rp10.000, paket uji) end-to-end** → aktif + kuitansi email masuk < 1 menit
- [ ] **Restore backup Supabase** pernah dicoba (Fase 5)
- [ ] **Uji beban k6 200 VU** (`pnpm loadtest`, target staging/prod dengan slug aktif) → p95 < 800 ms, error < 1%

## Fase 8 — Kepatuhan (sebelum promosi besar)

- [ ] Daftar **PSE Kominfo** via OSS
- [ ] Kebijakan **privasi & refund** tayang (`/privasi`, `/refund` sudah ada — review isi & data kontak)
- [ ] Pastikan retensi/hapus data tamu **6 bulan pasca-expired** (UU PDP 27/2022) berjalan lewat cron expiry

## Fase 9 — Go-live

- [ ] **10 undangan uji lintas 3 kategori** (wedding/corporate/family) — Definition of Done M4
- [ ] Semua fase di atas hijau → umumkan
- [ ] Pantau Sentry + UptimeRobot intensif di hari-hari pertama; siapkan RUNBOOK bila insiden

---

## Lampiran — Env production (ringkas; detail DEPLOYMENT §4)

| Variabel | Kapan | Catatan |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Fase 1 | `https://merriva.id` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fase 1 | project **prod** |
| `SUPABASE_SERVICE_ROLE_KEY` | Fase 1 | RAHASIA |
| `STORAGE_DRIVER` | Fase 1 | `supabase` (→ `r2` di Fase 5) |
| `NEXT_PUBLIC_MEDIA_URL` | Fase 1/5 | kosong saat Supabase; `https://cdn.merriva.id` saat R2 |
| `CRON_SECRET` | Fase 1/3 | string acak panjang |
| `PAKASIR_PROJECT_SLUG` / `PAKASIR_API_KEY` | Fase 2 | project production |
| `RESEND_API_KEY` / `EMAIL_FROM` | Fase 2 | domain terverifikasi |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Fase 2 | anti-spam RSVP |
| `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG/PROJECT/AUTH_TOKEN`) | Fase 6 | kosong = non-aktif |
| `R2_*` | Fase 5 | hanya bila `STORAGE_DRIVER=r2` |
| `PEXELS_API_KEY` | opsional | foto contoh demo |
