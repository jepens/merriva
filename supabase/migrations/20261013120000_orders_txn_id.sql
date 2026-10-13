-- =============================================================================
-- `orders.txn_id` — rujukan transaksi Pakasir API v2
-- (AUDIT-2026-10-13, DECISIONS #72)
--
-- API v1 dihentikan 20 Oktober 2026. Di v1, memeriksa status dan membatalkan
-- transaksi memakai `order_id` yang sudah kita punya, jadi tak ada yang perlu
-- disimpan. Di v2 keduanya berkunci `txn_id` — diverifikasi langsung ke API:
-- `GET /api/v2/transaction-status/{slug}/{order_id}` dijawab 404, sedangkan
-- `{slug}/{txn_id}` dijawab 200. Tanpa kolom ini, order yang SUDAH DIBAYAR tak
-- bisa diverifikasi, dan tanpa verifikasi tak ada aktivasi.
--
-- NULLABLE, dan itu bukan kelonggaran: baris `orders` di-INSERT lebih dulu, lalu
-- transaksi Pakasir dibuat. Ada jendela sah di mana order ada tanpa `txn_id`
-- (mis. panggilan create gagal). Yang menutup jendela itu bukan constraint
-- melainkan sifat `find-or-create` Pakasir: memanggil create lagi untuk
-- `order_id` yang sama mengembalikan `txn_id` yang SAMA, jadi percobaan ulang
-- checkout mengisinya tanpa menggandakan transaksi.
--
-- Produksi punya 0 baris `orders` saat migrasi ini dibuat → tak ada backfill.
-- =============================================================================

alter table public.orders
  add column if not exists txn_id text;

comment on column public.orders.txn_id is
  'Rujukan transaksi gateway (Pakasir API v2 menyebutnya txn_id). Kunci untuk '
  'transaction-status & cancel-transaction v2. NULL = transaksi belum dibuat; '
  'dapat dipulihkan dengan memanggil create-transaction (find-or-create).';

-- UNIQUE PARTIAL, bukan index biasa. Dua baris `orders` yang berbagi satu
-- transaksi Pakasir adalah keadaan yang harus GAGAL KERAS, bukan dibiarkan:
-- `find-or-create` berkunci `order_id` saja dan mengembalikan transaksi LAMA
-- bila `order_id` pernah dipakai dengan nominal berbeda — tanpa constraint ini,
-- dua order bisa diam-diam menunjuk satu pembayaran, dan yang kedua "lunas"
-- tanpa uang kedua. `where txn_id is not null` menjaga agar order yang belum
-- punya transaksi tak saling bentrok di NULL.
create unique index if not exists orders_txn_id_key
  on public.orders (txn_id)
  where txn_id is not null;

-- TENTANG PRIVILEGE KOLOM — diperiksa, lalu SENGAJA tidak dilakukan.
--
-- Percobaan pertama migrasi ini memuat `revoke all (txn_id) on table
-- public.orders from anon, authenticated`. Diuji terhadap skema cloud: baris itu
-- TIDAK BEREFEK APA PUN, dan meninggalkannya berarti memasang keamanan palsu.
-- Sebabnya `orders` memakai grant TABEL-level (ALL untuk anon/authenticated/
-- service_role — default Supabase), dan Postgres tidak bisa mencabut sebagian
-- kolom dari grant yang diberikan setingkat tabel. Setelah revoke itu dijalankan,
-- `information_schema.column_privileges` masih mencatat 8 hak untuk kedua role.
--
-- Yang BENAR-BENAR menggerbangi kolom ini sama dengan yang menggerbangi seluruh
-- kolom `orders` lain: policy RLS `orders_select` (`user_id = auth.uid() or
-- is_admin()`). Artinya pemilik order bisa membaca `txn_id` ORDER-NYA SENDIRI —
-- dan itu memang tak berbahaya: ia rujukan pembayarannya sendiri, bukan rahasia
-- lintas-pengguna. `anon` tak punya policy select sama sekali.
--
-- Membangun model privilege per-kolom hanya untuk satu kolom akan membuat tabel
-- ini menyimpang dari seluruh tabel lain di skema ini, tanpa menambah jaminan
-- apa pun di atas RLS.
