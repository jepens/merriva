# AUTH-SETUP — Konfigurasi Supabase Auth untuk Merriva

Kode auth (M1.1) mengikuti alur `@supabase/ssr`. Agar verifikasi email, Google OAuth,
dan reset kata sandi berfungsi, pemilik perlu menyetel beberapa hal di **Supabase
Dashboard → Authentication**. Kode aplikasi sudah siap; ini murni konfigurasi.

> Referensi keputusan: `DECISIONS.md` #15. Env terkait: `NEXT_PUBLIC_APP_URL`.

## 1. URL Configuration (Authentication → URL Configuration)

- **Site URL:** `https://merriva.id` (untuk lokal: `http://localhost:3000`).
- **Redirect URLs (allow list)** — tambahkan keduanya (dan varian localhost saat dev):
  - `https://merriva.id/auth/callback`
  - `https://merriva.id/auth/confirm`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`

Route aplikasi:

| Route | Fungsi |
|---|---|
| `/auth/confirm` | Verifikasi email **dan** recovery kata sandi (`verifyOtp` via `token_hash`) |
| `/auth/callback` | Callback OAuth Google & magic link (`exchangeCodeForSession`, PKCE) |

Parameter `next` pada kedua route disanitasi (`safeNextPath`) — hanya menerima path
relatif internal, mencegah open-redirect.

## 2. Template Email (Authentication → Email Templates)

Alur SSR menaruh sesi di server, jadi tautan email harus mengarah ke `/auth/confirm`
memakai `{{ .TokenHash }}` (bukan `{{ .ConfirmationURL }}` bawaan).

**Confirm signup** — ganti tautan menjadi:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
  Aktifkan akun
</a>
```

**Reset password (Recovery)** — arahkan ke halaman ganti kata sandi:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password/ubah">
  Atur ulang kata sandi
</a>
```

> Catatan: `type` harus `signup` untuk konfirmasi akun dan `recovery` untuk reset.

## 3. Provider Google (Authentication → Providers → Google)

Bila memakai "Lanjutkan dengan Google":

1. Buat OAuth Client ID di Google Cloud Console (tipe **Web application**).
2. **Authorized redirect URI** = `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
   (URL callback Supabase, bukan domain aplikasi).
3. Isi **Client ID** & **Client Secret** di Supabase → aktifkan provider Google.

Aplikasi memulai OAuth di server (`signInWithOAuth`, `skipBrowserRedirect`) lalu
menukar `code` di `/auth/callback`.

## 4. Email confirmations (Authentication → Providers → Email)

- Aktifkan **Confirm email** agar verifikasi email berjalan (SPEC §4.2).
- **Custom SMTP → Resend WAJIB di produksi** (Auth → Emails → SMTP Settings):
  host `smtp.resend.com`, port `465`, username `resend`, password =
  `RESEND_API_KEY`, sender = `EMAIL_FROM` (domain terverifikasi SPF/DKIM).

  Alasannya sering disalahpahami sebagai "kuota kecil". Bukan itu: SMTP bawaan
  Supabase **menolak mengirim ke alamat yang bukan anggota tim project**
  ("Supabase Auth will refuse to deliver messages to addresses that are not part
  of the project's team"). Untuk produk self-service artinya deliverability ke
  pelanggan **0%** — dan karena `Confirm email` aktif, pendaftar tak akan pernah
  bisa masuk. Plafon 2 email/jam hanya gejala tambahan.

  Kegagalannya tidak terlihat oleh pengguna maupun tim tanpa Sentry:
  `requestPasswordResetAction` sengaja selalu menjawab sukses generik demi
  anti-enumerasi, jadi layar berbunyi "tautan sudah dikirim" walau tak ada yang
  terkirim. Sejak AUDIT-2026-10-01 kegagalan ini dilaporkan sebagai handled
  error dengan tag `area: auth.signup` / `auth.reset` / `auth.update-password` /
  `auth.oauth` — **tanpa email/nama**, hanya `code` + `status`. Jejak itu baru
  muncul bila `NEXT_PUBLIC_SENTRY_DSN` terisi.

  Reset kata sandi tetap melewati GoTrue walau `Confirm email` dimatikan, jadi
  Custom SMTP tidak bisa dihindari dengan mematikan verifikasi.

## 5. Kebijakan kata sandi (Authentication → Policies)

> Setelan dashboard **tidak ter-versioning di repo**. Bagian ini adalah satu-satunya
> jejaknya — perbarui di sini bila diubah di sana (AUDIT-2026-10-01 B5).

| Setelan | Nilai | Kenapa |
|---|---|---|
| Minimum password length | **8** | Disamakan dengan `passwordField` (`src/lib/validation/auth.ts`) dan `supabase/config.toml`. Bila dashboard lebih longgar, aturan aplikasi hanya berlaku selama setiap penulisan kata sandi melewati form Merriva — padahal jalur reset Supabase tidak. |
| Leaked Password Protection | **aktif** | Cek HIBP (k-anonymity) menolak kata sandi yang sudah bocor. Tanpa ini, `password`, `12345678`, dan `qwerty123` lolos hanya karena panjangnya cukup. |
| Password requirements (komposisi) | **biarkan kosong** | Syarat "harus ada simbol & angka" terbukti mendorong pola `Password1!` yang justru mudah ditebak. Panjang + cek kebocoran lebih efektif, dan NIST SP 800-63B sejak 2017 menyarankan meninggalkan aturan komposisi. |

**Yang ditegakkan di kode, bukan di dashboard** (`src/lib/validation/auth.ts`, dijaga
`tests/unit/validation/auth.test.ts`) — keduanya TIDAK bisa dilakukan HIBP:

- kata sandi tak boleh memuat `merriva` atau `undangan`: kombinasi seperti
  `merriva2026` boleh jadi tak pernah bocor ke mana pun, tetapi tetap tebakan pertama
  penyerang akun di domain ini;
- saat **mendaftar**, kata sandi tak boleh memuat bagian lokal alamat emailnya sendiri.
  Hanya di jalur daftar: form reset & ganti kata sandi tak memegang alamat email —
  keterbatasan yang diterima sadar, bukan yang terlupa.

Ganti kata sandi dari dalam akun memverifikasi kata sandi lama lewat `signInWithPassword`
pada klien anon terpisah — `updateUser({ current_password })` DIABAIKAN diam-diam oleh
GoTrue kecuali flag project-nya aktif (DECISIONS #53).

## 6. Uji cepat

1. Daftar di `/daftar` → cek email → klik tautan → mendarat login di `/dashboard`.
2. `/masuk` dengan Google → kembali ke `/dashboard`.
3. `/reset-password` → email → `/reset-password/ubah` → set kata sandi baru.
