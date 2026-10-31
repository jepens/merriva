# DATA-MODEL — Merriva

**Versi:** 1.0 — 24 Juli 2026 · PostgreSQL (Supabase). Migrasi di `supabase/migrations/`, seed di `supabase/seed.sql`.

Prinsip: konten undangan yang fleksibel per kategori disimpan sebagai JSONB tervalidasi Zod (`invitations.content`); hal yang di-query/di-agregasi (tamu, RSVP, order, jadwal) disimpan ternormalisasi. `guests.token` dan `invitation_events` sengaja ternormalisasi sejak Fase 1 karena menjadi fondasi QR check-in Fase 2.

---

## 1. Tabel

**profiles** — 1:1 dengan `auth.users`. `id uuid PK (=auth.users.id)`, `full_name`, `phone` (WA, format E.164), `role` `'client'|'pro'|'admin'` default `'client'` (diubah admin dari `/admin/pengguna`; kolom tak bisa ditulis klien; `pro` & `admin` tak pernah ditagih — DECISIONS #100), `created_at`.

**themes** — katalog tema (metadata; kode tema di repo). `id`, `slug unique` (= folder `src/themes/`), `name`, `categories text[]` (`wedding|corporate|family`), `tier` `'standard'|'premium'`, `preview_image`, `demo_slug` (undangan demo), `is_active`, `sort_order`.

**packages** — paket harga (DB-driven agar bisa diubah tanpa deploy). `id`, `code unique` (`basic|premium`), `name`, `price_idr int`, `duration_months int`, `limits jsonb` `{max_photos, max_guests, youtube, all_themes, watermark}`, `is_active`.

**invitations** — inti. `id`, `user_id → profiles`, `theme_id → themes`, `package_id → packages null` (terisi saat order paid), `slug unique` (lowercase, regex `[a-z0-9-]{3,60}`, blocklist kata terlarang, ganti maks 1× setelah aktif), `category` `'wedding'|'corporate'|'family'`, `status` `'draft'|'pending_payment'|'active'|'expired'|'suspended'`, `content jsonb` (data form — skema Zod per kategori), `settings jsonb` (tema varian warna, toggle section, moderasi ucapan on/off), `event_date date` (acara utama, untuk sorting/retensi), `active_until timestamptz null`, `published_at`, `purged_at timestamptz null` (waktu data pribadi dihapus permanen — retensi §5; NULL = belum), `created_at`, `updated_at`.

**invitation_events** — jadwal per undangan (akad/resepsi/sesi). `id`, `invitation_id FK cascade`, `name`, `start_at timestamptz null` (NULL = sesi draft yang jam mulainya belum diisi: tersimpan agar isian tak hilang, TIDAK PERNAH tampil di halaman publik/pratinjau/.ics/OG — DECISIONS #42), `end_at timestamptz null`, `venue_name`, `address`, `maps_url`, `sort_order`. **`id` stabil lintas simpan** (DECISIONS #43): editor membuat id untuk kartu baru, dan RPC `replace_invitation_events` meng-upsert per id (sesi yang tak dikirim lagi dihapus). Tautan kalender `?e={id}` dan UID `.ics` tak berganti saat pemilik menyunting. *(Fase 2: FK target check-in per sesi — hanya sesi `start_at is not null`.)*

**media** — file per undangan. `id`, `invitation_id FK cascade`, `type` `'photo'` (Fase 1), `storage_path` (relatif, immutable hash — **tanpa URL vendor**), `width`, `height`, `sort_order`. Limit `max_photos` ditegakkan di server action, bukan UI.

**guests** — daftar tamu. `id`, `invitation_id FK cascade`, `name`, `phone null`, `group_label null`, `pax_allocated int default 2`, `token unique` (nanoid ≥ 10 char — identitas tamu & calon QR Fase 2), `wa_clicked_at null` (tombol WA diklik), `first_viewed_at null` (link dibuka pertama kali), `notes`, `created_at`. Limit `max_guests` ditegakkan server-side.

**rsvps** — konfirmasi + ucapan (satu form gabungan). `id`, `invitation_id FK cascade`, `guest_id FK null` (null = tamu tanpa token), `guest_name`, `attendance` `'yes'|'no'`, `pax int` (≤ `pax_allocated`; tanpa token maks 2), `message text null` (tampil di dinding ucapan bila tidak kosong), `is_hidden bool default false` (disembunyikan pemilik), `is_approved bool default true` (false bila moderasi aktif), `created_at`, `updated_at`. **Unique `(invitation_id, guest_id)` where `guest_id is not null`** → kiriman ulang tamu bertoken = UPDATE, bukan duplikat.

**gift_notes** — konfirmasi amplop/kado, **privat untuk pemilik**. `id`, `invitation_id FK cascade`, `guest_name`, `type` `'transfer'|'gift'`, `amount int null`, `note`, `created_at`.

**orders** — pembayaran. `id`, `user_id`, `invitation_id`, `package_id`, `amount_idr int` (harga yang dibayar pelanggan; dengan BinderPay saldo yang masuk = pokok, yaitu harga − fee — DECISIONS #102), `status` `'pending'|'paid'|'expired'|'failed'|'refunded'`, `order_code unique` (mis. `MRV-8F3K2` — nomor order kita di gateway: `order_id` Pakasir, `partnerReferenceNo` BinderPay), `txn_id text null` (rujukan transaksi gateway, kunci cek status & pembatalan — Pakasir: `txn_id` Pakasir; BinderPay: `contractId`, berbeda per transaksi, dikirim berpasangan dengan `order_code`. **Unique partial** `where txn_id is not null`. NULL = tak ada transaksi gateway: order gratis/manual, atau penerbitan link gagal — order `pending` begitu tak dipakai ulang dan ditutup cron, DECISIONS #101), `qr_content text null` (string QRIS — hanya BinderPay, NULL untuk Pakasir; ditulis bersama `txn_id` dalam SATU update dan satu-satunya salinan, karena QR tak bisa diterbitkan ulang untuk nomor order yang sama — DECISIONS #102), `payment_method null`, `paid_at null`, `raw_notification jsonb null` (untuk rekonsiliasi: Pakasir → payload webhook; BinderPay → daftar putih field callback, `buyerRef` (nama pembayar) dibuang; aktivasi lewat poller/cron → `{source:'status_poll', transaction}` hasil verifikasi, nominalnya harga — bukan pokok BinderPay), `created_at`.

**songs** — library musik royalty-free. `id`, `title`, `artist`, `storage_path`, `is_active`.

**admin_logs** — audit aksi admin. `id`, `admin_id`, `action`, `target_type`, `target_id`, `detail jsonb`, `created_at`.

**momen_albums** — Album Momen per undangan (add-on FASE H). `id`, `invitation_id FK cascade **unique**` (satu album per undangan), `status` `'active'|'archived'`, `quota_peserta int null` (**unit yang dijual**; null = ∞), `photo_ceiling int null` (rem biaya storage tier ∞; tak diiklankan), `quota_per_guest int default 5` (1..20), `reveal_at timestamptz null` (**null = langsung tampil**), `default_filter`, `allow_library_upload bool default false` (false = hanya jepretan kamera), `photo_count int default 0` (counter dirawat RPC, race-safe), `created_at`.

**momen_photos** — foto tamu. **PRIVAT sampai `reveal_at`.** `id`, `album_id FK cascade`, `guest_name`, `device_id uuid` (identitas peserta dari localStorage → dasar kuota peserta & jatah), `filter_id`, `storage_path`/`thumb_path` (constraint regex `momen/<album>/<photo>/(display|thumb).(webp|jpg)`), `width`, `height`, `bytes`, `status` `'visible'|'hidden'` (hidden = dimoderasi host), `created_at`.

`packages` memperoleh `kind` `'invitation'|'addon_momen'` — add-on adalah baris `packages` biasa, sehingga `orders.package_id` tak berubah bentuk dan jalur uang memakai-ulang alur order/gateway/webhook yang sudah ada.

## 2. Transisi status

`invitations`: `draft` →(checkout dibuat)→ `pending_payment` →(order paid)→ `active` →(cron lewat `active_until`)→ `expired` →(bayar perpanjangan)→ `active`. `suspended` hanya oleh admin (konten bermasalah), bisa kembali ke status sebelumnya — `admin_reinstate_invitation` memulihkannya **dari `active_until`**, jadi undangan yang masa aktifnya sudah lewat kembali sebagai `expired`, bukan `active`. Kedua transisi mengirim email ke pemilik; alasan yang dikirim berasal dari `p_public_reason` (kolom terpisah dari catatan internal `p_reason` yang hanya masuk `admin_logs` — DECISIONS #68). Catatan: `draft` → langsung `active` juga sah lewat aktivasi manual admin (klien jasa EO). `orders`: `pending` → `paid` | `expired` (cron 24 jam + pembatalan ke gateway) | `failed`; `refunded` hanya manual admin.

## 3. RLS matrix (semua tabel: RLS ON)

| Tabel | anon (publik) | client (authenticated) | admin | service role (server) |
|---|---|---|---|---|
| profiles | — | SELECT/UPDATE baris sendiri | ALL | ALL |
| themes, packages, songs | SELECT `is_active=true` | idem | ALL | ALL |
| invitations | — (halaman publik dilayani server dengan filter eksplisit) | CRUD miliknya (`user_id = auth.uid()`); DELETE hanya saat `draft` | ALL | ALL |
| invitation_events, media | — | CRUD via kepemilikan undangan induk | ALL | ALL |
| guests | — | CRUD via kepemilikan undangan | ALL | ALL |
| rsvps | — (INSERT hanya lewat server action + Turnstile + rate limit) | SELECT/UPDATE(`is_hidden`) via kepemilikan | ALL | ALL |
| gift_notes | — | SELECT via kepemilikan | ALL | ALL |
| orders | — | SELECT miliknya | ALL | ALL |
| admin_logs | — | — | SELECT; INSERT via server | ALL |
| momen_albums, momen_photos | **— (tanpa policy sama sekali: fail-closed)** | SELECT via kepemilikan undangan induk | ALL | ALL |

Data yang boleh tampil di halaman undangan publik (di-serve server-side): `content`, `settings`, `events`, `media`, `rsvps` yang `is_approved && !is_hidden` (nama + pesan saja), nama tamu dari token. **Tidak pernah:** `guests` selain nama pemilik token itu sendiri, `gift_notes`, `orders`, kontak. Foto Album Momen adalah pengecualian paling ketat: tamu anon TIDAK punya policy apa pun, dan seluruh baca/tulis-nya lewat server action service_role yang memverifikasi sesi cookie HMAC + fase reveal lebih dulu — foto tak pernah terpancar sebelum `reveal_at`, termasuk pada jalur "muat lebih" yang memeriksa ulang fase secara mandiri (DECISIONS #32).

## 4. Index penting

`invitations(slug)` unique · `invitations(user_id, status)` · `guests(token)` unique · `guests(invitation_id)` · `rsvps(invitation_id, created_at desc)` · unique partial `rsvps(invitation_id, guest_id)` · `orders(order_code)` unique · unique partial `orders(txn_id)` where `txn_id is not null` · `orders(status, created_at)` untuk cron · `invitation_events(invitation_id, sort_order)` · `momen_photos(album_id, created_at)` (paginasi keyset galeri) · `momen_photos(album_id, device_id)` (jatah per perangkat & hitung peserta).

## 5. Lifecycle & retensi data (UU PDP 27/2022)

Undangan `expired` + datanya (tamu, RSVP, media, gift_notes) dipertahankan **6 bulan** setelah `active_until` (grace period perpanjangan), lalu cron menghapus permanen media + data tamu (baris `invitations` boleh tinggal sebagai kerangka statistik tanpa data pribadi). Klien dapat meminta penghapusan lebih cepat (aksi "hapus undangan" pada undangan non-aktif). **Email pengingat sebelum penghapusan: H-30 dan H-7** (cron `purge-expired`, fase peringatan; penanda `purge_warned_at` / `purge_final_warned_at` ditulis hanya saat email benar-benar terkirim). Purge **menolak menghapus tanpa penanda itu**, dengan satu pengecualian yang dihitung terpisah: lewat 21 hari dari jatuh tempo, purge jalan meski peringatannya tak pernah terkirim — pipeline email yang rusak tak boleh menahan kewajiban retensi, karena menyimpan data melewati batas adalah pelanggaran yang berlawanan arah (DECISIONS #67). Undangan `suspended` **ikut** dalam retensi yang sama. `raw_notification` orders disimpan ≥ 2 tahun untuk rekonsiliasi keuangan.

**Implementasi (DECISIONS #21):** RPC `purge_invitation_data(uuid)` (service_role) menghapus data pribadi anak + scrub `content` + set `purged_at`; `orders` dipertahankan. Cron `/api/cron/purge-expired` (harian) memprosesnya untuk `expired` yang `active_until` lewat 6 bulan (`purged_at is null`). Aksi self-service `deleteInvitationAction`: `draft` = hard-delete penuh (cascade); `expired` = purge via RPC yang sama. Baris ber-`purged_at` disaring dari daftar dashboard pemilik. **Album Momen ikut retensi undangan induknya**, bukan `duration_months` paket add-on: `purge_invitation_data` menghapus baris `momen_albums` (cascade ke `momen_photos`) dan mengembalikan `momen_paths` — path objek PENUH yang dihapus pemanggil dari storage. Kolom terpisah dari `media_paths` karena jalur galeri meng-*expand* prefix menjadi `1600.webp`/`400.webp`, sedangkan foto momen bernama `display`/`thumb`.

## 6. Seed minimal

`packages`: basic & premium (harga PRD §7) · `themes`: ≥1 tema pertama + demo · `songs`: ±20 lagu royalty-free (path diisi setelah file diunggah) · 1 akun admin (set `role='admin'` via SQL setelah register).
