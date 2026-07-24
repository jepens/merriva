# DATA-MODEL — Merriva

**Versi:** 1.0 — 24 Juli 2026 · PostgreSQL (Supabase). Migrasi di `supabase/migrations/`, seed di `supabase/seed.sql`.

Prinsip: konten undangan yang fleksibel per kategori disimpan sebagai JSONB tervalidasi Zod (`invitations.content`); hal yang di-query/di-agregasi (tamu, RSVP, order, jadwal) disimpan ternormalisasi. `guests.token` dan `invitation_events` sengaja ternormalisasi sejak Fase 1 karena menjadi fondasi QR check-in Fase 2.

---

## 1. Tabel

**profiles** — 1:1 dengan `auth.users`. `id uuid PK (=auth.users.id)`, `full_name`, `phone` (WA, format E.164), `role` `'client'|'admin'` default `'client'` (di-set admin manual via SQL — tidak ada UI), `created_at`.

**themes** — katalog tema (metadata; kode tema di repo). `id`, `slug unique` (= folder `src/themes/`), `name`, `categories text[]` (`wedding|corporate|family`), `tier` `'standard'|'premium'`, `preview_image`, `demo_slug` (undangan demo), `is_active`, `sort_order`.

**packages** — paket harga (DB-driven agar bisa diubah tanpa deploy). `id`, `code unique` (`basic|premium`), `name`, `price_idr int`, `duration_months int`, `limits jsonb` `{max_photos, max_guests, youtube, all_themes, watermark}`, `is_active`.

**invitations** — inti. `id`, `user_id → profiles`, `theme_id → themes`, `package_id → packages null` (terisi saat order paid), `slug unique` (lowercase, regex `[a-z0-9-]{3,60}`, blocklist kata terlarang, ganti maks 1× setelah aktif), `category` `'wedding'|'corporate'|'family'`, `status` `'draft'|'pending_payment'|'active'|'expired'|'suspended'`, `content jsonb` (data form — skema Zod per kategori), `settings jsonb` (tema varian warna, toggle section, moderasi ucapan on/off), `event_date date` (acara utama, untuk sorting/retensi), `active_until timestamptz null`, `published_at`, `created_at`, `updated_at`.

**invitation_events** — jadwal per undangan (akad/resepsi/sesi). `id`, `invitation_id FK cascade`, `name`, `start_at timestamptz`, `end_at timestamptz null`, `venue_name`, `address`, `maps_url`, `sort_order`. *(Fase 2: FK target check-in per sesi.)*

**media** — file per undangan. `id`, `invitation_id FK cascade`, `type` `'photo'` (Fase 1), `storage_path` (relatif, immutable hash — **tanpa URL vendor**), `width`, `height`, `sort_order`. Limit `max_photos` ditegakkan di server action, bukan UI.

**guests** — daftar tamu. `id`, `invitation_id FK cascade`, `name`, `phone null`, `group_label null`, `pax_allocated int default 2`, `token unique` (nanoid ≥ 10 char — identitas tamu & calon QR Fase 2), `wa_clicked_at null` (tombol WA diklik), `first_viewed_at null` (link dibuka pertama kali), `notes`, `created_at`. Limit `max_guests` ditegakkan server-side.

**rsvps** — konfirmasi + ucapan (satu form gabungan). `id`, `invitation_id FK cascade`, `guest_id FK null` (null = tamu tanpa token), `guest_name`, `attendance` `'yes'|'no'`, `pax int` (≤ `pax_allocated`; tanpa token maks 2), `message text null` (tampil di dinding ucapan bila tidak kosong), `is_hidden bool default false` (disembunyikan pemilik), `is_approved bool default true` (false bila moderasi aktif), `created_at`, `updated_at`. **Unique `(invitation_id, guest_id)` where `guest_id is not null`** → kiriman ulang tamu bertoken = UPDATE, bukan duplikat.

**gift_notes** — konfirmasi amplop/kado, **privat untuk pemilik**. `id`, `invitation_id FK cascade`, `guest_name`, `type` `'transfer'|'gift'`, `amount int null`, `note`, `created_at`.

**orders** — pembayaran. `id`, `user_id`, `invitation_id`, `package_id`, `amount_idr int`, `status` `'pending'|'paid'|'expired'|'failed'|'refunded'`, `order_code unique` (mis. `MRV-8F3K2` — dikirim sebagai `order_id` ke Pakasir), `payment_method null`, `paid_at null`, `raw_notification jsonb null` (payload webhook untuk rekonsiliasi), `created_at`.

**songs** — library musik royalty-free. `id`, `title`, `artist`, `storage_path`, `is_active`.

**admin_logs** — audit aksi admin. `id`, `admin_id`, `action`, `target_type`, `target_id`, `detail jsonb`, `created_at`.

## 2. Transisi status

`invitations`: `draft` →(checkout dibuat)→ `pending_payment` →(order paid)→ `active` →(cron lewat `active_until`)→ `expired` →(bayar perpanjangan)→ `active`. `suspended` hanya oleh admin (konten bermasalah), bisa kembali ke status sebelumnya. Catatan: `draft` → langsung `active` juga sah lewat aktivasi manual admin (klien jasa EO). `orders`: `pending` → `paid` | `expired` (cron 24 jam + cancel ke Pakasir) | `failed`; `refunded` hanya manual admin.

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

Data yang boleh tampil di halaman undangan publik (di-serve server-side): `content`, `settings`, `events`, `media`, `rsvps` yang `is_approved && !is_hidden` (nama + pesan saja), nama tamu dari token. **Tidak pernah:** `guests` selain nama pemilik token itu sendiri, `gift_notes`, `orders`, kontak.

## 4. Index penting

`invitations(slug)` unique · `invitations(user_id, status)` · `guests(token)` unique · `guests(invitation_id)` · `rsvps(invitation_id, created_at desc)` · unique partial `rsvps(invitation_id, guest_id)` · `orders(order_code)` unique · `orders(status, created_at)` untuk cron · `invitation_events(invitation_id, sort_order)`.

## 5. Lifecycle & retensi data (UU PDP 27/2022)

Undangan `expired` + datanya (tamu, RSVP, media, gift_notes) dipertahankan **6 bulan** setelah `active_until` (grace period perpanjangan), lalu cron menghapus permanen media + data tamu (baris `invitations` boleh tinggal sebagai kerangka statistik tanpa data pribadi). Klien dapat meminta penghapusan lebih cepat (aksi "hapus undangan" pada undangan non-aktif). Email pengingat sebelum penghapusan. `raw_notification` orders disimpan ≥ 2 tahun untuk rekonsiliasi keuangan.

## 6. Seed minimal

`packages`: basic & premium (harga PRD §7) · `themes`: ≥1 tema pertama + demo · `songs`: ±20 lagu royalty-free (path diisi setelah file diunggah) · 1 akun admin (set `role='admin'` via SQL setelah register).
