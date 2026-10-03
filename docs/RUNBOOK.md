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
rekening Pakasir jadi mustahil. UU PDP mengizinkan retensi untuk kewajiban
hukum; nominal dan tanggalnya bukan data pribadi setelah pemiliknya dilepas.

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
| `PAKASIR_API_KEY` | Dashboard Pakasir | Verifikasi pembayaran (`transactiondetail`) berhenti sampai env diperbarui. Order yang sudah dibayar tidak hilang — cron `expire-orders` merekonsiliasinya setelah kunci baru aktif. |
| `RESEND_API_KEY` | Dashboard Resend | Email berhenti terkirim; `sendTransactionalEmail` mengembalikan `skipped`/`error` tanpa menggagalkan aksinya. Perhatikan: ini juga password SMTP Supabase Auth bila Custom SMTP sudah disetel — perbarui di KEDUA tempat. |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile | Pendaftaran, reset kata sandi, dan sesi Album Momen ditolak sampai env diperbarui. Site key-nya `NEXT_PUBLIC_*` → bila ikut diganti, **butuh rebuild**. |
| `R2_SECRET_ACCESS_KEY` (saat `STORAGE_DRIVER=r2`) | Cloudflare R2 | Unggah & hapus media gagal; media yang sudah ada tetap tersaji karena disajikan lewat domain sendiri. |

**Yang membuat rotasi di sini berbeda dari kebanyakan proyek:** separuh kredensial
di atas di-inline saat build, dan separuh lagi dipakai bersama oleh beberapa
konsumen. Mengganti nilainya di satu tempat lalu menganggap selesai adalah
kesalahan yang paling mungkin terjadi — dan yang paling senyap.

**Belum ada:** kebijakan rotasi berkala. Kunci pihak ketiga (Pakasir, Resend)
berumur tak terbatas. Latihan rotasi `service_role` 1× layak dijadwalkan sebelum
launch, sejajar latihan restore backup.

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
