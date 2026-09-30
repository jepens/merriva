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
- [ ] **Custom SMTP Supabase Auth → Resend** — **WAJIB, bukan opsional** (Auth → Emails → SMTP Settings; host `smtp.resend.com`, port `465`, user `resend`, password = `RESEND_API_KEY`, sender = `EMAIL_FROM`).
  - Alasannya bukan sekadar kuota: SMTP bawaan Supabase **menolak mengirim ke alamat di luar anggota tim project** ("not meant for production use"), jadi tanpa ini deliverability ke pelanggan = **0%**, bukan 2 email/jam. Verifikasi email wajib (`Confirm email` aktif) → pendaftar tak akan pernah bisa masuk.
  - Kegagalannya SENYAP di sisi pengguna: `requestPasswordResetAction` sengaja selalu menjawab sukses generik (anti-enumerasi), jadi pengguna melihat "tautan sudah dikirim" walau tak ada yang terkirim. Jejaknya hanya ada di Sentry (`area: auth.signup` / `auth.reset`) → **isi `NEXT_PUBLIC_SENTRY_DSN` sebelum fase ini**, kalau tidak kegagalannya tetap tak terlihat.
  - Verify: daftar **3 akun uji dengan alamat di luar anggota tim project** dalam satu jam → ketiganya menerima email dari domain sendiri → klik tautan → berhasil masuk. Lalu `select confirmation_sent_at, email_confirmed_at from auth.users` — keduanya harus terisi. (Per 2026-10-01 `auth.users` hanya berisi 1 admin buatan manual: jalur ini **belum pernah** berhasil — AUDIT-2026-10-01 A1.)
- [ ] **Confirm email** aktif (Auth → Providers → Email) — prasyarat SPEC §4.2; setel SETELAH Custom SMTP jalan.
- [ ] **Leaked Password Protection** aktif (Supabase → Auth → Policies) — tolak password yang pernah bocor (HaveIBeenPwned). _Temuan security advisor; toggle dashboard, bukan kode._

## Fase 3 — Cron (Easypanel scheduled jobs)

Keempat endpoint dipanggil dengan header `Authorization: Bearer $CRON_SECRET`:

- [ ] `POST /api/cron/expire-orders` — tiap ~1 jam (rekonsiliasi + batalkan order > 24 jam + `transactioncancel`)
- [ ] `POST /api/cron/expire-invitations` — harian (undangan `active` lewat masa aktif → `expired` + revalidate ISR)
- [ ] `POST /api/cron/expiry-reminders` — harian (email pengingat H-14)
- [ ] `POST /api/cron/purge-expired` — harian (retensi UU PDP: hapus permanen data tamu/RSVP/media/gift_notes undangan `expired` > 6 bulan; baris undangan tinggal kerangka, `orders` dipertahankan)
- Verify: panggil manual dengan Bearer benar → `200`; tanpa/ salah secret → `401`.

## Fase 4 — Konten & data awal (via panel admin)

- [ ] **Pustaka lagu**: unggah trek **berlisensi/bebas-royalti** di `/admin/lagu` ([`MUSIC-LIBRARY.md`](MUSIC-LIBRARY.md)) — kalau kosong, musik latar undangan **senyap**.
- [ ] **Paket & harga** di `/admin/paket` sesuai rencana jual (berlaku langsung tanpa deploy)
- [ ] **Tema aktif** di `/admin/tema` sesuai yang ditawarkan
- [ ] **Akun admin**: set `profiles.role = 'admin'` untuk akun pemilik via SQL (tak ada signup admin — DATA-MODEL §1). Selanjutnya kelola peran/suspend user lewat `/admin/pengguna`.

## Fase 5 — Keandalan database & media

- [ ] **Supabase Pro** (backup harian, retensi 7 hari) — sebelum ada klien berbayar (free tier auto-pause + egress 5 GB tak cukup)
- [ ] **Latihan restore backup 1×** (RUNBOOK): restore ke project sementara, verifikasi jumlah baris & login
- [ ] **Penyaji media WAJIB dari domain sendiri** (SPEC §6.4) — `NEXT_PUBLIC_MEDIA_URL` harus menunjuk host yang menyajikan bucket; **jangan dikosongkan** (kosong = media 404, app gagal-keras). Jalur turnkey & compliant: **R2** — isi `R2_*`, `STORAGE_DRIVER=r2`, `NEXT_PUBLIC_MEDIA_URL=https://cdn.merriva.id`, CNAME `cdn.merriva.id`, jalankan `pnpm migrate:media` (ARCHITECTURE §6.4). Boleh menunda R2 & launch dengan Supabase storage **hanya bila** `NEXT_PUBLIC_MEDIA_URL` sudah menunjuk host penyaji bucket (proxy domain sendiri); pindah ke R2 sebelum event klien ramai.

## Fase 6 — Monitoring & keamanan edge

- [ ] **UptimeRobot** → `https://merriva.id/api/health`, interval 5 menit, alert bila ≠ 200
- [ ] **Sentry** aktif: isi `NEXT_PUBLIC_SENTRY_DSN` (kosong = Sentry non-aktif); picu 1 error uji → pastikan masuk
- [ ] **Cloudflare Cache Rule** untuk `/api/og/*` (Eligible for cache, cache key = path) → serap beban render OG di CDN (mitigasi DoS asimetris; security review #2)
- [ ] **Cloudflare WAF Rate Limiting** di edge sebagai lapis pertama (rate-limit app = backstop per-proses; security review #1)
- [ ] **IP klien tepercaya — AUDIT KEA-1** ([DECISIONS #37](DECISIONS.md)). Seluruh rate limit app hanya kuat bila semua butir ini benar:
  - [ ] Traefik Easypanel melihat **IP sumber publik**: port 80/443 dipublish mode **host** (bukan *ingress* Swarm, yang mengganti IP sumber dengan 10.0.x.x), `forwardedHeaders.insecure` tidak aktif, `notAppendXForwardedFor` tidak aktif. **Baca langsung konfigurasinya** (static & dynamic entrypoint), jangan hanya menyimpulkan dari log.
  - [ ] Setelah ada trafik nyata, log app **tidak** memuat `[client-ip] asal request tak bisa diverifikasi`. Bila origin punya record AAAA (Cloudflare tersambung lewat IPv6), pastikan IP sumber IPv6 juga tidak hilang di proxy Docker. _Log kosong bukan bukti bila Traefik mempercayai header masuk sambil tidak menambahkan XFF — karena itu butir di atas wajib dicek dari konfigurasi._
  - [ ] **Firewall origin**: 80/443 hanya menerima rentang Cloudflare (`src/lib/cloudflare-ips.json`). Port yang dipublish Docker melewati `ufw` → pasang di chain `DOCKER-USER` atau firewall penyedia VPS. Port app `3000` tak pernah dipublish ke publik.
  - [ ] **Authenticated Origin Pulls** Cloudflare dengan sertifikat **per-zona** (sertifikat global bisa dipakai pelanggan Cloudflare mana pun), SSL mode Full (strict), dan Traefik mewajibkan client certificate. **Hanya butir ini yang menutup KEA-1 penuh**: rentang IP Cloudflare bukan autentikasi — pelanggan Cloudflare lain (Worker `connect()`, zona mereka sendiri) tersambung dari IP Cloudflare dan bisa menulis `CF-Connecting-IP` sendiri; firewall rentang Cloudflare tak menghalanginya.
  - [ ] **Uji spoof LANGSUNG ke origin** (sebelum firewall dikunci, atau dari host yang sementara di-allowlist): arahkan `merriva.id` ke IP origin lewat file hosts perangkat uji, kirim header `CF-Connecting-IP` acak tiap request (mis. ekstensi pengubah header), lalu gagal masuk >10× dalam 1 menit → percobaan ke-11 ditolak dan log app memuat satu `[client-ip] cf-connecting-ip diabaikan`. Uji lewat `https://merriva.id` biasa TIDAK membuktikan apa pun — Cloudflare menimpa header itu. Setelah firewall + AOP aktif: akses langsung `curl --resolve merriva.id:443:<IP_ORIGIN> https://merriva.id/` → gagal di handshake TLS/timeout.
  - [ ] Workflow terjadwal **Rentang IP Cloudflare** (GitHub Actions) hijau. Bila merah: perbarui `cloudflare-ips.json` DAN allowlist firewall bersamaan.
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
- [ ] Pastikan **cron `purge-expired`** (Fase 3) terjadwal & jalan — menghapus permanen data tamu/RSVP/media/gift_notes **6 bulan pasca-expired** (UU PDP 27/2022); baris undangan tinggal kerangka statistik, `orders` (retensi keuangan) dipertahankan. Verify di staging: undangan `expired` dengan `active_until` > 6 bln lalu → panggil cron → data pribadi terhapus, `purged_at` terisi. Klien juga bisa "hapus undangan" non-aktif kapan saja dari dashboard.

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
| `NEXT_PUBLIC_MEDIA_URL` | Fase 1 | **WAJIB** host penyaji bucket dari domain sendiri. **Kosong = SELURUH foto/musik undangan 404** (app gagal-keras di runtime prod). R2: `https://cdn.merriva.id`. Tetap Supabase storage: domain proxy sendiri, atau sementara (deviasi §6.4) `https://<ref>.supabase.co/storage/v1/object/public/media` |
| `CRON_SECRET` | Fase 1/3 | string acak panjang |
| `PAKASIR_PROJECT_SLUG` / `PAKASIR_API_KEY` | Fase 2 | project production |
| `RESEND_API_KEY` / `EMAIL_FROM` | Fase 2 | domain terverifikasi |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Fase 2 | anti-spam RSVP |
| `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG/PROJECT/AUTH_TOKEN`) | Fase 6 | kosong = non-aktif |
| `R2_*` | Fase 5 | hanya bila `STORAGE_DRIVER=r2` |
| `PEXELS_API_KEY` | opsional | foto contoh demo |
