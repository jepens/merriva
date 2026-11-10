# DEPLOYMENT — Merriva (Easypanel + Supabase + Cloudflare)

**Direvisi 2026-10-12** — beberapa bagian versi awal (branch `main`, "menyusul per milestone", "12 tabel", Sentry opsional) sudah usang dan dikoreksi di tempatnya; koreksinya ditandai agar terlihat bila Anda pernah membaca versi lama.

Panduan langkah-demi-langkah men-deploy Merriva ke VPS via Easypanel dan menghubungkan Supabase, domain, serta monitoring. Ditujukan untuk pemilik. Referensi arsitektur: [`ARCHITECTURE.md`](ARCHITECTURE.md) §8.

> **Prinsip keamanan:** semua nilai rahasia HANYA diisi di panel Easypanel / `.env.local` — tidak pernah di-commit. Daftar variabel ada di [`../.env.example`](../.env.example).

---

## 0. Prasyarat

- Domain `merriva.id` sudah dibeli.
- Akun **Supabase** — buat 2 project: `merriva-staging` & `merriva-prod` (region Singapore).
- Repo **GitHub** berisi kode ini.
- VPS dengan **Easypanel** terpasang.
- Akun **Cloudflare** (DNS), **Sentry**, **UptimeRobot**.
  - Sentry **tidak lagi opsional seperti tertulis di versi awal dokumen ini**: ia satu-satunya jejak untuk kegagalan yang sengaja senyap di sisi pengguna — reset kata sandi selalu menjawab sukses generik demi anti-enumerasi, jadi SMTP yang menolak kirim hanya terlihat di Sentry. `NEXT_PUBLIC_SENTRY_DSN` juga **build-arg**, jadi isi SEBELUM build pertama (lihat [`AUTH-SETUP.md` §4](AUTH-SETUP.md)).

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

4. Verifikasi di **Table Editor**: **15 tabel** muncul (angka "12" di versi awal dokumen ini usang sejak FASE H + `cron_runs`), **semuanya** ber-RLS aktif (ikon gembok), dan `packages` memuat `basic` + `premium` pada `kind='invitation'`.

   > ⚠️ **Jangan pakai jumlah baris `packages` sebagai kriteria** — isinya **7**, bukan 2: dua paket undangan plus lima tingkat add-on Album Momen yang di-seed migrasi `20260826110000`. Dan jangan pakai `/api/health` sebagai bukti migrasi sudah masuk: probe-nya sengaja tak bergantung skema, jadi project yang terjangkau tapi **kosong** tetap menjawab `{"status":"ok","db":"up"}`.

   > ⚠️ **Migrasi harus selesai SEBELUM build pertama di Easypanel.** Pra-render `/`, `/harga`, `/tema` membaca DB saat `next build` dan `throw` bila gagal (`src/server/marketing/catalog.ts`) — project kosong **atau di-pause** berarti **build MERAH**, bukan halaman kosong.

> Kembangkan selalu ke **staging** dulu. `db push` ke **prod** dilakukan sadar/manual setelah teruji.

---

## 3. Buat App di Easypanel

1. **Create → App**, sumber **GitHub**, pilih repo `merriva`, branch **`production`** — **bukan `main`**.

   > ⚠️ **Koreksi penting (2026-10-12).** Versi awal dokumen ini menulis `main` dan "auto-build saat push ke `main`"; itu ditulis sebelum gerbang deploy ada. Sejak [DECISIONS #64](DECISIONS.md), CI mem-**fast-forward** branch `production` ke commit `main` HANYA setelah job `verify` **dan** `db` (pgTAP) hijau — tanpa `--force`, sehingga `production` tak bisa mundur atau bercabang diam-diam. Repo ini **tidak punya branch protection** (plan privat gratis), jadi `production` adalah satu-satunya gerbang yang ada. Menyetel `main` di sini membuat gerbangnya **tidak berlaku sama sekali**: commit ber-CI-merah tetap mendarat di produksi.

2. **Build**: pilih **Dockerfile** (root repo).
3. **Build args** — isi keenam variabel bertanda 🏗️ di [LAUNCH-CHECKLIST Lampiran](LAUNCH-CHECKLIST.md) sebagai **build arg**, bukan hanya env runtime. Next meng-INLINE nilainya ke bundel saat build, dan `.dockerignore` membuang `.env*` dari konteks build — jadi di dalam Docker nilainya **hanya** bisa datang dari build-arg. Mengisinya setelah image jadi tidak berpengaruh sampai **rebuild**.
4. **Port**: `3000` — **harus** `3000`: `HEALTHCHECK` di Dockerfile mem-hardcode `127.0.0.1:3000`, jadi port lain membuat healthcheck gagal dan container masuk restart loop.
5. **Health check: jangan diisi di panel.** `HEALTHCHECK` Dockerfile sudah memakai liveness `/api/health?probe=live` (tanpa probe DB — [DECISIONS #110](DECISIONS.md)). Health check panel yang menembak `/api/health` lengkap akan menimpanya dan mengembalikan probe DB — penyebab 502 pada 3 Nov 2026, ketika `HEALTHCHECK` image sendiri masih memakai probe lengkap: Swarm membunuh kontainer sehat saat koneksi VPS→Supabase tersendat.
6. **Auto Deploy: nyalakan** — kecuali Anda ingin mengatur sendiri kapan produksi restart (mis. tidak saat acara klien berlangsung), karena setiap promosi langsung me-restart produksi. Easypanel memasang webhook `push` di repo; karena branch-nya `production`, yang dibangun selalu commit yang sudah dipromosikan CI (push ke branch lain tidak memicu build — diuji 10 Nov 2026, LAUNCH-CHECKLIST Fase 1). Webhook-nya menembak panel di `http://<IP VPS>:3000` — panel harus terjangkau GitHub; menutup port itu mematikan Auto Deploy. Tanpa Auto Deploy, tekan **Deploy** sesudah job **Promosikan ke production** hijau (sebelum itu `production` belum maju).

---

## 4. Environment variables (di panel Easypanel)

> **Cara terpendek mengisi bagian ini:** `cp .env.example .env.production.local`,
> isi berkas itu, lalu `pnpm env:check --prod`. Perintah itu menyebutkan persis apa
> yang masih kosong, apa akibatnya bila dibiarkan, dan mana yang wajib jadi
> build-arg — lalu salin isinya ke panel Easypanel. Berkas itu ter-gitignore dan
> hanya dimuat saat `NODE_ENV=production`, jadi `pnpm dev` tak pernah memakainya.
>
> **JANGAN menaruh nilai produksi di `.env`.** Next memuat `.env` sebagai lapis
> TERENDAH, termasuk saat `pnpm dev` — jadi variabel yang tak ada di `.env.local`
> akan diambil dari sana, dan dev menulis ke data produksi tanpa satu pun
> peringatan. `pnpm env:check` memperingatkan bila kedua berkas menunjuk project
> Supabase yang berbeda.

> **Versi awal dokumen ini menulis "sisanya menyusul per milestone" dan menandai `PAKASIR_*` (M3), `RESEND_API_KEY` (M3), `TURNSTILE_*` (M2) sebagai nanti. Ketiga milestone itu sudah selesai — semuanya dibutuhkan SEKARANG.** Daftar otoritatifnya ada di [LAUNCH-CHECKLIST Lampiran](LAUNCH-CHECKLIST.md); tabel di bawah hanya ringkasan Fase 1.

🏗️ = **build arg**, bukan hanya env runtime (lihat §3.3).

| Variabel | Nilai |
|---|---|
| 🏗️ `NEXT_PUBLIC_APP_URL` | `https://merriva.id`. **Kosongnya tidak menimbulkan galat apa pun** — default-nya `http://localhost:3000`, dan dari situ diturunkan daftar hostname yang sah untuk token Turnstile. Akibatnya RSVP, buku ucapan, konfirmasi hadiah, sesi tamu Momen, daftar akun, dan reset kata sandi semuanya ditolak — dengan pesan yang MENYESATKAN: RSVP berbunyi "Terlalu banyak percobaan", dan reset kata sandi menjawab **sukses palsu** "tautan sudah dikirim" |
| 🏗️ `NEXT_PUBLIC_SUPABASE_URL` | dari project **prod** |
| 🏗️ `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dari project **prod** (memang publik by design, dilindungi RLS — jangan tertukar dengan service_role) |
| `SUPABASE_SERVICE_ROLE_KEY` | dari project **prod** (RAHASIA). **Paling kritis:** halaman undangan publik `/[slug]` dirender lewat klien service_role, jadi tanpa kunci ini SETIAP undangan 500 untuk SEMUA tamu — bukan hanya webhook/cron/admin |
| `MOMEN_SESSION_SECRET` | `openssl rand -hex 32`. Rahasia HMAC cookie sesi tamu Album Momen. Melempar di produksi bila kosong, tetapi **lazily**: app start normal, yang 500 hanya `/[slug]/momen` saat tamu di acara mencoba mengunggah foto |
| `PAKASIR_PROJECT_SLUG` / `PAKASIR_API_KEY` | project **production** Pakasir — jalur bayar **lama**: dipakai hanya selama `BINDERPAY_PARTNER_ID` kosong (produksi saat ini) dan dipensiunkan saat peralihan ke BinderPay. Selama dipakai keduanya GAGAL-KERAS: slug kosong mematikan tombol bayar; api_key kosong juga mematikannya (v2 `create-transaction` menuntut `X-Api-Key`) sekaligus verifikasi otoritatif `transaction-status`, sehingga webhook & cron TAK PERNAH bisa mengaktifkan order lunas. Manifest tetap menandai keduanya wajib (`env:check --prod` menagihnya) sampai kode Pakasir dihapus |
| `BINDERPAY_PARTNER_ID` / `BINDERPAY_BASE_URL` | gateway pengganti Pakasir (QRIS, [DECISIONS #102](DECISIONS.md)). **`BINDERPAY_PARTNER_ID` adalah saklar GLOBAL**: begitu terisi, SEMUA penerbitan QR, verifikasi, dan pembatalan lewat BinderPay — termasuk order era Pakasir. Isi HANYA saat peralihan (LAUNCH-CHECKLIST Fase 2b langkah 1–4 dulu). Manifest menandai keempat `BINDERPAY_*` `opsional` sampai kode Pakasir dihapus, jadi `env:check --prod` tidak menagihnya — peringatan "JANGAN diisi sebelum Fase 2b" ikut tercetak di sana. Base URL = host **produksi** `https://api.binderpay.id` (host sandbox DITOLAK di produksi); ID terisi tanpa base URL/kunci privat = galat keras, tidak jatuh ke Pakasir. Mengosongkan ID lagi **tidak aman** selama ada order BinderPay `pending` (≤ 24 jam): verifikasinya kembali ke Pakasir, yang tak mengenal `txn_id`-nya |
| `BINDERPAY_PRIVATE_KEY_B64` / `BINDERPAY_PUBLIC_KEY_B64` | PEM ter-base64 satu baris. Privat = kunci KITA (RAHASIA; pasangan **produksi** terpisah dari sandbox, kunci publiknya diunggah ke proyek produksi BinderPay) — kosong/salah = tak ada QR terbit dan tak ada verifikasi lunas. Publik = kunci BinderPay — kosong = callback tak terautentikasi: tetap diproses (bukti lunas dari query) tetapi dilaporkan ke Sentry sebagai `payment.webhook.binderpay-key-unset` |
| `RESEND_API_KEY` / `EMAIL_FROM` | domain terverifikasi. Kosong = **seluruh email no-op tanpa satu pun galat** |
| 🏗️ `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | secret kosong di produksi = **GAGAL-TUTUP total** pada semua form, satu `console.error` per permintaan, nol event Sentry |
| `STORAGE_DRIVER` | `local` (disk VPS, lihat §4a), `supabase`, atau `r2`. Salah ketik kini **melempar** — dulu ia jatuh diam-diam ke `supabase` |
| `MEDIA_ROOT` | hanya driver `local`; boleh kosong (default `data/media` = `/app/data/media`). Yang berbahaya bukan variabelnya melainkan **lupa memasang volume ke sana** |
| 🏗️ `NEXT_PUBLIC_MEDIA_URL` | **WAJIB** host penyaji media dari domain sendiri — **kosong = kontainer tak pernah sehat**: SENGAJA tidak dicek saat build (CI tetap hijau), tetapi liveness `/api/health?probe=live` menjawab 503 `media-env-invalid` sejak kontainer start → HEALTHCHECK gagal → Swarm membunuhnya berulang, jadi image itu tak pernah menerima trafik (§8, DECISIONS #110). `local`: `https://merriva.id/media`; R2: `https://cdn.merriva.id`; tetap Supabase: proxy domain sendiri, dan **bucket `media` harus PUBLIC** |
| `CRON_SECRET` | string acak panjang |
| 🏗️ `NEXT_PUBLIC_SENTRY_DSN` | dari Sentry. Kosong = Sentry non-aktif — dan karena itu kegagalan SMTP yang senyap di sisi pengguna menjadi tak terlihat sama sekali. Isi SEBELUM menyentuh Custom SMTP |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | dari Sentry (opsional, untuk sourcemap) |

`R2_*` hanya bila `STORAGE_DRIVER=r2`; `STORAGE_DRIVER` sendiri punya default `supabase` bila KOSONG, jadi boleh dikosongkan di fase awal — tetapi nilai yang tak dikenali melempar, bukan jatuh ke default. Kredensial R2 dibaca **lazily** dan hanya pada upload/hapus — jadi R2 yang salah-konfigurasi tidak mematikan pembacaan media: halaman undangan tetap tampil, yang gagal hanya unggah foto/lagu.

---

## 4a. Volume media (WAJIB bila `STORAGE_DRIVER=local`)

Driver `local` menyimpan foto & lagu di disk VPS dan menyajikannya lewat route `/media/[...path]` milik app ini (SPEC §6.4, DECISIONS #82).

> ⚠️ **Ini langkah yang paling mudah terlewat dan paling mahal bila terlewat.** Tanpa volume, unggah tetap **berhasil** — ke lapisan container yang dibuang setiap deploy. Tidak ada galat, tidak ada peringatan; seluruh foto klien baru hilang pada rebuild berikutnya. App tidak bisa membedakannya: bagi `fs`, direktori yang ter-mount dan yang tidak sama saja.

1. Easypanel → service **merriva** → tab **Mounts** → **Add Mount**
   - Type: **Volume**
   - Name: `media`
   - Mount Path: `/app/data/media`
2. Environment: `STORAGE_DRIVER=local`, `NEXT_PUBLIC_MEDIA_URL=https://merriva.id/media` (🏗️ **build-arg** — hanya berlaku setelah **rebuild**, bukan restart).
3. Deploy, lalu **buktikan mount-nya nyata** — bukan percaya pada UI:
   ```bash
   # di VPS
   C=$(docker ps --format '{{.Names}}' | grep '^etc_merriva' | head -1)
   docker inspect "$C" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
   ```
   Harus muncul baris yang berujung `/app/data/media`. Sumbernya volume Docker BERNAMA `<proyek>_merriva_media` (proyek `etc` → `etc_merriva_media`); host path-nya dibaca, bukan ditebak: `docker volume inspect -f '{{.Mountpoint}}' etc_merriva_media` → `/var/lib/docker/volumes/etc_merriva_media/_data`. Bind path `/etc/easypanel/projects/etc/merriva/volumes/media` memang ada tetapi KOSONG — jangan dicadangkan.
4. Uji daur hidupnya sekali, sekarang juga, selagi belum ada klien: unggah satu foto → **redeploy** → buka editornya lagi. Foto yang masih tampil adalah satu-satunya bukti yang berarti.

Backup: snapshot harian volume ini ke R2 lewat crontab host — pemasangan di LAUNCH-CHECKLIST Fase 5, pemulihan di RUNBOOK "Backup & restore media" (DECISIONS #117). Proyek Easypanel bernama selain `etc` → pasang dengan `VOLUME=<proyek>_merriva_media`.

---

## 5. Domain + SSL

1. Di app Easypanel → **Domains** → tambahkan `merriva.id`.
2. Easypanel menerbitkan SSL Let's Encrypt otomatis via Traefik.

## 6. DNS di Cloudflare

1. Arahkan nameserver domain ke Cloudflare.
2. Tambah record `A`/`CNAME` `merriva.id` → IP/host VPS, **proxy ON (oranye)**.
3. Tambah redirect `www.merriva.id` → `merriva.id`.
4. **Record `MX` + mailbox untuk `halo@merriva.id`** (mis. Cloudflare Email Routing → inbox Anda). Verifikasi domain di Resend hanya memberi hak **mengirim** — SPF/DKIM tidak membuat kotak masuk. Alamat itu tercetak di `/syarat`, `/privasi`, `/refund` sebagai kanal resmi **permintaan hapus data UU PDP**, di halaman pesanan pelanggan, dan sebagai **jalur banding** di email penangguhan. Tanpa MX, semuanya memantul.
4. **Kunci origin ke Cloudflare** — port Traefik mode host, firewall origin ke rentang Cloudflare, Authenticated Origin Pulls. Tanpa ini IP klien untuk rate limit dapat dipalsukan (AUDIT KEA-1). Langkah & verifikasinya: [LAUNCH-CHECKLIST](LAUNCH-CHECKLIST.md) Fase 6, alasannya: [DECISIONS #37](DECISIONS.md).

## 7. Monitoring

- **UptimeRobot**: monitor HTTP(s) ke `https://merriva.id/api/health`, interval 5 menit, alert bila status ≠ 200.
- **Sentry**: isi `NEXT_PUBLIC_SENTRY_DSN` untuk mengaktifkan error tracking (FE+BE).

## 8. Verifikasi

```bash
curl -s https://merriva.id/api/health
# → {"status":"ok","db":"up",...}
```

`db":"up"` menandakan aplikasi terhubung ke Supabase. Jika `db":"down"` cek env Supabase; jika `not_configured` env belum terisi.

> ⚠️ **`200 ok` BUKAN bukti produk hidup — dan justru hijau pada salah-konfigurasi terburuk.** Status sehat dihitung `db !== "down"`, sementara env Supabase yang KOSONG menghasilkan `"not_configured"`, bukan `"down"`. Jadi probe lengkap tetap 200 dan UptimeRobot menilai container tanpa env Supabase sama sekali **sehat**, padahal setiap halaman melempar 500. HEALTHCHECK Docker (liveness `?probe=live`, DECISIONS #110) bahkan tak menyentuh DB: kontainer dinilai sehat apa pun keadaan Supabase. Health juga tak menyentuh Pakasir, Resend, Turnstile, bucket media, maupun kesehatan cron (field `cronSecret` hanya melaporkan keberadaan secret). `NEXT_PUBLIC_MEDIA_URL` justru DIPERIKSA di kedua probe, termasuk liveness: kosong, salah bentuk, atau tak padu dengan `STORAGE_DRIVER` → 503 (`media-env-invalid` / `media-url-tak-sah` / `media-url-basi`) → HEALTHCHECK gagal dan Swarm membunuh kontainer — sengaja, agar image yang salah tak menerima trafik (DECISIONS #110). Pasang monitor kedua ke satu `/{slug}` undangan aktif dengan keyword (nama mempelai) dan ketiga ke satu URL media nyata — [LAUNCH-CHECKLIST Fase 6](LAUNCH-CHECKLIST.md).
