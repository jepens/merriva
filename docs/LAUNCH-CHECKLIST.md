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

## Status terverifikasi — 15 Oktober 2026

Diambil **dari produksi**, bukan dari dasbor dan bukan dari ingatan: konfigurasi Auth
dibaca lewat Management API (`GET /v1/projects/{ref}/config/auth`), DNS lewat resolver
publik, sisanya lewat HTTP ke `merriva.id` dan query ke DB prod. Angka di bawah adalah
nilai yang benar-benar terbaca hari itu.

> **Jangan percaya tabel ini bila tanggalnya sudah lama — jalankan `pnpm ops:verify`.**
> Ia mengulang persis pemeriksaan di bawah dan keluar dengan kode 1 bila ada yang
> GAGAL. Tabel ini adalah keluarannya pada 15 Okt 2026, bukan janji yang berlaku
> selamanya. Butir yang tak bisa diperiksa dilaporkan "TIDAK DIPERIKSA" dan bukan
> berarti aman. Endpoint `/api/cron/*` sengaja tak dipanggil: memanggilnya berarti
> menjalankan job-nya (membatalkan order, mengirim email, menghapus data retensi).

**Terbukti jalan:**

| Butir | Bukti |
|---|---|
| Kedua template email `{{ .TokenHash }}` | `mailer_templates_confirmation_content` **dan** `..._recovery_content` keduanya memuat `{{ .TokenHash }}` + `/auth/confirm`. Ini lebih kuat dari uji `POST /verify`: yang dibaca adalah konfigurasinya sendiri, bukan jejak satu klik |
| Custom SMTP → Resend | `smtp_host=smtp.resend.com`, user `resend`, password terisi, sender `noreply@merriva.id`. **Pengiriman terbukti**: satu akun daftar 14 Okt 10:30:31 dan `email_confirmed_at` terisi 10:30:43 — email diterima dan diklik dalam 12 detik |
| Confirm email aktif | `mailer_autoconfirm=false`, `disable_signup=false`, `rate_limit_email_sent=25`/jam |
| Redirect allow list | memuat `/auth/callback`, `/auth/confirm`, dan `https://merriva.id/**` |
| Google OAuth | provider aktif, client id + secret terisi, dan satu login Google sungguhan berhasil (`last_sign_in_at` terisi → kodenya benar-benar ditukar, bukan kegagalan senyap #76) |
| **Volume media selamat dari redeploy** | objek yang diunggah 14 Okt tetap menjawab `200 image/webp` dari `https://merriva.id/media/…` setelah container naik ulang (commit `9302754`). Menutup butir lifecycle Fase 1 yang sebelumnya hanya asumsi |
| Konten awal | 6 lagu aktif, 10 tema aktif, 1 admin, 5 add-on Momen nonaktif, `basic` 99rb + `premium` 199rb aktif |
| Identitas pelaku usaha | tayang di `/syarat`, `/privasi`, `/refund` → gerbang checkout (#88) terbuka |
| `site_url` bertrailing-slash | `https://merriva.id/` membuat tautan email jadi `//auth/confirm`. **Diuji: tidak merusak** — kedua bentuk sama-sama `303 → /masuk?error=verify` |

**Masih terbuka, dengan nilai yang terbaca hari itu:**

| Butir | Nilai terbaca | Akibat bila dibiarkan |
|---|---|---|
| `mailer_otp_exp` | **3600** | harus ≤ 1800. Tautan reset yang diklik di menit 31–60 LOLOS GoTrue lalu DITOLAK aplikasi — pengguna sudah masuk, melihat form, lalu ditolak tanpa tahu sebabnya |
| `password_min_length` | **6** | aplikasi dan `supabase/config.toml` memakai 8; jalur yang tak lewat form Merriva jadi lebih longgar |
| `password_hibp_enabled` | **false** | Leaked Password Protection mati |
| `NEXT_PUBLIC_SENTRY_DSN` | **kosong di bundel produksi** | SDK Sentry 10.67.0 ikut terkirim tetapi tanpa DSN sama sekali → tidak aktif. Seluruh kegagalan yang sengaja senyap (SMTP, webhook, cron) tak terlihat oleh siapa pun |
| `cron_runs` | **kosong** | belum satu pun dari keempat cron pernah jalan → rekonsiliasi pembayaran dan retensi UU PDP belum hidup |
| `orders` / undangan `active` | **0 / tidak ada** | jalur uang belum pernah berjalan di produksi. Tak ada `/{slug}` publik, jadi uji ISR dan monitor kedua belum bisa dipasang |
| MX `merriva.id` | **tidak ada** | `halo@merriva.id` tak bisa MENERIMA email — padahal ia kanal resmi hapus-data UU PDP di tiga halaman hukum. SPF ada di `send.merriva.id` dan DKIM `resend._domainkey` ada, jadi **kirim aman, terima tidak**. DMARC juga belum ada |
| `smtp_sender_name` | **`noreply`** | setiap email auth tampil dari pengirim bernama "noreply", bukan "Merriva" |
| Template Confirm signup | `</a>>` | ada satu `>` nyasar sesudah tag penutup → satu karakter ">" tercetak di bawah tombol |

---

## Urutan kerja — apa yang memblokir apa

Fase di bawah disusun per TEMA, bukan per ketergantungan. Delapan urutan berikut tidak
boleh ditukar; sisanya bebas. Semuanya ditemukan dengan membaca kode, bukan disusun dari
kebiasaan (DECISIONS #69).

1. **Migrasi Supabase prod → SEBELUM build pertama di Easypanel.** Pra-render `/`,
   `/harga`, `/tema` membaca DB saat `next build` dan `throw` bila gagal. Project yang
   kosong **atau di-pause** berarti build MERAH — image-nya tidak pernah lahir. Ini
   syarat, bukan preferensi.
2. **Branch `production` di Easypanel → sebelum deploy apa pun yang Anda anggap
   terlindungi.** Selama panel masih mengawasi `main`, gerbang CI tidak berlaku sama
   sekali.
3. **`NEXT_PUBLIC_SENTRY_DSN` (build-arg!) → sebelum menyentuh Custom SMTP.** Kegagalan
   SMTP sengaja senyap di sisi pengguna: reset kata sandi selalu menjawab sukses generik
   demi anti-enumerasi. Tanpa Sentry, Anda menyetel SMTP tanpa cara apa pun untuk
   mengetahui ia bekerja.
   - DSN project `bedul/merriva` (region US). Nilainya **publik by design** — ia
     ikut terkirim ke setiap peramban; yang rahasia hanya `SENTRY_AUTH_TOKEN`.
   - 📏 **Menyalakan DSN menambah ±48 KB gz ke SETIAP halaman**, termasuk halaman
     undangan tamu. Diukur bersebelahan 21 Okt 2026 lewat `docker build`: app
     shell 133,9 KB gz tanpa DSN vs **181,9 KB gz** dengan DSN. Itu nyata bagi
     target "LCP < 2,5 dtk di 4G". Sejak tanggal itu CI membangun dengan DSN
     boneka supaya gerbang anggaran mengukur bentuk yang benar — sebelumnya ia
     menggerbangi bentuk yang produksi tak pernah pakai. Bila kelak angka itu
     terasa mahal, yang dipertimbangkan adalah memuat SDK browser hanya di
     permukaan ter-auth; keputusan itu belum diambil.
   - Jalur build-nya sudah digladi: `docker build` dengan DSN asli berhasil dan
     DSN terbukti ter-inline di chunk klien. Cabang `withSentryConfig` tak lagi
     perawan saat Anda menekan rebuild.
4. **Custom SMTP → sebelum mengaktifkan `Confirm email`.** Urutan terbalik membuat
   setiap pendaftar baru terkunci di luar akunnya sendiri.
5. **Naikkan "Emails per hour" dari 2 → sebelum uji 3 akun.** Kalau tidak, pendaftar
   ke-3 ditolak 429 dan Anda akan menyalahkan SMTP yang sebenarnya sudah benar.
6. **`CRON_SECRET` → sebelum memasang keempat perintah cron.** Mengganti nilainya
   setelah job terpasang membuat keempatnya dijawab 401 **tanpa satu pun galat
   terlihat**: rekonsiliasi pembayaran dan retensi UU PDP berhenti diam-diam.
7. **Akun admin (`profiles.role='admin'` via SQL) → sebelum seluruh Fase 4.** Tanpa
   admin, `/admin/lagu`, `/admin/paket`, `/admin/tema`, kartu kesehatan cron, aktivasi
   manual, dan penandaan refund semuanya tak terjangkau — termasuk satu-satunya jalan
   keluar manual dari order yang macet.
8. **Webhook Pakasir terdaftar → sebelum menerima uang dari siapa pun.** Tanpa webhook,
   satu-satunya backstop adalah cron `expire-orders`, dan ia hanya menyentuh order yang
   berumur **> 24 jam**. Jendela buta minimalnya ~24 jam, bukan ~1 jam, dan menjadwalkan
   cron lebih sering TIDAK memperpendeknya.

Dua urutan terakhir berlaku di arah sebaliknya — hal yang harus dikerjakan **sebelum
pengumuman apa pun**, bukan sebelum langkah teknis lain:

9. **Nonaktifkan paket add-on Album Momen** (Fase 4) selagi media masih di Supabase
   Storage. Tier `momen_5` gratis dan self-service; kuota free 1 GB ≈ 7 album penuh.
10. **Uji bayar dengan harga Basic yang diturunkan** (Fase 7) hanya sebelum ada yang
    tahu alamat situs Anda — perubahan harga itu terbit ke publik seketika dan siapa pun
    bisa membelinya pada harga uji.

## Fase 1 — Provisioning & deploy awal (→ DEPLOYMENT.md §0–§8)

- [ ] Prasyarat: domain `merriva.id`, 2 project Supabase (staging + prod, region Singapore), repo GitHub, VPS + Easypanel, akun Cloudflare
- [ ] Terapkan migrasi ke Supabase **staging → prod**: `pnpm supabase link` lalu `pnpm supabase db push`
  - ⚠️ **Termasuk migrasi `20260804190000_widen_media_bucket_audio`** (bucket `media` menerima MIME audio + 8 MB) — WAJIB ada sebelum pustaka lagu dipakai, kalau tidak unggah audio ditolak 415.
  - Verify: Table Editor menampilkan **15 tabel** (angka "12" di versi lama checklist ini sudah usang sejak FASE H + `cron_runs`), SEMUANYA ber-RLS aktif (gembok), dan `packages` memuat `basic` + `premium` pada `kind='invitation'`.
  - ⚠️ **Jangan pakai jumlah baris `packages` sebagai kriteria** — isinya **7**, bukan 2: dua paket undangan plus lima tingkat add-on Album Momen yang di-seed migrasi `20260826110000`.
  - ⚠️ Jangan pakai `/api/health` sebagai bukti migrasi sudah masuk: probe-nya sengaja tak bergantung skema (hanya `GET /rest/v1/`), jadi project yang terjangkau tapi **kosong** tetap menjawab `{"status":"ok","db":"up"}`.
- [ ] App Easypanel dari repo — **branch `production`** (lihat butir gerbang di bawah; `DEPLOYMENT.md` §3 masih menulis `main`, itu usang), Dockerfile, port `3000`, healthcheck `/api/health`
  - ⚠️ Port di panel HARUS `3000`: `HEALTHCHECK` Docker mem-hardcode `127.0.0.1:3000`, jadi port lain → healthcheck gagal → restart loop.
- [ ] **Enam env di-isi sebagai BUILD ARG, bukan hanya env runtime** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MEDIA_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SENTRY_DSN` (Dockerfile `ARG`+`ENV`). Next meng-INLINE nilainya ke bundel saat build; `.dockerignore` membuang `.env*` dari konteks build, jadi di dalam Docker nilainya **hanya** bisa datang dari build-arg. Mengisinya setelah image jadi TIDAK berpengaruh sampai **rebuild**.
- [ ] **Supabase prod sudah termigrasi DAN tidak di-pause sebelum build pertama** — pra-render `/`, `/harga`, `/tema` membaca DB saat build dan `throw` bila gagal (`src/server/marketing/catalog.ts`), jadi project kosong/pause = **build MERAH**, bukan halaman kosong. Urutan "migrasi dulu, baru build" adalah syarat, bukan preferensi.
- [ ] Env production terisi (lihat tabel di bawah)
- [ ] Domain + SSL (Easypanel/Traefik), DNS Cloudflare **proxy ON**, redirect `www` → apex
- [ ] Verify: `curl https://merriva.id/api/health` → `{"status":"ok","db":"up"}`

- [ ] **Easypanel mengawasi branch `production`, bukan `main`** (DECISIONS #64). CI mem-fast-forward `production` hanya setelah `verify` + pgTAP hijau, jadi commit ber-CI-merah tak pernah sampai ke produksi. Sebelum butir ini dikerjakan, gerbangnya **belum berlaku**: deploy tetap jalan paralel dengan CI seperti sekarang.
  - 🔎 **Terbukti masih `main` per 20 Okt 2026, bukan dugaan.** Pada 17 Okt CI mati tiga hari (tagihan GitHub) sehingga `bfe8cf6` tak pernah diverifikasi dan branch `production` tetap tertahan di `1d554f3`. Namun `/api/health` produksi pada 20 Okt melaporkan field `driver` — field yang HANYA ada di `bfe8cf6`. Jadi commit tak terverifikasi itu tetap naik ke produksi sehari kemudian, lewat `main`. Kebetulan kodenya memang hijau; yang tidak ada adalah gerbangnya. **Cara memastikan sendiri kapan saja:** bandingkan `git log --oneline origin/production -1` dengan apa yang benar-benar disajikan produksi — bila produksi lebih baru, Easypanel masih mengambil dari `main`.

## Fase 2 — Konfigurasi layanan pihak ketiga

- [ ] **Pakasir (API v2)**: project production; set webhook URL → `https://merriva.id/api/webhooks/pakasir`; isi `PAKASIR_PROJECT_SLUG` + `PAKASIR_API_KEY` + **`PAKASIR_WEBHOOK_SECRET`**
  - ⚠️ **API v1 dihentikan 20 Oktober 2026.** Kode sudah dimigrasi ke v2 (DECISIONS #72). Yang perlu Anda lakukan: salin **secret webhook** dari BAGIAN BAWAH halaman detail project Pakasir ke `PAKASIR_WEBHOOK_SECRET`. Kosongnya tidak menolak webhook (menolak akan mematikan seluruh aktivasi bila belum disalin) tetapi dilaporkan ke Sentry sebagai `payment.webhook.secret-unset`.
  - ⚠️ **Tanyakan ke dukungan Pakasir**: apakah `transaction-status` dan `cancel-transaction` v2 adalah endpoint RESMI yang didukung. Keduanya **tidak ada di dokumen mana pun** — ditemukan dengan menebak URL lalu dibedakan dari route yang tak ada lewat bentuk pesan galatnya. Verifikasi pembayaran bergantung pada yang pertama; satu jawaban dari mereka menghilangkan risiko ini.
  - ⚠️ `paymentsimulation` tetap endpoint v1 (tak ada padanan v2). Hanya dipakai E2E/dev, dan sudah dilarang di production — tetapi bila v1 benar-benar dimatikan seluruhnya, suite E2E jalur bayar kehilangan satu-satunya cara melunasi transaksi uji.
- [ ] **Resend**: verifikasi domain (SPF/DKIM); `RESEND_API_KEY` + `EMAIL_FROM` (alamat di domain terverifikasi)
- [ ] **Turnstile**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build-arg!) + `TURNSTILE_SECRET_KEY` (runtime)
  - `TURNSTILE_SECRET_KEY` kosong di produksi = **GAGAL-TUTUP total**: RSVP, buku ucapan, konfirmasi hadiah, sesi tamu Album Momen, daftar akun, dan reset kata sandi semuanya ditolak, dengan satu `console.error` per permintaan dan **nol event Sentry**.
  - `NEXT_PUBLIC_APP_URL` ikut menentukan hostname yang sah untuk token Turnstile (`src/lib/turnstile.ts`). Hostname `NEXT_PUBLIC_APP_URL`, _allowed hostnames_ widget Turnstile, dan Site URL Supabase harus menyebut **satu** domain yang sama — menukar apex/www saja sudah cukup merusak.
- [ ] **Google OAuth** (Supabase → Auth → Providers → Google + OAuth Client di Google Cloud Console, redirect URI `https://<PROJECT_REF>.supabase.co/auth/v1/callback` — [`AUTH-SETUP.md` §3](AUTH-SETUP.md)). **Tidak opsional dalam praktik:** tombol "Lanjutkan dengan Google" dirender TANPA SYARAT di `/masuk` dan `/daftar` (`src/components/auth/google-button.tsx`), jadi tanpa provider ini setiap klik berakhir di `?error=oauth` — dan kode sendiri mencatat bahwa salah-konfigurasi provider TAMPAK IDENTIK dengan "pengguna membatalkan". Alternatifnya: sembunyikan tombolnya (perubahan kode).
- [ ] **Naikkan "Emails per hour"** (Auth → Rate Limits) dari bawaan **2/jam** sebelum uji 3 akun di bawah — kalau tidak, pendaftar ke-3 ditolak 429 tanpa sebab yang terlihat.
- [ ] **`otp_expiry` ≤ 1800 detik** (Auth → Providers → Email). Bawaan GoTrue 1 jam, sedangkan aplikasi menolak grant email yang lebih tua dari 30 menit (`EMAIL_GRANT_MAX_AGE_SEC`, `src/lib/auth/email-grant.ts`). Tautan reset yang diklik di menit ke-31–60 LOLOS `verifyOtp` lalu DITOLAK aplikasi: pengguna sudah masuk, melihat form, lalu ditolak tanpa tahu sebabnya.
- [ ] **Redirect URL allow list** ([`AUTH-SETUP.md` §1](AUTH-SETUP.md)) — kegagalannya paling senyap dari semua: bila `redirect_to` tak ada di allow list, GoTrue **mem-fallback ke Site URL**, jadi setelah login Google pengguna mendarat di BERANDA dengan `?code=…` yang tak pernah ditukar → tetap tidak login, tanpa pesan galat, tanpa jejak Sentry.
  - ⚠️ **INI SUDAH TERJADI (14 Okt 2026, DECISIONS #76)** — persis seperti kalimat di atas, yang ditulis sebelum kejadiannya. Pemicunya `NEXT_PUBLIC_APP_URL` yang tak diisi sebagai build-arg, sehingga `redirect_to` menunjuk `http://localhost:3000/auth/callback`. Isi allow list dengan **`https://merriva.id/auth/callback`** DAN **`https://merriva.id/**`** (query `?next=…` ikut di URL-nya), lalu pastikan butir build-arg di atas benar-benar dikerjakan — keduanya harus benar, memperbaiki salah satu saja tidak cukup.
  - Kini ada pagar yang berteriak: bila `NEXT_PUBLIC_APP_URL` kosong di produksi, tombol Google menolak jalan dan melapor ke Sentry (`auth.oauth.config`) alih-alih mengirim pengguna ke jalan buntu. Pagar itu **tidak** menangkap allow list yang salah — itu tetap harus diperiksa manual di sini.
  - Verifikasi setelah login: `select last_sign_in_at from auth.users where email = '…'` — bila NULL padahal `auth_logs` mencatat `action: login`, kodenya tak pernah ditukar dan Anda sedang melihat kegagalan ini.
- [ ] **Toggle "Allow new users to sign up" aktif** di project cloud. Bila mati, `/daftar` menjawab galat generik — gejalanya **identik** dengan kegagalan SMTP, jadi Anda akan mengejar SMTP padahal penyebabnya toggle ini.
- [ ] **KEDUA template email diganti ke `{{ .TokenHash }}`** ([`AUTH-SETUP.md` §2](AUTH-SETUP.md)) — Confirm signup DAN Reset password. ⚠️ **Ini sudah terlewat sekali dan menggigit (14 Okt 2026, DECISIONS #81).** Gejalanya menyesatkan: pendaftaran berhasil, email terkirim, lalu pengguna yang mengklik tautan melihat "Tautan tidak valid atau sudah kedaluwarsa" padahal **akunnya sudah aktif**. Tak ada perbaikan sisi-kode yang bisa menyelamatkannya — kode PKCE dari templat bawaan kedaluwarsa 5 menit setelah PENDAFTARAN, bukan setelah klik.
  - **Verifikasi 1 menit:** daftar satu akun uji → klik tautannya → Logs → Auth, cari `/verify`. **`POST /verify` = templat kustom aktif.** **`GET /verify` = masih bawaan.**
- [ ] **Seluruh toggle di atas dikerjakan DUA KALI** — staging dan prod. Site URL, Redirect URLs, kedua template email, Custom SMTP, Confirm email, kebijakan kata sandi, rate limit, dan akun admin via SQL semuanya per-project.
- [ ] **Custom SMTP Supabase Auth → Resend** — **WAJIB, bukan opsional** (Auth → Emails → SMTP Settings; host `smtp.resend.com`, port `465`, user `resend`, password = `RESEND_API_KEY`, sender = `EMAIL_FROM`).
  - Alasannya bukan sekadar kuota: SMTP bawaan Supabase **menolak mengirim ke alamat di luar anggota tim project** ("not meant for production use"), jadi tanpa ini deliverability ke pelanggan = **0%**, bukan 2 email/jam. Verifikasi email wajib (`Confirm email` aktif) → pendaftar tak akan pernah bisa masuk.
  - Kegagalannya SENYAP di sisi pengguna: `requestPasswordResetAction` sengaja selalu menjawab sukses generik (anti-enumerasi), jadi pengguna melihat "tautan sudah dikirim" walau tak ada yang terkirim. Jejaknya hanya ada di Sentry (`area: auth.signup` / `auth.reset`) → **isi `NEXT_PUBLIC_SENTRY_DSN` sebelum fase ini**, kalau tidak kegagalannya tetap tak terlihat.
  - Verify: daftar **3 akun uji dengan alamat di luar anggota tim project** dalam satu jam → ketiganya menerima email dari domain sendiri → klik tautan → berhasil masuk. Lalu `select confirmation_sent_at, email_confirmed_at from auth.users` — keduanya harus terisi. (Per 2026-10-01 `auth.users` hanya berisi 1 admin buatan manual: jalur ini **belum pernah** berhasil — AUDIT-2026-10-01 A1.)
- [ ] **Confirm email** aktif (Auth → Providers → Email) — prasyarat SPEC §4.2; setel SETELAH Custom SMTP jalan.
- [ ] **Kebijakan kata sandi** (Supabase → Auth → Policies), kebijakan final + alasannya di [`AUTH-SETUP.md` §5](AUTH-SETUP.md): **Leaked Password Protection aktif** (tolak kata sandi yang pernah bocor, HaveIBeenPwned) · **minimum length 8** (samakan dengan aplikasi & `supabase/config.toml`; bila dashboard lebih longgar, aturan aplikasi hanya berlaku selama setiap penulisan kata sandi melewati form Merriva — jalur reset Supabase tidak) · **password requirements dibiarkan kosong** (aturan komposisi mendorong pola `Password1!`). _Toggle dashboard, bukan kode._

## Fase 3 — Cron (crontab host VPS)

> ⚠️ **KOREKSI 21 Okt 2026 — Easypanel TIDAK punya penjadwal bawaan.** Judul
> bagian ini dulu berbunyi "Easypanel scheduled jobs" dan tabelnya memberi
> perintah untuk penjadwal yang berjalan DI DALAM container. Fitur itu tidak
> ada: dokumentasi Easypanel mencantumkan sembilan service type (App, MySQL,
> MariaDB, Postgres, Mongo, Redis, WordPress, Box, Compose — tak ada cron), dan
> service App punya tab Source/Build/Deployments/Environment/Domains/Redirects/
> Scripts/Security/Resources/Maintenance/Storage/Advanced — **tak ada
> Schedules**. Satu-satunya yang terjadwal adalah backup volume di tab Storage,
> dan `Scripts` dijalankan MANUAL dari menu Shell.
>
> Panduan resmi `easypanel.io/docs/guides/cron-job` menawarkan dua jalan, dan
> yang pertama **merusak aplikasi ini**: ia memasang crontab ke dalam image lalu
> menyetel `CMD ["/usr/sbin/crond", "-f"]`, yang MENGGANTIKAN
> `CMD ["node", "server.js"]` di `Dockerfile:68`. Container berhenti melayani
> HTTP dan hanya menjalankan daemon cron. Jangan dipakai apa adanya.

Keempat endpoint dipanggil dengan header `Authorization: Bearer <CRON_SECRET>`,
dari **crontab root di host VPS**. Endpoint-nya terbukti dapat dijangkau dari
luar (diuji 21 Okt 2026: `POST` tanpa auth → **401**, `GET` → **405** pada
keempatnya), jadi penjadwal mana pun di luar container bisa menggerakkannya.

> ✅ **TERPASANG 21 Okt 2026** di `root@72.61.213.237` (host `Etc/UTC`, jadi
> kolom UTC di bawah berlaku apa adanya). Keempatnya diuji langsung dari host
> dengan perintah cron yang sebenarnya: `exit=0`, `{"ok":true}`, seluruh
> penghitung nol. `ops:verify` bagian "Data produksi" hijau. Entri backup
> Directus milik proyek lain di VPS itu dipertahankan utuh; cadangan crontab
> lama di `/root/crontab.sebelum-merriva.*`.

**Cara memasangnya** (dan memasang ulang setelah VPS dibangun ulang) — satu
perintah, idempoten, tak menyentuh entri crontab milik proyek lain:

```bash
scp scripts/pasang-cron-host.sh <vps>:/root/
grep -m1 '^CRON_SECRET=' .env.production.local | cut -d= -f2- \
  | ssh <vps> 'bash /root/pasang-cron-host.sh'
```

Secret mengalir lewat STDIN — tak pernah masuk argumen perintah, `ps`, riwayat
shell, maupun isi crontab. Yang di bawah ini isi yang dihasilkannya, bila Anda
lebih suka memasangnya manual.

**Sekali di awal** — simpan header di berkas khusus supaya secret tak pernah
muncul di crontab maupun di `ps`:

```bash
printf 'header = "Authorization: Bearer %s"\n' 'NILAI-CRON-SECRET-ANDA' \
  > /etc/merriva-cron.conf
chmod 600 /etc/merriva-cron.conf
```

**`sudo crontab -e`**, lalu tempel:

```cron
# Merriva — jam dalam zona waktu HOST (cek: timedatectl). Kolom WIB di bawah
# mengandaikan host UTC.
0  *    * * * curl -fsS -m 600 -X POST -K /etc/merriva-cron.conf https://merriva.id/api/cron/expire-orders      >>/var/log/merriva-cron.log 2>&1
15 0    * * * curl -fsS -m 600 -X POST -K /etc/merriva-cron.conf https://merriva.id/api/cron/expire-invitations >>/var/log/merriva-cron.log 2>&1
30 1,13 * * * curl -fsS -m 600 -X POST -K /etc/merriva-cron.conf https://merriva.id/api/cron/expiry-reminders   >>/var/log/merriva-cron.log 2>&1
45 2,14 * * * curl -fsS -m 600 -X POST -K /etc/merriva-cron.conf https://merriva.id/api/cron/purge-expired      >>/var/log/merriva-cron.log 2>&1
```

| Job | Jadwal (host UTC) | WIB |
|---|---|---|
| `expire-orders` | `0 * * * *` | tiap jam |
| `expire-invitations` | `15 0 * * *` | 07:15 |
| `expiry-reminders` | `30 1,13 * * *` | 08:30 & 20:30 |
| `purge-expired` | `45 2,14 * * *` | 09:45 & 21:45 |

Yang akan membuang waktu Anda bila tidak diketahui lebih dulu:

- **Keempat route hanya mengekspor `POST`.** `-X POST` itu wajib; tanpa itu Next
  menjawab **405**, bukan 401. Penjadwal yang hanya bisa GET tak akan pernah
  berhasil — itu menyingkirkan sebagian layanan cron gratis.
- **`-fsS` wajib, bukan hiasan.** Tanpa `-f`, curl keluar dengan kode 0 pada 401
  dan cron menganggapnya sukses — persis "401 tanpa galat terlihat" yang
  diperingatkan di bawah. Dengan `-fsS`, job gagal dan pesannya masuk log.
- **`-K`, bukan `-H "...$VAR"`.** Header di baris perintah ikut terlihat di `ps`
  bagi proses mana pun di host. Berkas config 600 menutup itu, dan crontab-nya
  jadi aman dibaca/dibagikan.
- **Zona waktu HOST, bukan container.** `timedatectl` untuk memastikan. Jadwal
  yang melenceng 7 jam tak merusak apa pun, tetapi email peringatan pra-purge
  akan mendarat tengah malam di kotak masuk pelanggan.
- 🔁 **Crontab host TIDAK ada di repo.** Ia hilang bila VPS dibangun ulang —
  lihat RUNBOOK Skenario B, yang kini menyebutkannya.

Alternatif bila Anda lebih suka terkelola: Cloudflare Workers Cron Triggers
(gratis, dan DNS sudah di sana) atau layanan seperti cron-job.org yang
disarankan panduan Easypanel. **GitHub Actions sengaja TIDAK disarankan**:
±870 jalan/bulan akan memakan kuota menit repo privat, dan tagihan Actions
sudah pernah menghentikan CI selama tiga hari pada 17 Okt 2026.

- [ ] `POST /api/cron/expire-orders` — tiap ~1 jam (rekonsiliasi + batalkan order > 24 jam + `transactioncancel`)
  - ⚠️ Job ini **juga mengirim kuitansi** bila rekonsiliasi menemukan order yang ternyata sudah lunas — ia jaring penyelamat ketika webhook Pakasir hilang. Tak dijadwalkan = pelanggan yang sudah membayar tak pernah aktif dan tak pernah dapat bukti bayar sampai admin menyentuhnya manual.
  - ⚠️ **Sejak 2026-10-13 job ini punya DUA pass** (DECISIONS #73). Pass pertama merekonsiliasi order `pending` berumur **10 menit – 24 jam**: ia hanya memverifikasi & mengaktifkan, tak pernah membatalkan. Sebelumnya tak ada backstop di bawah 24 jam, jadi webhook yang hilang + pelanggan yang menutup tab = order dibayar menggantung sehari penuh tanpa sinyal. Dengan kadens 1 jam, jendela butanya kini **~1 jam**, bukan ~24 jam.
  - ⚠️ Pass kedua (> 24 jam) yang membatalkan link. Keduanya berbagi **satu anggaran panggilan Pakasir per jalan** (`PAKASIR_BUDGET`), karena plafonnya 2 permintaan/detik; pass pertama memakainya lebih dulu, sebab di sanalah ada pelanggan yang mungkin sudah membayar dan sedang menunggu.
  - Pantau di **`/admin`** — kartu cron kini menampilkan seluruh angka `cron_runs.stats` (DECISIONS #74), dengan yang perlu perhatian ditandai amber. Yang paling bermakna: `mudaActivated` (webhook hilang, cron yang menyelamatkan pelanggan), `budgetHabis` (anggaran Pakasir habis → naikkan kadens atau turunkan BATCH), `tanpaTxn` (penerbitan link sering gagal), `cancelFailed`.
- [ ] `POST /api/cron/expire-invitations` — harian (undangan `active` lewat masa aktif → `expired` + revalidate ISR + **email notis "masa aktif berakhir"** ke pemiliknya). Emailnya dibatasi 100 per jalan; bila `notifyTruncated` di `/admin` pernah > 0, naikkan kadensnya.
- [ ] `POST /api/cron/expiry-reminders` — **tiap 12 jam** (bukan harian). Alasannya sama dengan `purge-expired` dan sudah tertulis di docstring route-nya: "tandai hanya saat terkirim" bersifat at-least-once, jadi email yang terkirim tetapi gagal menandai `reminder_sent_at` akan terpilih lagi — dan satu-satunya penjaga kirim-ganda adalah `idempotencyKey` Resend yang hanya berlaku 24 jam. `JADWAL_JAM` di `src/server/cron/status.ts` sempat menulis 24 dan bertentangan dengan route-nya; diperbaiki 2026-10-12.
- [ ] `POST /api/cron/purge-expired` — **tiap 12 jam** (bukan harian: job ini juga mengirim peringatan pra-purge H-30 & H-7, dan `idempotencyKey` Resend hanya 24 jam — kadens di bawah itu mencegah peringatan ganda. `JADWAL_JAM` di `src/server/cron/status.ts` HARUS cocok, kalau tidak panel admin menuduh job yang sehat). Retensi UU PDP: hapus permanen data tamu/RSVP/media/gift_notes undangan `expired` > 6 bulan; baris undangan tinggal kerangka, `orders` dipertahankan)
- Verify: panggil manual dengan Bearer benar → `200`; tanpa/ salah secret → `401`.
- ✅ **Statistik cron kini terlihat di `/admin`** (DECISIONS #74). Kartu cron menampilkan setiap angka di `cron_runs.stats`, dengan yang perlu perhatian (`*Failed`, `*Truncated`, `budgetHabis`, `tanpaTxn`, `backstop`, `*NoOwner`) ditandai amber bila > 0. Kunci yang belum punya label Indonesia tetap tampil apa adanya — statistik baru tak akan hilang dari panel hanya karena lupa diberi label.
- ⚠️ **Tak ada yang memberi tahu bila cron mati.** `/api/health` tidak membaca cron sama sekali, dan `CRON_SECRET` yang bersisipan newline membuat keempat job dijawab 401 tanpa galat terlihat. Selama 2 minggu pertama, buka `/admin` setiap pagi.

## Fase 4 — Konten & data awal (via panel admin)

- [~] **Pustaka lagu**: keenam trek `handoff/music/mp3/` **sudah diunggah ke storage + terdaftar di `songs`** (2026-10-12), tetapi **`is_active = false`** — sengaja. `handoff/music/README.md` menyatakan trek-trek ini disintesis secara prosedural dan **"belum pernah didengar oleh telinga manusia"**, dan melarang menyeednya sebagai library default sebelum diaudisi.
  - **Yang tinggal Anda lakukan:** buka `/admin/lagu`, putar keenamnya dengan speaker DAN earphone di HP, lalu aktifkan yang lolos. `/admin/lagu` memutar lagu nonaktif juga; picker pemilik dan halaman publik menolaknya sampai aktif, jadi tak ada yang sampai ke pelanggan sebelum Anda setuju.
  - Sampai minimal satu lagu aktif, musik latar undangan tetap **senyap**. Lisensi keenamnya 100% milik Merriva ([`LICENSES.md`](../handoff/music/LICENSES.md)).
  - Generator ada di `handoff/music/generator/make_music.py` bila ada yang perlu dirender ulang.
- [ ] **Paket & harga** di `/admin/paket` sesuai rencana jual (berlaku langsung tanpa deploy)
- [x] **Keputusan harga upgrade** (DECISIONS #61) — DIPUTUSKAN 2026-10-04: biarkan apa adanya. Upgrade menagih **selisih harga penuh** (Basic 99rb → Premium 199rb = 100rb) dan **tidak** membawa durasi Premium yang lebih panjang (12 bulan vs 6). Dasarnya: halaman upgrade menyatakan masa aktif tidak diperpanjang secara eksplisit beserta tanggal berakhir + sisa hari, jadi pelanggan memutuskan dengan tahu. Bila kelak jadi sumber keluhan, dua jalan keluarnya ada di #61 (samakan durasi paket, atau prorata).
- [ ] **Tema aktif** di `/admin/tema` sesuai yang ditawarkan
- [ ] **Akun admin**: set `profiles.role = 'admin'` untuk akun pemilik via SQL (tak ada signup admin — DATA-MODEL §1). Selanjutnya kelola peran/suspend user lewat `/admin/pengguna`.
  - ⚠️ **Kerjakan ini LEBIH DULU dari butir Fase 4 lainnya**: tanpa admin, `/admin/lagu`, `/admin/paket`, `/admin/tema`, kartu kesehatan cron, aktivasi manual, dan penandaan refund semuanya tak terjangkau — termasuk satu-satunya jalan keluar manual dari order yang macet.
- [x] **Nonaktifkan kelima paket add-on Album Momen sampai media pindah ke R2** — DIKERJAKAN 2026-10-12 (kelimanya `is_active = false`; verifikasi: `select count(*) from packages where kind='addon_momen' and is_active` → 0). Aktifkan kembali setelah `STORAGE_DRIVER=r2` berjalan. Migrasi `20260826110000` men-seed `momen_5`, `momen_50`, `momen_100`, `momen_200`, `momen_unlimited` dengan `is_active = true`, dan `momen_5` **gratis + self-service tanpa pembayaran**. [`MOMEN-SPEC.md`](MOMEN-SPEC.md) §94 melarang menjualnya sebelum media pindah R2 (Supabase free 1 GB ≈ 7 album penuh). **Tidak ada tombolnya di panel** — `/admin/paket` menyaring `kind='invitation'` dan tak ada route admin untuk add-on. Satu-satunya cara:
  ```sql
  update public.packages set is_active = false where kind = 'addon_momen';
  ```
  Tanpa ini, pelanggan pertama bisa mengisi kuota 1 GB lewat tier gratis, tanpa satu rupiah masuk.
- [ ] **Master audio pustaka lagu disimpan di penyimpanan ber-backup.** `.gitignore` membuang `handoff/music/wav|mp3/` dengan alasan "sumber kebenaran = Supabase storage (sudah di-seed)" — itu benar untuk project dev yang ter-link, **bukan** untuk project prod baru: tak ada migrasi yang menyisipkan baris `songs`, dan [`MUSIC-LIBRARY.md`](MUSIC-LIBRARY.md) menyatakan sendiri pustaka mulai kosong di production. Masternya kini hanya ada di satu disk dan tak tercakup backup apa pun.

## Fase 5 — Keandalan database & media

- [ ] **Supabase Pro** (backup harian, retensi 7 hari) — sebelum ada klien berbayar (free tier auto-pause + egress 5 GB tak cukup)
  - 🔒 **Pro juga membuka _Leaked Password Protection_** (cek HaveIBeenPwned saat sandi dibuat/diubah). Di free tier ia bukan toggle yang terlewat — Management API menolak dengan **HTTP 402** "available on Pro Plans and up" (dicoba 16 Okt 2026). `pnpm ops:verify` menandainya GAGAL dan memang harus begitu; penutupnya ada di butir ini, bukan di dashboard Auth. Begitu Pro aktif, nyalakan dan jalankan `ops:verify` lagi.
- [ ] **Latihan restore backup 1×** (RUNBOOK): restore ke project sementara, verifikasi jumlah baris & login
- [ ] **Backup OBJEK MEDIA — belum ada sama sekali.** Supabase Pro mem-backup Postgres, bukan Storage; R2 juga tak punya backup bawaan; driver `local` **paling telanjang** — satu disk, tanpa replikasi, isinya di `/etc/easypanel/projects/etc/merriva/volumes/media`. Karena path media disimpan **relatif** di DB dan URL dibangun saat render, restore DB akan mengembalikan baris `media` yang menunjuk objek yang **tidak ada salinannya di mana pun**. Untuk produk yang menyimpan foto pernikahan pelanggan, ambil keputusan ini sadar sebelum klien berbayar pertama: versioning + lifecycle rule di R2, sinkron periodik ke penyimpanan lain, atau — selama di `local` — masukkan direktori volume itu ke backup VPS.
- [ ] **Penyaji media WAJIB dari domain sendiri** (SPEC §6.4) — `NEXT_PUBLIC_MEDIA_URL` harus menunjuk host yang menyajikan media; **jangan dikosongkan** (kosong = media 404 **dan editor 500 sejak foto pertama** — ini sudah terjadi sungguhan 14 Okt 2026, DECISIONS #82). Jalur turnkey & compliant: **R2** — isi `R2_*`, `STORAGE_DRIVER=r2`, `NEXT_PUBLIC_MEDIA_URL=https://cdn.merriva.id`, custom domain `cdn.merriva.id` di R2.
  - ⚠️ **REBUILD, bukan restart.** `NEXT_PUBLIC_MEDIA_URL` di-inline Next saat BUILD (termasuk ke bundel server) sementara `STORAGE_DRIVER` dibaca saat RUNTIME. Mengubah keduanya di tab Environment lalu me-restart hanya menggerakkan yang kedua: route `/media` langsung menjawab 404 untuk semua permintaan sementara URL yang sudah dirender masih menunjuk ke sana — **seluruh media padam serentak** tanpa satu pun galat. Cutover harus SATU deploy yang membawa build-arg baru. Sejak 15 Okt 2026 `/api/health` menolak pasangan yang tak padu (`media: "media-url-basi"`, status 503) sehingga image yang salah tak pernah menerima trafik; `pnpm ops:verify` menampilkan `mediaBase` yang benar-benar terpasang.
  - ⚠️ **Tidak ada skrip migrasi.** `pnpm migrate:media` DIHAPUS 16 Okt 2026 (DECISIONS #92) — ia membaca Supabase Storage (bukan disk VPS), hanya mengenal varian galeri, memaku `Content-Type: image/webp`, dan tak memverifikasi objek sampai. Saat keputusan pindah diambil, isi storage hanya 6 lagu + beberapa foto uji dengan 0 pelanggan, jadi jalurnya: unggah ulang lagu lewat `/admin/lagu` dari master `handoff/music/mp3/`, foto uji dibuat ulang. Bila kelak perlu memindahkan media PELANGGAN, tulis pemindah baru — syaratnya ada di DECISIONS #92. Jembatan yang sedang dipakai: **`local`** — `STORAGE_DRIVER=local`, `NEXT_PUBLIC_MEDIA_URL=https://merriva.id/media`, **volume di `/app/data/media`** (DEPLOYMENT §4a). Boleh juga tetap Supabase storage **hanya bila** `NEXT_PUBLIC_MEDIA_URL` sudah menunjuk proxy domain sendiri; pindah ke R2 sebelum event klien ramai.
  - 🔔 **Token R2 yang salah scope kini berbunyi, tidak lagi bisu.** Token ber-scope _read-only_ menjawab **403 dengan sopan** pada setiap PUT/DELETE — tak ada yang dilempar, jadi sebelum 16 Okt 2026 gejalanya hanya pelanggan yang mengeluh. Lima area Sentry sekarang menutup itu: `media.upload`, `media.named-photo.upload`, `admin.song.upload` (unggahan, DECISIONS #93), `zip.galeri`/`zip.momen` (unduhan, #93), dan `cron.purge-expired.storage` (penghapusan UU PDP). **Setelah cutover, unggah satu foto uji lalu pastikan Sentry SENYAP** — itu pembuktian scope token yang paling murah. Prasyaratnya `NEXT_PUBLIC_SENTRY_DSN` benar-benar terisi di bundel (Fase 6).
- [ ] **Bila `STORAGE_DRIVER=local`: buktikan volumenya ter-mount** — `docker inspect <container> --format '{{range .Mounts}}…'` harus menampilkan `/app/data/media`, dan uji daur hidupnya sekali: unggah foto → **redeploy** → foto masih tampil. Tanpa mount, unggah tetap "berhasil" ke lapisan container yang dibuang tiap deploy; tidak ada galat apa pun sampai foto klien hilang. App tidak bisa mendeteksinya sendiri — bagi `fs`, direktori ter-mount dan tidak sama saja.

## Fase 6 — Monitoring & keamanan edge

- [ ] **UptimeRobot** → `https://merriva.id/api/health`, interval 5 menit, alert bila ≠ 200
  - ⚠️ **Health 200 BUKAN bukti produk hidup.** `healthy = db !== "down"`, dan `db` bernilai `"not_configured"` (bukan `"down"`) bila env Supabase KOSONG — jadi container yang dideploy tanpa env Supabase sama sekali dinilai **SEHAT** oleh HEALTHCHECK Docker dan UptimeRobot, sementara setiap halaman melempar 500. Health juga tak menyentuh Pakasir, Resend, Turnstile, `NEXT_PUBLIC_MEDIA_URL`, bucket media, maupun cron.
- [ ] **Monitor kedua: satu `/{slug}` undangan aktif** dengan keyword monitor (mis. nama mempelai) — satu-satunya yang menangkap `SUPABASE_SERVICE_ROLE_KEY` kosong, `NEXT_PUBLIC_MEDIA_URL` kosong, atau Server Action 403 yang semuanya membiarkan `/api/health` tetap 200.
- [ ] **Monitor ketiga: satu URL media nyata** di host penyaji media — kegagalan media berbentuk 404 gambar pada halaman yang tetap menjawab 200.
- [ ] **Sentry** aktif: isi `NEXT_PUBLIC_SENTRY_DSN` (kosong = Sentry non-aktif); picu 1 error uji → pastikan masuk
- [ ] **Cloudflare Cache Rule** untuk `/api/og/*` (Eligible for cache, cache key = path) → serap beban render OG di CDN (mitigasi DoS asimetris; security review #2)
- [ ] **Cloudflare WAF Rate Limiting** di edge sebagai lapis pertama (rate-limit app = backstop per-proses; security review #1)
- [ ] **Cloudflare Cache Rule untuk `/api/ics/*`** — route-nya memancarkan `max-age=300`, tetapi **Browser TTL bawaan zona Cloudflare (4 jam) MENIMPA** nilai origin. Akibatnya tamu menyimpan jam acara yang sudah lama diubah ke kalendernya. Setel Browser TTL "Respect origin" untuk path itu.
- [ ] **Dua API key Resend terpisah pada satu domain** — satu menjadi password Custom SMTP Supabase (jalur yang mematikan pendaftaran bila jatuh), satu untuk aplikasi. Dengan satu key, lonjakan cron (kuitansi + pengingat + notis + pra-purge) berebut kuota harian dengan email verifikasi akun & reset kata sandi. Kode mengenali `daily_quota_exceeded`/`rate_limit_exceeded` sebagai kode galat, tetapi **tak ada pemanggil yang membedakannya** dari galat lain.
- [ ] **IP klien tepercaya — AUDIT KEA-1** ([DECISIONS #37](DECISIONS.md)). Seluruh rate limit app hanya kuat bila semua butir ini benar:
  - [ ] Traefik Easypanel melihat **IP sumber publik**: port 80/443 dipublish mode **host** (bukan *ingress* Swarm, yang mengganti IP sumber dengan 10.0.x.x), `forwardedHeaders.insecure` tidak aktif, `notAppendXForwardedFor` tidak aktif. **Baca langsung konfigurasinya** (static & dynamic entrypoint), jangan hanya menyimpulkan dari log.
  - [ ] Setelah ada trafik nyata, log app **tidak** memuat `[client-ip] asal request tak bisa diverifikasi`. Bila origin punya record AAAA (Cloudflare tersambung lewat IPv6), pastikan IP sumber IPv6 juga tidak hilang di proxy Docker. _Log kosong bukan bukti bila Traefik mempercayai header masuk sambil tidak menambahkan XFF — karena itu butir di atas wajib dicek dari konfigurasi._
  - [ ] **Firewall origin**: 80/443 hanya menerima rentang Cloudflare (`src/lib/cloudflare-ips.json`). Port yang dipublish Docker melewati `ufw` → pasang di chain `DOCKER-USER` atau firewall penyedia VPS. Port app `3000` tak pernah dipublish ke publik.
  - [ ] **Authenticated Origin Pulls** Cloudflare dengan sertifikat **per-zona** (sertifikat global bisa dipakai pelanggan Cloudflare mana pun), SSL mode Full (strict), dan Traefik mewajibkan client certificate. **Hanya butir ini yang menutup KEA-1 penuh**: rentang IP Cloudflare bukan autentikasi — pelanggan Cloudflare lain (Worker `connect()`, zona mereka sendiri) tersambung dari IP Cloudflare dan bisa menulis `CF-Connecting-IP` sendiri; firewall rentang Cloudflare tak menghalanginya.
  - [ ] **Uji spoof LANGSUNG ke origin** (sebelum firewall dikunci, atau dari host yang sementara di-allowlist): arahkan `merriva.id` ke IP origin lewat file hosts perangkat uji, kirim header `CF-Connecting-IP` acak tiap request (mis. ekstensi pengubah header), lalu gagal masuk >10× dalam 1 menit → percobaan ke-11 ditolak dan log app memuat satu `[client-ip] cf-connecting-ip diabaikan`. Uji lewat `https://merriva.id` biasa TIDAK membuktikan apa pun — Cloudflare menimpa header itu. Setelah firewall + AOP aktif: akses langsung `curl --resolve merriva.id:443:<IP_ORIGIN> https://merriva.id/` → gagal di handshake TLS/timeout.
  - [ ] Workflow terjadwal **Rentang IP Cloudflare** (GitHub Actions) hijau. Bila merah: perbarui `cloudflare-ips.json` DAN allowlist firewall bersamaan.
- [ ] **Turnstile**: kunci _allowed hostnames_ widget ke `merriva.id` di dashboard Cloudflare (server sudah cek hostname; ini lapis utama)
- [ ] **Supabase Auth**: review `[auth.rate_limit]`/`[auth.captcha]` project cloud
  - ⚠️ **JANGAN aktifkan _Secure password change_ di produksi** (`security_update_password_require_reauthentication`) — butir ini dulu berbunyi "aktifkan", dan mengikutinya akan mematahkan **kedua** jalur kata sandi (DECISIONS #89). Dengan toggle itu hidup, GoTrue menuntut `nonce` pada `updateUser({ password })`, sementara aplikasi memanggilnya tanpa nonce di dua tempat: `updatePasswordAction` (jalur reset, `src/server/actions/auth.ts`) dan form ganti sandi di profil. Akibatnya **tak seorang pun bisa menyetel kata sandi** — dan gejalanya hanya "coba lagi" yang generik.
  - Yang hendak dilindungi toggle itu **sudah ditegakkan aplikasi sendiri**, lebih ketat: jalur profil memverifikasi kata sandi saat ini lewat `signInWithPassword` pada klien terpisah, dan jalur reset menuntut `isFreshEmailGrant` (sesi yang baru lahir dari klik tautan email, ≤ 30 menit) — sesi dashboard biasa ditolak (AUDIT-2026-10-01 B1).
  - Bila kelak tetap diinginkan: uji di **staging** lebih dulu, dan ubah kode untuk meminta nonce. Jangan dibalik urutannya.

## Fase 7 — Uji pra-launch (SPEC §10) — WAJIB sebelum umum

- [ ] Buka undangan dari **WA in-app browser di Android & iOS asli** (bukan hanya Chrome desktop)
- [ ] **Lighthouse mobile ≥ 90 pada 3 tema** (LCP < 2,5 dtk di 4G)
- [ ] **Bayar production nominal kecil end-to-end** → aktif + kuitansi email masuk < 1 menit. Ini satu-satunya pembuktian bahwa webhook + `transactiondetail` + Resend + domain terverifikasi bekerja BERSAMA.
  - ⚠️ **"Paket uji" tidak bisa dibuat.** `/admin/paket` hanya meng-UPDATE paket yang ada (tak ada INSERT di seluruh repo), dan checkout memvalidasi kode paket terhadap `z.enum(["basic","premium"])` — kode lain gagal validasi Zod sebelum menyentuh DB. Satu-satunya cara: **turunkan harga `basic` sementara**.
  - ⚠️ Menurunkan harga itu **terbit ke publik SEKETIKA** (`adminUpdatePackageAction` me-revalidate `/` dan `/harga`, dan checkout mengambil harga otoritatif dari DB). Selama jendela uji siapa pun bisa membeli Basic pada harga itu. Lakukan **sebelum pengumuman apa pun**, catat harga aslinya lebih dulu, pulihkan segera, lalu buka `/harga` untuk memastikan benar-benar kembali.
- [ ] **Satu mutasi lewat domain publik dari HP** — simpan satu perubahan di editor dan kirim satu RSVP dari `https://merriva.id` sungguhan. `next.config.ts` menyetel `bodySizeLimit` tanpa `allowedOrigins`; bila host yang diteruskan Cloudflare/Traefik tak sama dengan domain, SELURUH Server Action gagal 403 sementara semua halaman tetap tampil normal dan `/api/health` tetap 200.
- [ ] **ISR benar-benar meng-cache**: `curl -sI https://merriva.id/<slug>` dua kali → header `x-nextjs-cache` `MISS` lalu `HIT`. Bila direktori cache tak writable, Next jatuh ke render per-request secara SENYAP — halaman tetap benar, anggaran performa hari-H hilang tanpa galat.
  - ⚠️ Cache ISR hidup di filesystem container: **setiap redeploy mengosongkannya**. Jangan redeploy pada pagi hari acara klien — hit pertama tiap slug adalah render blocking.
- [ ] **Restore backup Supabase** pernah dicoba (Fase 5)
- [ ] **Uji beban k6 200 VU** (`pnpm loadtest`, target staging/prod dengan slug aktif) → p95 < 800 ms, error < 1%

## Fase 8 — Kepatuhan (sebelum promosi besar)

- [x] **Identitas pelaku usaha diisi** — SUDAH TERISI 15 Okt 2026 (`src/lib/copy.ts` `copy.marketing.legal.merchant`): usaha perseorangan, nama + penanggung jawab + alamat lengkap. `taxId` sengaja dibiarkan kosong (belum ada NPWP/NIB) karena field kosong tak dirender, sedangkan `"-"` akan terbit sebagai baris yang tak memberi tahu apa pun. Butir ini sempat tetap tertulis "masih **string kosong**" selama dua hari sesudahnya — checklist yang salah tentang kesiapan hukum lebih berbahaya daripada butir yang hilang. Ini **edit kode + deploy**, bukan setelan dashboard. WAJIB (PP 80/2019 & Permendag 31/2020 mewajibkan identitas tampil sebelum pembayaran; aggregator rutin menangguhkan merchant tanpa itu). Satu sumber → mengisinya mengisi /syarat, /privasi, /refund, dan kuitansi sekaligus. Keputusan pemilik 2026-10-03: usaha perseorangan.
  **Sejak 14 Okt 2026 butir ini MENEGAKKAN DIRINYA** (DECISIONS #88): selama `name`/`address` kosong, `createCheckoutAction` menolak di PRODUCTION dan melapor ke `checkout.merchant-identity`. Tombol bayar mati sampai diisi — lebih baik begitu daripada menerima uang tanpa identitas lalu akun merchant ditangguhkan aggregator. Dev & staging tak terpengaruh.
- [ ] **Syarat & Ketentuan ditinjau pemilik** — `/syarat` sudah tayang (DECISIONS #59) tetapi isinya draf yang disusun dari perilaku kode, bukan dari penasihat hukum. Tinjau terutama batas tanggung jawab dan klausul konten.
- [ ] **`halo@merriva.id` harus bisa MENERIMA email.** Verifikasi domain di Resend hanya memberi hak **mengirim** — SPF/DKIM tidak membuat kotak masuk. Butuh record **MX** + mailbox nyata (mis. Cloudflare Email Routing → inbox Anda). Alamat itu sudah tercetak di `/syarat`, `/privasi`, `/refund` sebagai kanal resmi **permintaan hapus data UU PDP**, di halaman pesanan pelanggan, dan sebagai **jalur banding** di email penangguhan. Tanpa MX, setiap keluhan, sengketa pembayaran, dan permintaan hapus data memantul atau hilang.
  - `replyTo` SUDAH dipasang di `src/lib/email/send.ts` (2026-10-12) dan menunjuk alamat yang sama dengan halaman hukum — jadi begitu MX + mailbox aktif, balasan pelanggan langsung berfungsi tanpa perubahan kode lagi. Sebelum MX ada, balasan tetap memantul.
- [ ] Daftar **PSE Kominfo** via OSS
- [ ] Kebijakan **privasi & refund** tayang (`/privasi`, `/refund` sudah ada — review isi & data kontak)
- [ ] **Jalankan `supabase db push`** — migrasi `20261016111713` sudah di repo tetapi **belum terpasang di produksi**. CI hanya fast-forward branch `production`; ia tidak pernah menyentuh database. Migrasi ini membetulkan `purge_invitation_data` yang memanen path foto bernama dengan bentuk yang salah (`content->>'coverPhoto'` pada nilai OBJEK mengembalikan teks JSON-nya, bukan path) sehingga **foto sampul dan wajah kedua mempelai tidak pernah terhapus** saat purge retensi — lubang UU PDP yang justru diklaim tertutup. Sekali undangan ter-purge, `purged_at` membuat cron tak akan pernah mencoba ulang. Detail & alasan: DECISIONS #94.
- [ ] Pastikan **cron `purge-expired`** (Fase 3) terjadwal & jalan — menghapus permanen data tamu/RSVP/media/gift_notes **6 bulan pasca-expired** (UU PDP 27/2022); baris undangan tinggal kerangka statistik, `orders` (retensi keuangan) dipertahankan. Verify di staging: undangan `expired` dengan `active_until` > 6 bln lalu → panggil cron → data pribadi terhapus, `purged_at` terisi. Klien juga bisa "hapus undangan" non-aktif kapan saja dari dashboard.

- [x] **Unduhan ZIP foto galeri** — DIBANGUN 2026-10-13 (DECISIONS #70). Tombolnya di `/dashboard/undangan/{id}/tamu`, yaitu halaman yang DIRUJUK email peringatan pra-purge — sebelum ini tautan email itu mendarat di halaman tanpa unduhan foto. Kalimat `/syarat` dikembalikan menyebut galeri, **dengan batas yang tetap benar**: yang bisa diberikan adalah varian 1600 px, karena foto dikompres di browser dan berkas kamera asli tak pernah sampai ke server (SPEC §4.4).
  - Sekalian diperbaiki: ZIP Album Momen dulu menolak album `archived` padahal halamannya menawarkan tombol unduh — refund add-on mengarsipkan album, jadi pemilik melihat tombol lalu mendapat 404.
  - ⚠️ **Padam total tak lagi menyamar jadi unduhan berhasil** (16 Okt 2026, DECISIONS #93). Karena ZIP dialirkan lewat generator, status 200 sudah terkirim sebelum satu byte foto pun diambil — dan karena foto yang gagal memang sengaja dilewati, storage yang mati total dulu menghasilkan ZIP SAH berisi NOL foto, tepat di jalur penyelamatan terakhir yang dijanjikan email pra-purge. Kini: sebagian gagal → tetap 200 (nomornya berlubang, dan dilaporkan); semua gagal → **503** dengan penjelasan yang bisa dibaca pemilik, tanpa berkas apa pun. Ada test hijau yang dulu mengesahkan perilaku lama; test itu ditulis ulang beserta niatnya.

## Fase 9 — Go-live

- [ ] **10 undangan uji lintas 3 kategori** (wedding/corporate/family) — Definition of Done M4
- [x] **`/sitemap.xml`** — DIBUAT 2026-10-12 (`src/app/sitemap.ts`, 7 halaman marketing). Halaman undangan sengaja TIDAK didaftarkan: ia `noindex`, dan memasukkannya ke sitemap akan membocorkan daftar klien beserta nama mempelainya ke indeks publik — satu test menjaga itu.
- [ ] Daftarkan `https://merriva.id/sitemap.xml` di **Google Search Console** (tindakan Anda; sitemapnya sudah tayang).
- [ ] Semua fase di atas hijau → umumkan
- [ ] Pantau Sentry + UptimeRobot intensif di hari-hari pertama; siapkan RUNBOOK bila insiden

---

## Lampiran — Env production (ringkas; detail DEPLOYMENT §4)

> **Jangan isi tabel ini dari hafalan — jalankan `pnpm env:check --prod`.**
> Ia membaca `.env.production.local`, menyebut persis apa yang masih kosong beserta
> akibat konkretnya, menandai mana yang build-arg, dan MEMERAH bila ada variabel
> baru di kode yang belum terdaftar. Daftar induknya ada di
> [`../.env.example`](../.env.example); satu test (`tests/unit/env-manifest.test.ts`)
> menjaga agar daftar itu tetap sejalan dengan kode dan dengan `ARG` di Dockerfile.

> **Enam variabel bertanda 🏗️ adalah BUILD ARG, bukan hanya env runtime.** Next meng-inline nilainya ke bundel saat `next build`, dan `.dockerignore` membuang `.env*` dari konteks build — jadi di dalam Docker nilainya hanya bisa datang dari build-arg. Mengisinya setelah image jadi tidak berpengaruh sampai **rebuild**.

| Variabel | Kapan | Catatan |
|---|---|---|
| 🏗️ `NEXT_PUBLIC_APP_URL` | Fase 1 | `https://merriva.id` |
| 🏗️ `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fase 1 | project **prod** |
| `SUPABASE_SERVICE_ROLE_KEY` | Fase 1 | **RAHASIA, dan variabel paling kritis di tabel ini.** Halaman undangan publik `/[slug]` dirender lewat klien service_role — tanpa kunci ini SETIAP undangan 500 untuk SEMUA tamu, bukan hanya webhook/cron/admin. Juga: `/api/health` turun ke probe anon → PostgREST 401 → health SELALU 503 → container masuk restart loop tanpa galat di log aplikasi. |
| `STORAGE_DRIVER` | Fase 1 | `local` (jembatan, → `r2` di Fase 5). Kosong = `supabase`; **salah ketik melempar** |
| `MEDIA_ROOT` | Fase 1 | hanya driver `local`; boleh kosong (default `/app/data/media`). **Wajib ditimpa volume** — DEPLOYMENT §4a |
| 🏗️ `NEXT_PUBLIC_MEDIA_URL` | Fase 1 | **WAJIB** host penyaji media dari domain sendiri. **Kosong = SELURUH foto/musik undangan 404 DAN editor 500 begitu ada satu foto** (app gagal-keras di runtime prod). `local`: `https://merriva.id/media`. R2: `https://cdn.merriva.id`. Tetap Supabase storage: domain proxy sendiri, atau sementara (deviasi §6.4) `https://<ref>.supabase.co/storage/v1/object/public/media` |
| `CRON_SECRET` | Fase 1/3 | string acak panjang (`openssl rand -hex 32`). **Gerbang fail-closed untuk keempat cron** — mengganti nilainya tanpa memperbarui keempat perintah di Easypanel membuat semuanya dijawab `401` tanpa satu pun galat terlihat: rekonsiliasi pembayaran DAN retensi UU PDP berhenti diam-diam. Jangan sampai ada newline tersisip. |
| `MOMEN_SESSION_SECRET` | Fase 1 | **WAJIB produksi, dan sebelumnya tidak ada di tabel ini.** `openssl rand -hex 32`. Rahasia HMAC cookie sesi tamu Album Momen. Melempar di produksi bila kosong — tetapi **lazily**: aplikasi start normal dan semua halaman jalan, yang 500 hanya `/[slug]/momen` pada saat tamu di acara mencoba mengunggah foto. |
| `PAKASIR_PROJECT_SLUG` / `PAKASIR_API_KEY` | Fase 2 | project production |
| `RESEND_API_KEY` / `EMAIL_FROM` | Fase 2 | domain terverifikasi |
| 🏗️ `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Fase 2 | anti-spam RSVP |
| 🏗️ `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG/PROJECT/AUTH_TOKEN`) | Fase 6 | kosong = non-aktif |
| `R2_*` | Fase 5 | hanya bila `STORAGE_DRIVER=r2` |
| `PEXELS_API_KEY` | opsional | foto contoh demo |
