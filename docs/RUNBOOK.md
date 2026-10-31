# RUNBOOK — Pemulihan Merriva

Prosedur singkat pemulihan ketika VPS/aplikasi bermasalah. Prinsip inti: **aplikasi stateless** — seluruh data persisten ada di **Supabase** (dan **R2** mulai M4), sehingga VPS mati **tidak** menghilangkan data. Pemulihan = deploy ulang container + arahkan DNS.

## Komponen & lokasi data

| Komponen | Tempat | Hilang bila VPS mati? |
|---|---|---|
| Aplikasi Next.js | Container Docker di VPS (Easypanel) | Ya — tapi bisa dibangun ulang dari repo Git |
| Database (Postgres + Auth) | Supabase cloud | Tidak |
| Media (foto & lagu) | **Disk VPS** — volume `/app/data/media` (host: `/etc/easypanel/projects/etc/merriva/volumes/media`); → R2 di M4 | **YA** — satu-satunya komponen yang ikut mati bersama VPS. Selama `STORAGE_DRIVER=local`, backup direktori itu adalah satu-satunya salinan yang ada |
| Secrets/env | Panel Easypanel (+ password manager pemilik) | Perlu diisi ulang saat provision baru |
| DNS | Cloudflare | Tidak |

## Skenario A — Aplikasi/kontainer rusak (VPS masih hidup)

1. Easypanel → app `merriva` → **Logs** untuk diagnosa.
2. **Redeploy** (atau restart) app. Easypanel membangun ulang dari `main`.
3. Verifikasi: `curl -s https://merriva.id/api/health` → `{"status":"ok","db":"up"}`.

## Skenario A2 — Deploy terakhir merusak produksi (mundur ke versi sebelumnya)

Sampai 21 Okt 2026 dokumen ini **tidak punya satu kalimat pun** tentang mundur —
padahal minggu-minggu go-live berisi beberapa rebuild berturut-turut (DSN
Sentry, cutover R2, bump dependensi).

**Sebelum apa pun: tentukan apakah deploy itu membawa MIGRASI DB.**
`git diff <commit-sehat>..HEAD -- supabase/migrations/` — kalau ada isinya,
**jangan** langsung revert kode. Migrasi tidak ikut mundur, dan kode lama di
atas skema baru adalah keadaan yang tak pernah diuji. Perbaiki maju
(`git revert` HANYA bagian kode, lalu migrasi kompensasi), atau pulihkan DB
lebih dulu dari backup (lihat bagian berikutnya).

**Rollback kode (tanpa migrasi) — forward-only, bukan force-push:**

1. Cari commit sehat terakhir. Yang paling bisa dipercaya bukan `main`
   melainkan apa yang benar-benar disajikan produksi:
   `curl -s https://merriva.id/api/health` lalu bandingkan `driver`,
   `mediaBase`, dan `cronSecret` dengan yang Anda harapkan.
2. `git revert --no-edit <commit-rusak>` lalu `git push origin main`.
   **Jangan `git reset --hard` + force-push**: branch `production`
   di-fast-forward CI tanpa `--force`, jadi `main` yang mundur membuat promosi
   berikutnya DITOLAK server dan Anda kehilangan gerbangnya.
3. Easypanel membangun ulang dari `main` (lihat LAUNCH-CHECKLIST Fase 1 — ia
   masih mengawasi `main`, bukan `production`). Tunggu, lalu verifikasi dengan
   `uptime` di `/api/health` yang kembali kecil.
4. `pnpm ops:verify` untuk memastikan tak ada butir yang ikut mundur.

**Yang TIDAK bisa dimundurkan dengan revert kode — ketahui sebelum menekan:**

| Perubahan | Kenapa |
|---|---|
| `NEXT_PUBLIC_*` (DSN Sentry, `MEDIA_URL`) | Dipanggang saat BUILD. Mengembalikan nilainya di panel lalu **restart** tidak mengubah apa pun — wajib rebuild. |
| Cutover R2 setelah ada unggahan baru | Objek baru hanya ada di R2. Kembali ke `local` membuat foto-foto itu 404; yang benar adalah memperbaiki maju. |
| Migrasi DB | Lihat peringatan di atas. |
| Email yang sudah terkirim | Kuitansi/pengingat tidak bisa ditarik. |
| Peralihan ke BinderPay (`BINDERPAY_PARTNER_ID` terisi) | Order BinderPay `pending` (≤ 24 jam) menyimpan `contractId` di `txn_id`. Mengosongkan env — atau me-revert kodenya — mengembalikan verifikasi ke Pakasir yang tak mengenalnya, dan callback-nya tak lagi diproses. Mundur hanya bila tak ada order BinderPay `pending` (LAUNCH-CHECKLIST Fase 2b langkah 8). |

## Skenario B — VPS mati total

> 🔁 **Jangan lupa crontab root.** Keempat cron Merriva hidup di crontab host,
> bukan di Easypanel (yang tak punya penjadwal — lihat LAUNCH-CHECKLIST Fase 3)
> dan bukan di dalam image. VPS baru = crontab kosong, dan keempatnya diam
> tanpa satu pun sinyal: `/api/health` tak membaca cron sama sekali.
>
> Pasang ulang dengan satu perintah — skripnya idempoten, mencadangkan crontab
> yang ada lebih dulu, dan tidak menyentuh entri milik proyek lain di VPS yang
> sama:
>
> ```bash
> scp scripts/pasang-cron-host.sh <vps>:/root/
> grep -m1 '^CRON_SECRET=' .env.production.local | cut -d= -f2- \
>   | ssh <vps> 'bash /root/pasang-cron-host.sh'
> ```
>
> Secret mengalir lewat STDIN — tak pernah masuk argumen perintah, `ps`, atau
> riwayat shell. Lalu buktikan dengan `pnpm ops:verify`: bagian "Data produksi"
> membaca `cron_runs`, jadi ia hijau hanya setelah job benar-benar jalan.


1. Provision VPS baru, pasang **Easypanel**.
2. Buat app dari repo Git (Dockerfile), port `3000` — lihat [`DEPLOYMENT.md`](DEPLOYMENT.md) §3–4.
3. Isi ulang **environment variables** di panel (dari password manager) — lihat [`../.env.example`](../.env.example). Bila whitelist IP proyek BinderPay sudah diisi, daftarkan IP VPS baru — kalau tidak, setiap panggilan BinderPay gagal dengan galat generik (DECISIONS #99).
4. **Buat kembali volume media** `/app/data/media` (DEPLOYMENT §4a) lalu **restore isinya dari backup**. Lewati langkah ini dan hasilnya adalah kegagalan yang paling menyesatkan di dokumen ini: situs hidup, dasbor normal, setiap undangan merender — dengan semua fotonya 404, karena baris `media` menyimpan path relatif ke objek yang sudah tak ada salinannya.
5. Attach domain `merriva.id` + SSL.
6. Cloudflare → arahkan DNS `merriva.id` ke IP/host VPS baru (proxy ON).
7. Verifikasi `https://merriva.id/api/health` **dan** satu URL media nyata (`https://merriva.id/media/songs/<hash>.mp3`).

> Database ada di Supabase, jadi tak ada langkah restore DB di sini. **Media tidak begitu** selama `STORAGE_DRIVER=local`: ia hidup di disk VPS yang baru saja mati. Pindah ke R2 menghapus seluruh langkah 4 ini.

## Backup & restore database

- **Supabase Pro**: backup harian otomatis (retensi 7 hari). Upgrade ke Pro **sebelum** ada klien berbayar.
- **Latihan restore wajib 1×** sebelum launch (checklist M4): restore backup ke project sementara, verifikasi jumlah baris & login.
- Restore PITR/backup dilakukan dari **Supabase Dashboard → Database → Backups**.

## Data migrasi & skema

- Skema dikelola via `supabase/migrations/`. Terapkan ke project: `pnpm supabase db push` (setelah `supabase link`).
- **Selalu** uji migrasi di **staging** dulu; snapshot/backup sebelum migrasi destruktif di production (boundary wajib).

## Permintaan hapus akun (UU PDP) — AUDIT-2026-10-01 A6

`/privasi` menjanjikan "Anda dapat meminta penghapusan data kapan saja". Sejak
2026-10-03 janji itu bisa ditepati dari dalam produk; **jangan** mengeksekusinya
lewat SQL editor.

**Prosedur**

1. Verifikasi bahwa permintaannya berasal dari pemilik akun — balas dari alamat
   dukungan ke **alamat email akun itu sendiri** dan minta konfirmasi. Jangan
   menerima permintaan dari alamat lain.
2. Buka `/admin/pengguna`, cari akunnya, tekan **Hapus akun**.
3. Isi alasan (masuk `admin_logs`, jadi satu-satunya penjelasan kelak) dan
   **ketik ulang email akun tersebut**. Server mencocokkannya; salah ketik →
   tak ada yang dihapus.
4. Bila ditolak dengan *"masih punya undangan AKTIF"*: itu disengaja. Tamunya
   sudah memegang tautan dan acaranya mungkin belum lewat. Beri tahu pelanggan
   tanggal `active_until`-nya, atau — bila ia memang ingin undangannya mati
   sekarang — buat undangannya kedaluwarsa dulu lewat `/admin/undangan/<id>`,
   baru hapus akunnya.

**Apa yang terjadi**

| Data | Nasib |
|---|---|
| `auth.users` (login) | dihapus |
| `profiles` (nama, WhatsApp) | dihapus |
| `guests`, `rsvps`, `gift_notes`, `media`, `invitation_events`, `momen_albums`+foto | dihapus permanen |
| Objek storage (foto galeri & Album Momen) | dihapus (best-effort) |
| Baris `invitations` | **tetap ada** sebagai kerangka kosong (`content = {}`, `purged_at` terisi, `user_id` → NULL) — ia menahan FK `orders.invitation_id` |
| Baris `orders` | **tetap ada**, `user_id` → NULL |

Riwayat pesanan sengaja dipertahankan ter-anonimisasi: tanpanya laporan omzet
kehilangan transaksi yang benar-benar terjadi dan rekonsiliasi dengan mutasi
saldo gateway (BinderPay; Pakasir sebelum peralihan) jadi mustahil. UU PDP
mengizinkan retensi untuk kewajiban hukum; nominal dan tanggalnya bukan data
pribadi setelah pemiliknya dilepas.

**Bila gagal di tengah**

- *"Data pribadi sudah terhapus, tetapi baris login-nya gagal dihapus"* —
  seluruh data pribadi sudah hilang; yang tersisa hanya baris `auth.users`.
  Hapus manual di Supabase Dashboard → Authentication → Users. Periksa Sentry
  (`area: admin.delete-account.auth`).
- Objek storage yang gagal dihapus dilaporkan ke Sentry
  (`area: admin.delete-account.storage`) tanpa membatalkan penghapusan. Bersihkan
  manual bila perlu; pathnya ada di pesan galatnya.

**Belum ada:** tombol hapus mandiri di dashboard pelanggan. Permintaan masuk
lewat alamat dukungan dan dieksekusi admin.

## Rotasi & kebocoran kredensial — AUDIT-2026-10-01

Dokumen ini menjawab satu pertanyaan: *"kunci ini bocor, apa yang saya lakukan 30
menit ke depan?"* Sebelumnya RUNBOOK hanya mendaftar kredensial untuk MASUK
kembali, bukan untuk MENCABUT.

**Urutan saat dicurigai bocor (jangan dibalik)**

1. **Cabut kunci lamanya dulu**, sebelum apa pun. Kunci yang masih hidup sambil
   Anda menyiapkan penggantinya tetap bisa dipakai.
2. Pasang kunci baru di tempat yang dibutuhkan (lihat tabel).
3. Periksa jejak pemakaian: Supabase Dashboard → Logs. Untuk `service_role`,
   cari permintaan yang tak Anda kenali — kunci itu mem-bypass RLS di SELURUH
   tabel, jadi satu permintaan saja bisa membaca semua `guests` dan `orders`.
4. Paksa keluar semua sesi bila akun pengguna ikut terdampak (Supabase →
   Authentication → Users).

**Efek samping per kredensial — ini bagian yang tak terlihat dari kode**

| Kredensial | Tempat rotasi | Efek samping |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | Ganti env Easypanel lalu redeploy. Tak perlu rebuild (dibaca saat runtime). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_*` lainnya | Supabase / Cloudflare | **WAJIB REBUILD.** `Dockerfile` menerimanya sebagai `ARG` dan Next meng-INLINE-nya ke bundel saat build — mengganti nilainya di Environment saja tidak berpengaruh sampai image dibangun ulang. |
| `CRON_SECRET` | Buat sendiri (`openssl rand -hex 32`) | Dipakai BERSAMA oleh 4 scheduled job. `isAuthorizedCron` fail-closed: begitu secretnya diganti tanpa memperbarui perintah cron di Easypanel, keempatnya mulai dijawab 401 **tanpa satu pun galat yang terlihat** — retensi UU PDP dan rekonsiliasi pembayaran berhenti diam-diam. Ganti env DAN keempat perintah cron dalam satu sesi. |
| `MOMEN_SESSION_SECRET` | Buat sendiri (`openssl rand -hex 32`) | **MEMBATALKAN SELURUH SESI TAMU Album Momen seketika.** Tamu yang sedang memotret di tengah resepsi akan terlempar keluar dan harus masuk ulang. **Jangan pernah dirotasi saat ada acara berlangsung.** Di produksi variabel ini WAJIB terisi — server gagal-keras bila kosong. |
| `PAKASIR_API_KEY` | Dashboard Pakasir | Hanya selama Pakasir masih jalur bayar (sampai LAUNCH-CHECKLIST Fase 2b). Verifikasi pembayaran (`transaction-status`) berhenti sampai env diperbarui. Order yang sudah dibayar tidak hilang — cron `expire-orders` merekonsiliasinya setelah kunci baru aktif. |
| `BINDERPAY_PRIVATE_KEY_B64` | Pasangan kunci baru buatan sendiri; ganti kunci PUBLIK yang terdaftar di proyek produksi dashboard BinderPay | Kunci privat KITA: dengannya siapa pun bisa menandatangani panggilan API BinderPay atas nama Merriva. Selama kunci publik di BinderPay dan kunci privat di env tak berpasangan, SETIAP panggilan BinderPay ditolak — tak ada QR terbit (`payment.create-link`) dan tak ada verifikasi lunas (`payment.verify` / `payment.verify.broken`), jadi callback pun tak bisa mengaktifkan. Ganti di BinderPay dan env + redeploy dalam SATU sesi. Pembayaran di jendela itu tidak hilang — cron merekonsiliasinya setelah pasangannya cocok lagi. Terpisah dari pasangan sandbox. |
| `BINDERPAY_PUBLIC_KEY_B64` | Dirotasi BINDERPAY, bukan kita — ambil yang baru dari dashboard proyek produksi | Bukan rahasia. Nilai basi membuat SETIAP callback ditolak 401 **tanpa laporan Sentry** — lihat "Callback ditolak 401" di bawah. |
| `RESEND_API_KEY` | Dashboard Resend | Email berhenti terkirim; `sendTransactionalEmail` mengembalikan `skipped`/`error` tanpa menggagalkan aksinya. Perhatikan: ini juga password SMTP Supabase Auth bila Custom SMTP sudah disetel — perbarui di KEDUA tempat. |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile | Pendaftaran, reset kata sandi, dan sesi Album Momen ditolak sampai env diperbarui. Site key-nya `NEXT_PUBLIC_*` → bila ikut diganti, **butuh rebuild**. |
| `R2_SECRET_ACCESS_KEY` (saat `STORAGE_DRIVER=r2`) | Cloudflare R2 | Unggah & hapus media gagal; media yang sudah ada tetap tersaji karena disajikan lewat domain sendiri. |

**Yang membuat rotasi di sini berbeda dari kebanyakan proyek:** separuh kredensial
di atas di-inline saat build, dan separuh lagi dipakai bersama oleh beberapa
konsumen. Mengganti nilainya di satu tempat lalu menganggap selesai adalah
kesalahan yang paling mungkin terjadi — dan yang paling senyap.

**Belum ada:** kebijakan rotasi berkala. Kunci pihak ketiga (Pakasir, Resend) dan
pasangan kunci BinderPay berumur tak terbatas. Latihan rotasi `service_role` 1×
layak dijadwalkan sebelum launch, sejajar latihan restore backup.

## Insiden pembayaran BinderPay

Berlaku setelah peralihan (LAUNCH-CHECKLIST Fase 2b). Prinsipnya tetap: callback =
sinyal, bukti lunas hanya dari `qr-mpm-query` — jadi tak satu pun prosedur di bawah
mengaktifkan order berdasarkan callback atau tangkapan layar pelanggan saja.

**Callback ditolak 401**

`/api/webhooks/binderpay` menjawab 401 bila tanda tangan tak cocok dengan
`BINDERPAY_PUBLIC_KEY_B64` atau `X-TIMESTAMP` meleset lebih dari ±5 menit dari jam
server — **tanpa laporan Sentry**, karena ditolak sebelum menyentuh apa pun. Uangnya
tidak hilang: poller halaman bayar (±6 menit, selama pelanggan di sana) dan cron
`expire-orders` (order ≥ 10 menit, tiap jam) tetap memverifikasi lewat query. Yang
hilang kecepatannya — pelanggan yang menutup tab baru aktif saat cron jalan.

Gejalanya: `mudaActivated` di kartu cron `/admin` terus > 0, dan di `/admin/order` tak
ada lagi order yang diaktifkan callback (*Lihat payload* callback memuat
`originalPartnerReferenceNo`; aktivasi poller/cron berisi `"source": "status_poll"`).

1. **Kunci publik.** BinderPay yang merotasinya, bukan kita — atau yang terpasang
   kunci sandbox. Ambil kunci publik proyek PRODUKSI dari dashboard BinderPay →
   base64 satu baris → `BINDERPAY_PUBLIC_KEY_B64` di Easypanel → redeploy.
2. **Jam server.** `timedatectl` di host VPS harus menyebut
   `System clock synchronized: yes`; bandingkan `date -u` dengan header `Date` dari
   `curl -sI https://api.binderpay.id`. Header itu akurat; field waktu di bodi mereka
   tidak (`cancelTime` tertinggal ±90 detik).
3. **Yang belum terukur** (DECISIONS #102). 401 sejak callback produksi PERTAMA →
   curigai nama header atau bentuk tanda tangan, bukan kunci. Hanya ULANGAN yang 401
   → ulangan mungkin membawa stempel waktu lama; yang tiba > 5 menit kemudian pasti
   ditolak.

Callback dari transaksi SANDBOX (uji dev, bila URL callback proyek sandbox juga
menunjuk `merriva.id`) tak pernah mengaktifkan apa pun di produksi — verifikasinya
bertanya ke BinderPay PRODUKSI dengan order & kredensial kita. 401 darinya boleh
diabaikan.

**`payment.webhook.partner-lain`** bukan kegagalan: callback ber-`X-PARTNER-ID` yang
bukan Partner ID kita tetap diproses (query yang memutuskan). Laporannya membawa
nilai `partnerId` yang diterima. Bila muncul untuk callback PRODUKSI, nilai itulah isi
header callback produksi yang sebenarnya — catat di DECISIONS #102 (belum terukur).

**`payment.webhook.unconfirmed`**

Callback bertanda tangan SAH menyatakan lunas (`00`), tetapi `qr-mpm-query` belum.
Route menjawab 503 agar BinderPay mengulang (dokumen mereka menyebut 3 kali; jumlah
dan jedanya belum terukur); tak ada yang diaktifkan.

- Sekali-sekali, lalu order menjadi **Lunas** di `/admin/order` (cari lewat tag
  `orderCode`) → jeda status antar-sistem yang sembuh sendiri lewat ulangan
  callback, poller, atau cron. Selesai.
- Masih **Menunggu** setelah satu jalan cron → query dan callback berselisih paham.
  Cocokkan dengan menu Transaksi & Mutasi di dashboard BinderPay, laporkan ke
  BinderPay, dan bila uangnya terbukti masuk ikuti bagian berikut.

**Order sudah dibayar tetapi tak aktif**

Pemicu utamanya laporan Sentry **`payment.cancel`** berpesan `HTTP 409 4097700`
*"Transaction has already been paid and cannot be cancelled"* (`cancelFailed` > 0 pada
jalan cron itu): cron baru saja meng-`expired`-kan order yang ternyata SUDAH dibayar —
pelanggan membayar di antara verifikasi dan pembatalan. Order `expired` tak bisa lagi
diaktifkan webhook, poller, maupun cron. Pemicu lain: `payment.webhook.unconfirmed`
yang menetap (di atas), `payment.mismatch` (nominal tak cocok; order tetap
`pending`), dan **`payment.webhook.pakasir-pasca-peralihan`** — webhook Pakasir yang
tiba SESUDAH saklar BinderPay hidup; tak satu pun jalur bisa memverifikasinya lagi,
jadi periksa di dashboard Pakasir (bila memang lunas di sana, lanjutkan langkah di
bawah; bila tidak, abaikan — laporan ini juga bisa dipicu siapa pun bila
`PAKASIR_WEBHOOK_SECRET` kosong).

1. Pastikan uangnya masuk: dashboard BinderPay → Transaksi (cari kode order) dan
   Mutasi (bertambah sebesar POKOK = harga − fee, bukan harga). Order era Pakasir:
   dashboard Pakasir.
2. Bila order aslinya masih `pending`, tutup dulu dengan
   `select * from public.expire_pending_order('<kode>');` supaya tak teraktivasi dua
   kali.
3. Kabari pelanggan, lalu pilih satu:
   - **Aktivasi manual** — hanya order pembelian/perpanjangan undangan:
     `/admin/undangan/<id>` → *Aktivasi manual* dengan paket yang sama. Ia membuat
     order `manual` baru dan mengirim kuitansi; order aslinya tetap `expired`.
   - **Refund** — satu-satunya jalan untuk order **upgrade** dan **add-on Album
     Momen** (*Aktivasi manual* hanya mengenal paket undangan dan menolak undangan
     yang sedang aktif). Lihat berikut.

Pesan `payment.cancel` 404 `4047701` berarti BinderPay tak mengenal transaksinya:
order era Pakasir (`qr_content` NULL) yang lolos LAUNCH-CHECKLIST Fase 2b langkah 4 —
periksa **dashboard Pakasir**, bukan Mutasi BinderPay; link Pakasir-nya tak pernah
dibatalkan. Pesan lain (timeout, `anggaran Pakasir habis`) berarti QR-nya tak
terbatalkan, dan cron tak mengulangnya. QR itu sudah lewat masa berlaku 23
jam, tetapi apakah QR kedaluwarsa benar-benar ditolak saat dibayar belum terukur — dan
pembayaran atas order `expired` dijawab 200 **tanpa laporan apa pun**: jejaknya hanya
Mutasi dan keluhan pelanggan.

**Pengembalian dana (refund)**

Merriva tak punya API refund — uangnya dikembalikan di **dashboard BinderPay** (order
yang dibayar lewat Pakasir: dashboard Pakasir).
Dokumen BinderPay mengenal status `04 Refunded`, tetapi alurnya belum pernah dicoba;
bila dashboard tak menyediakannya, hubungi dukungan BinderPay.

- **Nominal:** pelanggan membayar `amount_idr` (harga katalog), sedangkan saldo kita
  hanya menerima POKOK (harga − fee 0,7%; Basic 99.000 → 98.312). Apakah refund ikut
  mengembalikan fee belum diketahui — periksa yang benar-benar diterima pelanggan.
- **Order Lunas** (mis. pembayaran ganda): setelah uangnya kembali, `/admin/order` →
  *Tandai refund* beserta alasan. Ini mencabut layanannya dan menyesuaikan laporan;
  uangnya TIDAK ikut bergerak.
- **Order Kedaluwarsa** yang ternyata dibayar: tak ada yang ditandai — tombolnya hanya
  untuk order Lunas, dan order kedaluwarsa memang tak dihitung omzet. Cukup
  kembalikan uangnya.

## Checklist kredensial pemulihan (simpan di password manager)

- Supabase: URL + anon + service_role (prod), Access Token, DB password
- Easypanel: akses panel VPS
- Cloudflare: akses akun/DNS
- BinderPay: akses dashboard + PEM kunci privat PRODUKSI (hilang = buat pasangan baru, lihat tabel rotasi)
- Domain registrar, Pakasir (sampai peralihan), Resend, Sentry (sesuai milestone)

## Verifikasi pasca-pemulihan

```bash
curl -s https://merriva.id/api/health   # harap: {"status":"ok","db":"up",...}
```

Pantau juga UptimeRobot kembali hijau dan Sentry tidak menampilkan error baru.
