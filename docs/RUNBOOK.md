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
