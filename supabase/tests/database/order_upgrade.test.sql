-- Test DB (pgTAP) cabang UPGRADE pada public.activate_paid_order dan
-- public.admin_refund_order — AUDIT-2026-10-01 B3, DECISIONS #61.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- KENAPA BERKAS INI ADA: unit test aksi me-MOCK RPC, jadi tak satu pun dari
-- mereka menyentuh SQL-nya — dan yang dijaga di sini adalah hal yang paling
-- mudah salah tanpa terlihat. Cabang upgrade dinilai justru dari apa yang TIDAK
-- diubahnya: `active_until`, `published_at`, dan `status`. Satu baris `set`
-- yang ikut tersalin dari cabang aktivasi akan memberi pelanggan masa aktif
-- penuh seharga selisih harga, dan tak ada satu pun galat yang muncul.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Fixture ---------------------------------------------------------------------
-- Timestamp DITULIS LITERAL supaya "tidak berubah" bisa diuji dengan
-- membandingkannya ke nilai yang sama, bukan ke nilai yang ditangkap lebih dulu.
insert into auth.users (id, email) values
  ('0b300000-0000-4000-8000-00000000000a', 'pgtap-upgrade@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0b300000-0000-4000-8000-0000000000e0', 'pgtap-upgrade-tema', 'pgTAP', '{wedding}');

-- A: aktif di Basic (jalur bahagia) · B: kedaluwarsa · C: sudah Premium
-- D: aktif, aktivasi Basic + upgrade Premium yang SUDAH lunas (untuk refund)
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, package_id, active_until, published_at)
values
  ('0b300000-0000-4000-8000-0000000000a1', '0b300000-0000-4000-8000-00000000000a',
   '0b300000-0000-4000-8000-0000000000e0', 'pgtap-upg-a', 'wedding', 'active',
   (select id from public.packages where code = 'basic'),
   '2027-01-15 00:00:00+00', '2026-09-01 00:00:00+00'),
  ('0b300000-0000-4000-8000-0000000000a2', '0b300000-0000-4000-8000-00000000000a',
   '0b300000-0000-4000-8000-0000000000e0', 'pgtap-upg-b', 'wedding', 'expired',
   (select id from public.packages where code = 'basic'),
   '2026-09-30 00:00:00+00', '2026-09-01 00:00:00+00'),
  ('0b300000-0000-4000-8000-0000000000a3', '0b300000-0000-4000-8000-00000000000a',
   '0b300000-0000-4000-8000-0000000000e0', 'pgtap-upg-c', 'wedding', 'active',
   (select id from public.packages where code = 'premium'),
   '2027-01-15 00:00:00+00', '2026-09-01 00:00:00+00'),
  ('0b300000-0000-4000-8000-0000000000a4', '0b300000-0000-4000-8000-00000000000a',
   '0b300000-0000-4000-8000-0000000000e0', 'pgtap-upg-d', 'wedding', 'active',
   (select id from public.packages where code = 'premium'),
   '2027-01-15 00:00:00+00', '2026-09-01 00:00:00+00');

insert into public.orders
  (user_id, invitation_id, package_id, amount_idr, status, order_code, paid_at, purpose)
values
  -- A: aktivasi Basic lunas + order upgrade ke Premium menunggu bayar.
  ('0b300000-0000-4000-8000-00000000000a', '0b300000-0000-4000-8000-0000000000a1',
   (select id from public.packages where code = 'basic'), 99000, 'paid',
   'MRV-UPGA1', '2026-09-01 00:00:00+00', 'purchase'),
  ('0b300000-0000-4000-8000-00000000000a', '0b300000-0000-4000-8000-0000000000a1',
   (select id from public.packages where code = 'premium'), 100000, 'pending',
   'MRV-UPGU1', null, 'upgrade'),
  -- B: undangan kedaluwarsa saat pembayaran upgrade berjalan.
  ('0b300000-0000-4000-8000-00000000000a', '0b300000-0000-4000-8000-0000000000a2',
   (select id from public.packages where code = 'premium'), 100000, 'pending',
   'MRV-UPGU2', null, 'upgrade'),
  -- C: sudah memegang paket tujuan (mis. terlanjur diperpanjang dengan Premium).
  ('0b300000-0000-4000-8000-00000000000a', '0b300000-0000-4000-8000-0000000000a3',
   (select id from public.packages where code = 'premium'), 100000, 'pending',
   'MRV-UPGU3', null, 'upgrade'),
  -- D: dua-duanya sudah lunas; yang direfund adalah AKTIVASI-nya.
  ('0b300000-0000-4000-8000-00000000000a', '0b300000-0000-4000-8000-0000000000a4',
   (select id from public.packages where code = 'basic'), 99000, 'paid',
   'MRV-UPGA4', '2026-09-01 00:00:00+00', 'purchase'),
  ('0b300000-0000-4000-8000-00000000000a', '0b300000-0000-4000-8000-0000000000a4',
   (select id from public.packages where code = 'premium'), 100000, 'paid',
   'MRV-UPGU4', '2026-09-20 00:00:00+00', 'upgrade');

-- 1. Kolom penanda jenis order -----------------------------------------------
-- Baris lama (seluruh order sebelum B3) harus terbaca 'purchase', bukan NULL:
-- query pemakaian-ulang order memfilter kolom ini, dan NULL tak akan cocok
-- dengan apa pun sehingga setiap order pending lama akan jadi order kedua.
insert into public.orders
  (user_id, invitation_id, package_id, amount_idr, status, order_code)
values
  ('0b300000-0000-4000-8000-00000000000a', '0b300000-0000-4000-8000-0000000000a1',
   (select id from public.packages where code = 'basic'), 99000, 'expired',
   'MRV-UPGDF');
select is(
  (select purpose from public.orders where order_code = 'MRV-UPGDF'),
  'purchase', 'order tanpa purpose eksplisit jatuh ke purchase');

select throws_ok(
  $$insert into public.orders
      (user_id, invitation_id, package_id, amount_idr, status, order_code, purpose)
    values
      ('0b300000-0000-4000-8000-00000000000a', '0b300000-0000-4000-8000-0000000000a1',
       (select id from public.packages where code = 'basic'), 1, 'pending',
       'MRV-UPGBAD', 'renewal')$$,
  '23514', null, 'purpose di luar daftar ditolak check constraint');

-- 2. Upgrade pada undangan AKTIF ---------------------------------------------
select is(
  (select result from public.activate_paid_order(
     'MRV-UPGU1', 100000, 'qris', '2026-10-04 05:00:00+00', '{}'::jsonb)),
  'activated', 'order upgrade lunas → activated');
select is(
  (select p.code from public.invitations i
     join public.packages p on p.id = i.package_id
     where i.id = '0b300000-0000-4000-8000-0000000000a1'),
  'premium', 'paket undangan ditukar ke paket tujuan');
select is(
  (select active_until from public.invitations
     where id = '0b300000-0000-4000-8000-0000000000a1'),
  '2027-01-15 00:00:00+00'::timestamptz,
  'MASA AKTIF TIDAK BERUBAH — inti kesepakatan B3');
select is(
  (select published_at from public.invitations
     where id = '0b300000-0000-4000-8000-0000000000a1'),
  '2026-09-01 00:00:00+00'::timestamptz,
  'published_at tidak disentuh');
select is(
  (select status::text from public.invitations
     where id = '0b300000-0000-4000-8000-0000000000a1'),
  'active', 'status tetap active (bukan dipublikasikan ulang)');
select is(
  (select status::text from public.orders where order_code = 'MRV-UPGU1'),
  'paid', 'order ditandai lunas');
select is(
  (select amount_idr from public.orders where order_code = 'MRV-UPGU1'),
  100000, 'nominal yang tercatat adalah SELISIH, bukan harga penuh');

-- 3. Idempotensi (webhook Pakasir duplikat) -----------------------------------
select is(
  (select result from public.activate_paid_order(
     'MRV-UPGU1', 100000, 'qris', '2026-10-04 05:00:00+00', '{}'::jsonb)),
  'already_paid', 'notifikasi duplikat tak diproses ulang');
select is(
  (select active_until from public.invitations
     where id = '0b300000-0000-4000-8000-0000000000a1'),
  '2027-01-15 00:00:00+00'::timestamptz,
  'masa aktif tetap utuh setelah notifikasi duplikat');

-- 4. Undangan TIDAK lagi aktif → held ----------------------------------------
-- Premium pada undangan kedaluwarsa tak bernilai: uang ditahan sebagai `paid`
-- dan menunggu manusia (refund / perpanjangan manual), bukan ditukar diam-diam.
select is(
  (select result from public.activate_paid_order(
     'MRV-UPGU2', 100000, 'qris', '2026-10-04 05:00:00+00', '{}'::jsonb)),
  'held', 'undangan kedaluwarsa → held');
select is(
  (select p.code from public.invitations i
     join public.packages p on p.id = i.package_id
     where i.id = '0b300000-0000-4000-8000-0000000000a2'),
  'basic', 'paket undangan kedaluwarsa tidak ditukar');
select is(
  (select status::text from public.orders where order_code = 'MRV-UPGU2'),
  'paid', 'pembayarannya TETAP tercatat — uang tak boleh hilang tanpa jejak');

-- 5. Sudah memegang paket tujuan → held --------------------------------------
-- Tanpa penahan ini, pelanggan yang kedaluwarsa lalu memperpanjang dengan
-- Premium sementara order upgrade-nya menggantung akan membayar selisih untuk
-- sesuatu yang sudah dimilikinya, dan RPC-nya melaporkan sukses.
select is(
  (select result from public.activate_paid_order(
     'MRV-UPGU3', 100000, 'qris', '2026-10-04 05:00:00+00', '{}'::jsonb)),
  'held', 'paket sudah sama dengan paket tujuan → held');

-- 6. Refund order UPGRADE → paket turun, masa aktif UTUH ----------------------
select is(
  (select result from public.admin_refund_order(
     'MRV-UPGU1', '0b300000-0000-4000-8000-00000000000a', 'uji')),
  'refunded_downgraded', 'refund upgrade menurunkan paket');
select is(
  (select p.code from public.invitations i
     join public.packages p on p.id = i.package_id
     where i.id = '0b300000-0000-4000-8000-0000000000a1'),
  'basic', 'paket kembali ke paket order lunas sebelumnya');
select is(
  (select status::text from public.invitations
     where id = '0b300000-0000-4000-8000-0000000000a1'),
  'active', 'undangan TIDAK dicabut: masa aktifnya dibayar order lain');
select is(
  (select active_until from public.invitations
     where id = '0b300000-0000-4000-8000-0000000000a1'),
  '2027-01-15 00:00:00+00'::timestamptz,
  'refund upgrade tak memotong masa aktif');

-- 7. Refund AKTIVASI saat ada upgrade lunas → tetap dicabut -------------------
-- Order upgrade tak pernah membeli masa aktif, jadi keberadaannya tak boleh
-- membuat undangan tampak masih tertopang ketika aktivasi SATU-SATUNYA yang
-- membayar periodenya justru yang dikembalikan uangnya.
select is(
  (select result from public.admin_refund_order(
     'MRV-UPGA4', '0b300000-0000-4000-8000-00000000000a', 'uji')),
  'refunded_revoked', 'order upgrade lunas tak menahan pencabutan');
select is(
  (select status::text from public.invitations
     where id = '0b300000-0000-4000-8000-0000000000a4'),
  'expired', 'undangan dicabut karena aktivasinya direfund');

select * from finish();
rollback;
