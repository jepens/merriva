# ARCHITECTURE — Merriva

**Versi:** 1.0 — 24 Juli 2026 · Detail fitur: `../SPEC.md` §4 · Skema data: `DATA-MODEL.md`

---

## 1. Gambaran

```
[Tamu & Klien (HP)] ──HTTPS──> [Cloudflare (DNS + proxy/CDN, gratis)]
                                    │
                          [VPS + Easypanel (Traefik, SSL otomatis)]
                                    │  container Docker
                              [Next.js app (standalone)]
                                    │
        ┌───────────────┬───────────┴──────────┬────────────────┐
   [Supabase cloud]  [BinderPay]**        [Resend]         [Turnstile]
   Postgres + RLS,   QRIS (SNAP)           email            anti-spam
   Auth, Storage*    + callback
        │
   *media pindah ke [Cloudflare R2 + cdn.merriva.id] menjelang launch (lihat §6)
  **pengganti Pakasir — aktif begitu BINDERPAY_PARTNER_ID terisi; sampai itu
    Pakasir (payment link QRIS/VA + webhook) tetap jalur bayarnya (lihat §4)
```

**Prinsip:** (1) halaman undangan publik harus sangat cepat dan tahan lonjakan hari-H → ISR cache, bukan query per kunjungan; (2) semua vendor eksternal dibungkus abstraksi (`lib/payment/`, `lib/storage/`) agar bisa ditukar tanpa menyentuh fitur; (3) biaya tetap mendekati Rp0 sampai ada pendapatan.

## 2. Stack & alasan

| Komponen | Pilihan | Alasan |
|---|---|---|
| Framework | Next.js App Router + TypeScript strict | SSR/ISR untuk halaman undangan cepat & SEO; satu codebase untuk marketing + dashboard + halaman publik |
| Styling | Tailwind + shadcn/ui (dashboard) + Framer Motion (tema) | Kecepatan develop; animasi tema premium dengan `prefers-reduced-motion` |
| DB/Auth | Supabase cloud (Postgres + RLS + Auth) | Managed, RLS untuk isolasi data antar user, free tier saat dev → Pro $25/bln saat launch (backup harian, tanpa auto-pause) |
| Media | `lib/storage/` driver `supabase` → `local` → `r2` | Lihat §6 |
| Pembayaran | BinderPay (API SNAP, QRIS saja); Pakasir sampai peralihan | Pakasir (DECISIONS #4) tutup → BinderPay (DECISIONS #99, #102): SNAP standar Bank Indonesia, bukan dialek satu vendor; QRIS 0,7% ditanggung merchant (pelanggan membayar persis harga katalog), settlement H+1 hari kerja. Dipilih saklar env — §4 |
| Email | Resend (fallback SMTP) | Free tier cukup; template transaksional sederhana |
| Anti-spam | Cloudflare Turnstile invisible | RSVP/ucapan publik tanpa mengganggu tamu |
| Deploy | Dockerfile → Easypanel di VPS | Keputusan pemilik; Dockerfile > Nixpacks: build deterministik & image kecil |
| Monitoring | Sentry + UptimeRobot + log Easypanel | Free tier; downtime hari-H tidak bisa ditoleransi |

## 3. Rendering & caching

Halaman undangan `/{slug}`: **SSR + ISR** — di-cache di server Next, di-revalidate (`revalidateTag`) saat pemilik menyimpan perubahan atau status berubah. Personalisasi tamu (`?g=token`) TIDAK boleh membatalkan cache halaman: data tamu diambil client-side ringan (atau streaming) di atas shell halaman yang di-cache. Landing & katalog: static + revalidate berkala. Dashboard: dynamic (auth). Gambar: `next/image` dengan dua varian yang sudah dibuat saat upload (400px/1600px WebP) — tanpa on-the-fly resizing berbayar.

**OG image `/api/og/[slug]` (M2.5):** Route Handler dinamis (satori render + query DB per hit) untuk pratinjau tautan WhatsApp. Satori hanya menghasilkan PNG (berfoto ±1,4 MB, di atas batas resmi WhatsApp 600 KB), jadi route mengonversinya ke **JPEG ±120 KB** dengan `fast-png` + `jpeg-js` (JS murni, tanpa binari native); konversi gagal → PNG lama + laporan `og.jpeg` + `no-store` (DECISIONS #119). **Cache CDN (DECISIONS #122):** og:image menunjuk `/api/og/{slug}.jpg?v={updated_at ms}` (helper `src/lib/og/image-url.ts`). Berekstensi gambar → Cloudflare meng-cache-nya **secara bawaan** dan mengikuti `s-maxage=86400`, **tanpa Cache Rule**; kunci cache bawaan memuat query, jadi simpanan pemilik (`?v` baru) = entri baru = gambar segar. Respons 200 ber-`Content-Length` eksplisit (tanpa itu Next mengirim chunked), tanpa `stale-while-revalidate` (Cloudflare mengabaikannya bila ada `s-maxage`). Undangan bersampul yang fotonya tak ikut terender (galat, batas waktu 3 detik, tipe salah, atau 404 — `/media` menjawab 404 juga untuk galat volume) → gambar tanpa foto hanya `s-maxage=300`, agar kedipan atau salah konfigurasi tak menahan pratinjau tanpa wajah sehari penuh. Path polos `/api/og/{slug}` tetap dilayani untuk pratinjau lama, tetapi tak ter-cache. Halaman Sebar memanaskan URL yang sama sekali saat dibuka (undangan aktif saja; simpan template Sebar me-revalidate `/{slug}` agar `?v` halaman ikut), karena WhatsApp Desktop/Web hanya menunggu kartu 7 detik dan gambar yang belum ter-cache dirender 1–3 detik. `?v` acak melewati cache; biayanya dibatasi pertahanan sisi-kode (rate limit per-IP + cheap-reject slug non-aktif ke `/og-default.png` statis). Cache per data center: PoP tanpa salinan mengambil dari origin; Tiered Cache topologi Smart (disarankan, paket Free) menyalurkannya lewat PoP hulu. Salinan edge bertahan ≤ 24 jam juga sesudah undangan di-suspend/dihapus — hilang segera = purge prefix `merriva.id/api/og/{slug}.jpg` (RUNBOOK). Karena apa pun yang dijawab route ini bisa ter-cache untuk semua scraper, galat DB dijawab **503 `no-store`** (bukan gambar default atau gambar bertanggal salah), dan 429/500 juga `no-store` — defensif: tanpa `Cache-Control`, Cloudflare hanya meng-cache 200/206/301/302/303/404/410 (DECISIONS #45). Slug yang bentuknya mustahil dijawab gambar default tanpa menyentuh DB.

**Kalender `.ics` `/api/ics/[slug]` (M2.6):** Route Handler dinamis untuk tombol "Simpan ke Kalender" (jalur Apple Calendar/Outlook; jalur Google memakai tautan `calendar.google.com/render` langsung, tanpa endpoint). Merender berkas **iCalendar RFC 5545** dari nama sesi + waktu (UTC) + tempat — **guest-agnostik** (tak menyentuh `guests`/`gift_notes`/`orders`; `?g`/`?to` diabaikan). `?e=<eventId>` → satu sesi; tanpa `?e` → seluruh sesi. Proteksi sama seperti OG (rate limit per-IP + cheap-reject slug reserved/draft/non-aktif → 404). Biaya per hit rendah (1 query + rakit string, tanpa render gambar) → **Cloudflare Cache Rule opsional**; bila dipasang, **cache key WAJIB menyertakan query `e`** (berkas berbeda per sesi) **dan Edge TTL tetap pendek**, serta **Browser TTL WAJIB "Respect origin"** (bawaan zona Cloudflare 4 jam menimpa `max-age` origin yang lebih kecil). Id sesi stabil lintas suntingan (DECISIONS #43), jadi URL `?e=` tak berubah saat pemilik mengganti jam; origin memancarkan `max-age=300, s-maxage=300` agar jam lama tak tersaji lebih dari 5 menit, dan `no-store` pada 404/429 agar 404 sesaat (sesi yang jamnya dikosongkan sebentar) tak tertahan. Galat DB dijawab **503 + `Retry-After` + `no-store`**, bukan 404 "tak ada" (DECISIONS #45). Tautan `.ics` di halaman hanya dirender untuk slug publik-aktif (bukan demo/draft) agar tak jadi tautan mati.

## 4. Pembayaran — BinderPay QRIS (SNAP); Pakasir sampai peralihan

**Pemilihan gateway.** Jalur uang hanya memanggil `getPaymentGateway()` (`src/lib/payment/index.ts`), dan saklarnya env yang berlaku GLOBAL: `BINDERPAY_PARTNER_ID` terisi → BinderPay untuk SEMUA penerbitan, verifikasi, dan pembatalan — termasuk order era Pakasir (wajib juga `BINDERPAY_BASE_URL` + `BINDERPAY_PRIVATE_KEY_B64`, kalau tidak galat keras, tak jatuh diam-diam ke Pakasir; host sandbox ditolak bila `NODE_ENV=production`). Kosong → Pakasir, jalur lama yang dipensiunkan saat peralihan: sampai saklar dibalik — termasuk produksi saat ini — Pakasir-lah jalur bayarnya, dan `/api/webhooks/binderpay` menjawab 200 tanpa berbuat apa pun. Mengosongkan saklar lagi BUKAN rollback yang aman selama ada order BinderPay `pending`: Pakasir tak mengenal `contractId` di `txn_id`, jadi verifikasi order itu putus. Keputusan & prasyarat peralihan: DECISIONS #99, #102.

**Alur BinderPay** (dok: binderpay.id/docs — bertentangan di beberapa tempat; bentuk generate/query/cancel DIUKUR di sandbox, bentuk callback masih dari dokumen + SDK resmi): buat `order` (`pending`, `order_code` unik mis. `MRV-8F3K2`, `amount_idr` = harga katalog) → `terbitkanLink` memanggil `qr-mpm-generate` (`partnerReferenceNo` = `order_code`, berlaku 23 jam) → `contractId` (→ `orders.txn_id`) dan string QRIS (→ `orders.qr_content`) ditulis dalam SATU update, BARU pelanggan diarahkan → tak ada halaman bayar hosted, jadi "link bayar" adalah halaman KITA (`/dashboard/undangan/[id]/bayar`, `/upgrade`, `/momen`) yang merender QR sebagai PNG di server dari `qr_content` (`src/server/payment/qris.ts`, pustaka `qrcode`; `qrUrl` vendor tak dipakai) plus tombol "Simpan gambar QR" → pelanggan memindai dengan e-wallet/m-banking → BinderPay mengirim callback ke `/api/webhooks/binderpay`.

**Satu QR per order.** Generate ulang dengan `partnerReferenceNo` yang sama ditolak (HTTP 500 `5004700`) — bukan find-or-create seperti Pakasir — jadi QR tak pernah diterbitkan ulang dan `qr_content` satu-satunya salinannya. Checkout undangan memakai ulang order `pending` TERBARU (yang ditampilkan `/bayar`) bila paketnya sama, HANYA selama QR-nya berlaku (langsung ke halaman bayar, tanpa memanggil gateway); QR mati atau order tanpa `txn_id` → order baru, yang lama ditutup cron (DECISIONS #101). Order `pending` era Pakasir (ber-`txn_id`, tanpa QR) masih dipakai ulang dengan menerbitkan link lagi — setelah saklar dibalik itu menjadi QR BinderPay untuk nomor order lama yang umurnya melewati batas order, jadi order itu wajib ditutup sebelum peralihan (DECISIONS #102). Masa berlaku 23 jam = umur maks order `pending` (`UMUR_MAKS_ORDER_PENDING_MS`, 24 jam — konstanta yang sama dengan cron) − 1 jam: QR harus mati sebelum cron bisa menutup order-nya.

**Fee ditanggung merchant (SPEC §4.8).** Pembayar ditagih pokok + fee (0,7%, dibulatkan biasa ke rupiah). Driver mengirim pokok TERBESAR dengan pokok + fee ≤ harga, jadi pelanggan membayar persis harga katalog (99.000 = pokok 98.312 + fee 688); penerbitan gagal bila tagihan melebihi harga. Query melaporkan POKOK, dan driver menerjemahkannya ke harga HANYA bila persis pokok untuk harga itu — selain itu gerbang nominal ketat `reconcile.ts` menolaknya. Saldo BinderPay bertambah sebesar pokok sedangkan `orders.amount_idr` tetap harga, jadi omzet dari `amount_idr` melebihkan penerimaan sebesar fee.

**Keamanan (kritis):** callback = SINYAL, bukan bukti. Handler `/api/webhooks/binderpay`: (1) rate limit 300/menit, bodi MENTAH maks 8 KB (413), tanda tangan RSA-SHA256 (`BINDERPAY_PUBLIC_KEY_B64`) atas bodi mentah dan path SNAP TETAP `/v1.0/qr/qr-mpm-notify` — bukan path URL kita — dengan stempel waktu ±5 menit; salah → 401 SEBELUM menyentuh DB. `X-PARTNER-ID` yang ada tetapi berbeda → dilaporkan beserta nilainya, tetap diproses (header itu belum terukur; query yang memutuskan); kunci publik kosong → dilaporkan, tetap diproses; (2) cocokkan `originalPartnerReferenceNo` dengan order `pending` (tak dikenal/bukan `pending` → 200); (3) verifikasi OTORITATIF `qr-mpm-query` memakai pasangan `order_code` + `txn_id` dari BARIS ORDER KITA — query menggemakan rujukan apa pun yang dikirim, jadi isi callback tak pernah menentukan apa yang diverifikasi — dan aktifkan HANYA bila status `00` DAN nominal cocok; (4) aktivasi atomik + idempoten lewat RPC `activate_paid_order` (notifikasi duplikat tak menggandakan aktivasi), lalu kuitansi + revalidate. Menurut dokumen BinderPay mengulang callback (±3 kali) sampai menerima HTTP 200 (`{responseCode:"2005200"}`), jadi yang transien dijawab 5xx — termasuk callback berstatus `00` yang belum dikonfirmasi query (dilaporkan `payment.webhook.unconfirmed`). `raw_notification` menyimpan daftar putih field callback (`buyerRef`, nama pembayar, dibuang). Kunci privat hanya di server.

**Cek status & pembatalan.** Ketiga halaman bayar mem-poll (tiap 4 dtk, berhenti setelah ±6 menit) aksi server yang menjalankan verifikasi otoritatif yang sama (`verifyAndActivate`) — jalur aktivasi kedua bila callback hilang/tertunda; QR tetap tampil selama berlaku, juga sesudah poll berhenti. Backstop ketiga adalah cron `expire-orders` (§7), yang juga membatalkan QR order kedaluwarsa lewat `qr-mpm-cancel` — wajib, karena QR yang lewat tenggat tetap dijawab `01 Initiated` (statusnya tak pernah berubah sendiri). Testing: driver BinderPay tak punya padanan `paymentsimulation` — pembayaran sandbox lewat Payment Simulator di dashboard sandbox.

**Pakasir (jalur lama, dipensiunkan saat peralihan).** API v2: `create-transaction` (find-or-create berkunci `order_id`) mengembalikan `txn_id` + `payment_link` ke halaman bayar hosted Pakasir (QRIS/VA) → webhook `/api/webhooks/pakasir` ber-header `X-Secret` (`PAKASIR_WEBHOOK_SECRET`, aditif) → verifikasi otoritatif `GET /api/v2/transaction-status/{slug}/{txn_id}` (berkunci `txn_id`, bukan `order_id`); pembatalan `POST /api/v2/cancel-transaction/{slug}/{txn_id}`. Polanya sama: payload = sinyal, aktivasi hanya bila API memastikan lunas + nominal cocok. Testing: `POST /api/paymentsimulation` (bukan uang asli; dilarang di production).

## 5. Sistem tema (kontrak inti)

Satu folder per tema di `src/themes/{slug}/`: `index.tsx` (komponen menerima props `InvitationData` hasil parse Zod — **dilarang fetch sendiri**), `theme.json` (metadata: kategori yang didukung, varian warna, section yang didukung), `demo-data.ts` (data fiktif untuk halaman demo). `registry.ts` memetakan slug → dynamic import. Menambah tema = folder baru + baris registry + seed metadata; kode inti tidak disentuh. Perubahan kontrak props = keputusan "tanya dulu" (berdampak semua tema).

## 6. Storage media — strategi bertahap (biaya Rp0 → skala)

| Tahap | Driver | Biaya | Catatan |
|---|---|---|---|
| Dev + klien awal | Supabase Storage (free: 1GB, egress 5GB) | Rp0 | Tanpa akun/kartu baru |
| **Jembatan (sejak 14 Okt 2026)** | **`local`: disk VPS** via volume Easypanel, disajikan route `/media/[...path]` + cache CF | Rp0 | Satu disk, tanpa replikasi/backup bawaan; **wajib volume ter-mount** — DECISIONS #82 |
| Menjelang launch (checklist M4, **wajib sebelum event ramai**) | Cloudflare R2 (free: 10GB + **egress gratis**) via `cdn.merriva.id` + cache CF | Rp0 | Egress Supabase free hanya 5GB ≈ 3–4 event |
| > 10GB (±1.000 undangan) | R2 $0,015/GB/bln | ±Rp10–25rb/bln | Siap video kenangan Fase 3 |

Prefix objek di bucket/volume `media` (satu bucket; validasi per tipe di aplikasi). Path selalu relatif dan disusun server; setiap prefix per-undangan diikat ke id undangannya oleh regex/constraint:

| Prefix | Isi | Penulis | Cache `/media` | Ikut purge |
|---|---|---|---|---|
| `inv/<undangan>/<id>` + `/1600.webp`, `/400.webp` | foto galeri (prefix 2 varian); foto bernama di `inv/<undangan>/foto/<uuid>` | klien (dikompres di peramban) | `immutable` 1 tahun | ya (`media_paths`) |
| `songs/<sha256>.<ext>` | pustaka lagu (content-addressed, dipakai bersama) | admin `/admin/lagu` | `immutable` 1 tahun — lagu yang dilaporkan wajib dihapus **dan** URL-nya di-purge di Cloudflare; menonaktifkan saja tidak menghentikan sajian (RUNBOOK) | tidak (milik platform) |
| `momen/<album>/<foto>/(display\|thumb).(webp\|jpg)` | foto Album Momen | tamu | `immutable` 1 tahun | ya (`momen_paths`) |
| `video/<undangan>/<uuid>/video.(mp4\|webm\|mov)` + `poster.(webp\|jpg)` | video undangan (#113) | pemilik Premium | `immutable` 1 tahun | ya (`momen_paths`) |
| `audio/<undangan>/<uuid>.mp3` | musik unggahan klien, hanya rantai frame audio — data di luar frame dibuang, isi badan frame tak diperiksa; selalu `audio/mpeg` + `nosniff` (#121) | pemilik Premium, dicatat di `music_uploads` | **maks 1 jam**, supaya takedown efektif ≤ 1 jam tanpa purge Cloudflare. Jangan pasang Edge TTL override untuk `/media/audio/*` | ya (`momen_paths`, dipanen dari `music_uploads`) |

Kolom cache berlaku untuk driver `local` (route `/media`, produksi sejak 14 Okt 2026). **Sebelum pindah driver**, janji cache 1 jam untuk `audio/` wajib dibawa: driver `supabase` memaku `cacheControl` setahun pada setiap unggahan, dan driver `r2` tidak memberi `Cache-Control` sama sekali, sehingga edge `cdn.merriva.id` memakai TTL bawaan Cloudflare.

Aturan yang membuat migrasi = ganti env: DB hanya menyimpan `storage_path` relatif; semua akses via `lib/storage/` (interface `upload/getUrl/delete`, driver dipilih `STORAGE_DRIVER`); media disajikan dari domain sendiri (`NEXT_PUBLIC_MEDIA_URL`); nama file immutable (hash/UUID; `audio/` memakai UUID tetapi cache pendek, lihat tabel). Migrasi: script copy S3-sync + ganti env. **Google Drive dilarang** (rate limit saat ramai = mati di hari-H; risiko akun; lihat DECISIONS #6). Upload: kompresi & resize di browser klien (2 varian WebP), naik via presigned/signed upload — VPS tidak memproses gambar.

## 7. Email & cron

Resend: verifikasi akun, kuitansi + link aktif, pengingat H-14 expiry, (opsional) rekap RSVP mingguan. Cron (Easypanel scheduled job memanggil `/api/cron/*` dengan header `CRON_SECRET`, atau `pg_cron`): expire order pending >24 jam · set `expired` untuk undangan lewat `active_until` · email pengingat · pembersihan data lewat retensi (lihat DATA-MODEL §5).

**Endpoint cron (M3.4).** Semua `POST`, otorisasi `Authorization: Bearer <CRON_SECRET>` (bandingan timing-safe; `CRON_SECRET` kosong = tertutup total). Jadwalkan di Easypanel (mis. `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://merriva.id/api/cron/<name>`):

- `/api/cron/expire-orders` — dua pass atas order `pending`. **Pass 1 (10 menit–24 jam):** rekonsiliasi saja — verifikasi OTORITATIF + aktivasi (`verifyAndActivate`), tak pernah membatalkan; backstop bila callback/webhook hilang dan pelanggan menutup halaman bayar sebelum poll selesai. **Pass 2 (>24 jam), rekonsiliasi dulu**: verifikasi OTORITATIF ke gateway aktif (BinderPay `qr-mpm-query`, Pakasir `transaction-status`) → jika lunas, aktifkan (atau `held`, pembayaran tetap tercatat), JANGAN batalkan; hanya yang API pastikan belum lunas → `expired` via RPC `expire_pending_order` (atomik, kunci baris, service_role-only), BARU dibatalkan ke gateway (best-effort; BinderPay `qr-mpm-cancel`, Pakasir `cancel-transaction`). Galat pembatalan dilaporkan `payment.cancel`; BinderPay 409 "already been paid" di sana = order yang baru di-expire ternyata SUDAH dibayar → tangani manual. Order tanpa `txn_id` langsung `expired` tanpa panggilan gateway (DECISIONS #101). Transien → dilewati (retry jalankan berikutnya). Sarankan tiap **~15 menit**.
- `/api/cron/expire-invitations` — undangan `active` lewat `active_until` → `expired` (satu UPDATE, service_role) + revalidate ISR `/{slug}`. Sarankan tiap **jam** (atau harian).
- `/api/cron/expiry-reminders` (M3.5) — undangan `active` dengan `active_until` ≤14 hari & `reminder_sent_at is null` → email pengingat (Resend), tandai `reminder_sent_at` saat terkirim (idempoten). **Di-reset saat siklus aktif BARU dimulai** — cabang undangan `activate_paid_order` (aktivasi, bayar ulang, perpanjangan, aktivasi manual admin) dan `admin_extend_invitation`. SENGAJA TIDAK di-reset oleh upgrade paket & add-on Album Momen: keduanya tak mengubah `active_until`, jadi pengingat siklus berjalan masih sah. Baris reset itu pernah HILANG dua kali saat fungsinya dibuat ulang — `supabase/tests/database/reminder_reset.test.sql` yang menjaganya sekarang. Sarankan tiap **~12 jam** (bukan 24 jam): "tandai saat terkirim" at-least-once — bila email terkirim tetapi mark gagal, retry mengandalkan `idempotencyKey` Resend yang hanya 24 jam, jadi cadence <24 jam mencegah pengingat ganda.
- Pembersihan retensi (hapus data tamu 6 bln pasca-expired): menyusul (pasca-MVP).

**Email transaksional (M3.5 + B7).** App mengirim langsung via Resend (`lib/email/`). Inventaris lengkapnya — satu baris per peristiwa, karena setiap kali daftar ini tak lengkap ada orang yang tak dikabari:

| Peristiwa | Pemicu | `idempotencyKey` |
|---|---|---|
| Kuitansi + link aktif | transisi order→`paid` dari webhook/poller/cron **dan aktivasi manual admin** | `receipt/{orderCode}` |
| Pengingat masa aktif H-14 | cron `expiry-reminders` | `expiry-reminder/{invitationId}` |
| Masa aktif BERAKHIR | cron `expire-invitations`, pada transisi `active`→`expired` | `expired/{invitationId}/{epoch active_until}` |
| Peringatan pra-purge H-30 & H-7 | cron `purge-expired`, fase peringatan | `purge-warning/{first\|final}/{invitationId}` |
| Penangguhan oleh tim | `adminSuspendInvitationAction`, transisi `suspended` | `suspended/{invitationId}/{menit}` |
| Pencabutan penangguhan | `adminReinstateInvitationAction`, hasil `reinstated` | `reinstated/{invitationId}/{menit}` |

Tiga hal yang berlaku untuk seluruh baris di atas: (1) **best-effort** — tak ada yang boleh menggagalkan aksi yang memicunya, dan masing-masing mengembalikan status kirim; (2) **aktivasi manual admin, suspend, dan reinstate MENAMPILKAN kegagalan itu ke admin** (`*_no_email`), karena di sana ada manusia yang bisa mengabari pelanggan sendiri — pemanggil otomatis sengaja mengabaikannya; (3) **alasan penangguhan yang dikirim berasal dari kolom terpisah** (`p_public_reason`), bukan dari catatan internal `p_reason` yang hanya masuk `admin_logs` (DECISIONS #68). Tanpa `RESEND_API_KEY` → no-op (dev/CI aman). `from` = `EMAIL_FROM` (domain wajib terverifikasi di Resend). **Email verifikasi akun & reset kata sandi tetap dikirim Supabase Auth** — arahkan ke Resend dengan mengatur **Custom SMTP = Resend** di dashboard Supabase (tugas konfigurasi, bukan kode). Email di sini transaksional (tanpa unsubscribe); rekap RSVP mingguan (non-transaksional, opsional) menyusul pasca-MVP.

## 8. Deployment (VPS + Easypanel)

`Dockerfile` multi-stage: `node:22-alpine` → install (pnpm, frozen lockfile) → build (`output: 'standalone'`) → runtime hanya `.next/standalone` + `public` + `.next/static`, user non-root, `EXPOSE 3000`, healthcheck LIVENESS `GET /api/health?probe=live` (tanpa probe DB, 10 dtk × 5; probe lengkap `/api/health` dengan cek DB untuk UptimeRobot/ops:verify — DECISIONS #110). Easypanel: app dari repo Git (push → auto build+deploy), domain `merriva.id` di-attach (SSL Let's Encrypt otomatis via Traefik), env vars di panel. DNS di Cloudflare (proxy oranye ON untuk cache statis + perlindungan).

**Dua project Supabase:** `merriva-staging` (development, gratis) dan `merriva-prod`. Alur migrasi: kembangkan & uji di staging → merge ke `main` → deploy → `supabase db push` ke prod secara sadar/manual. Jangan pernah mengarahkan dev ke DB prod.

Env (nilai di Easypanel/`.env`, daftar di `.env.example`):

```
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY,
RESEND_API_KEY, EMAIL_FROM, TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY,
CRON_SECRET, STORAGE_DRIVER (supabase|local|r2), MEDIA_ROOT (saat driver=local),
NEXT_PUBLIC_MEDIA_URL,
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET   # saat driver=r2
BINDERPAY_PARTNER_ID        # saklar gateway (§4): terisi = BinderPay, kosong = Pakasir. Bukan rahasia
BINDERPAY_BASE_URL          # produksi https://api.binderpay.id (host sandbox ditolak di produksi)
BINDERPAY_PRIVATE_KEY_B64   # RAHASIA — PEM kunci privat KITA (penanda tangan request), base64
BINDERPAY_PUBLIC_KEY_B64    # bukan rahasia — PEM kunci publik BinderPay (verifikasi callback), base64
PAKASIR_PROJECT_SLUG, PAKASIR_API_KEY, PAKASIR_WEBHOOK_SECRET   # jalur lama: dibutuhkan selama BINDERPAY_PARTNER_ID kosong; opsional setelah peralihan
```

## 9. Keamanan & kepatuhan

RLS di semua tabel (matrix di `DATA-MODEL.md`) · halaman publik dilayani server-side dengan penyaringan eksplisit — `guests`, `gift_notes`, `orders` tidak pernah ke publik · insert publik (RSVP/ucapan) lewat server action + Turnstile + rate limit per IP + honeypot · secrets hanya env · webhook: verifikasi aktif ke API (lihat §4) · UU PDP: kebijakan privasi, retensi data tamu 6 bulan pasca-expired lalu hapus otomatis, PSE Kominfo via OSS sebelum promosi besar.

## 10. Observability & pemulihan

Sentry (error FE+BE) · UptimeRobot ke `/api/health` production · log via Easypanel. Backup: Supabase Pro harian (7 hari) — **latihan restore minimal 1× sebelum launch**. Skenario VPS mati: data aman di Supabase/R2; pemulihan = deploy ulang container di VPS/Easypanel baru + arahkan DNS — dokumentasikan langkahnya saat M0 selesai.
