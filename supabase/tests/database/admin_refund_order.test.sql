-- Test DB (pgTAP) RPC public.admin_refund_order — DECISIONS #52.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Unit test aksi me-MOCK RPC ini, jadi tak satu pun dari mereka menyentuh SQL-nya.
-- Berkas inilah penjaga regresinya — dan ia lahir karena pengujian langsung
-- menemukan bug yang lolos review, typecheck, DAN seluruh unit test: parameter
-- OUT bernama `invitation_id` menaungi kolom `momen_albums.invitation_id`
-- sehingga setiap refund add-on gagal "ambiguous".
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('c0000000-0000-4000-8000-00000000000a', 'pgtap-refund@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('c0000000-0000-4000-8000-0000000000e0', 'pgtap-refund-tema', 'pgTAP', '{wedding}');

-- A: satu order lunas · B: dua order lunas · C: add-on Album Momen
insert into public.invitations (id, user_id, theme_id, slug, category, status, active_until) values
  ('c0000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000e0', 'pgtap-ref-a', 'wedding', 'active', now() + interval '30 days'),
  ('c0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000e0', 'pgtap-ref-b', 'wedding', 'active', now() + interval '30 days'),
  ('c0000000-0000-4000-8000-0000000000c1', 'c0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000e0', 'pgtap-ref-c', 'wedding', 'active', now() + interval '30 days');

insert into public.orders (user_id, invitation_id, package_id, amount_idr, status, order_code, paid_at)
values
  ('c0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000a1',
   (select id from public.packages where kind = 'invitation' and is_active limit 1),
   99000, 'paid', 'MRV-PGTAPA', now()),
  ('c0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000b1',
   (select id from public.packages where kind = 'invitation' and is_active limit 1),
   99000, 'paid', 'MRV-PGTPB1', now()),
  ('c0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000b1',
   (select id from public.packages where kind = 'invitation' and is_active limit 1),
   99000, 'paid', 'MRV-PGTPB2', now()),
  ('c0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-0000000000c1',
   (select id from public.packages where kind = 'addon_momen' limit 1),
   199000, 'paid', 'MRV-PGTAPC', now());

insert into public.momen_albums (invitation_id, status, quota_peserta)
  values ('c0000000-0000-4000-8000-0000000000c1', 'active', 50);

-- 1. Satu order lunas → undangan DICABUT ---------------------------------------
select is(
  (select result from public.admin_refund_order('MRV-PGTAPA', 'c0000000-0000-4000-8000-00000000000a', 'uji')),
  'refunded_revoked', 'satu-satunya order lunas → undangan dicabut');
select is(
  (select status::text from public.orders where order_code = 'MRV-PGTAPA'),
  'refunded', 'status order menjadi refunded');
select is(
  (select status::text from public.invitations where id = 'c0000000-0000-4000-8000-0000000000a1'),
  'expired', 'undangan menjadi expired');
select is(
  (select count(*)::int from public.admin_logs where action = 'order.refund'),
  1, 'jejak audit ditulis dalam transaksi yang sama');

-- 2. Idempotensi: refund ulang ditolak, TANPA jejak audit kedua ----------------
select is(
  (select result from public.admin_refund_order('MRV-PGTAPA', 'c0000000-0000-4000-8000-00000000000a', 'uji')),
  'not_paid:refunded', 'refund ulang ditolak dengan status sebelumnya');
select is(
  (select count(*)::int from public.admin_logs where action = 'order.refund'),
  1, 'penolakan tak menambah jejak audit');

-- 3. Masih ada order lunas lain → undangan TIDAK dicabut -----------------------
-- Pelanggan yang membayar aktivasi lalu memperpanjang, dan hanya salah satunya
-- direfund, tak boleh kehilangan keduanya.
select is(
  (select result from public.admin_refund_order('MRV-PGTPB1', 'c0000000-0000-4000-8000-00000000000a', 'uji')),
  'refunded_still_paid', 'order lunas lain menahan pencabutan');
select is(
  (select status::text from public.invitations where id = 'c0000000-0000-4000-8000-0000000000b1'),
  'active', 'undangan tetap aktif');

-- 4. Add-on → album diarsipkan, undangan TIDAK disentuh ------------------------
-- Inilah cabang yang dulu gagal "ambiguous".
select is(
  (select result from public.admin_refund_order('MRV-PGTAPC', 'c0000000-0000-4000-8000-00000000000a', 'uji')),
  'refunded_album_archived', 'add-on: album diarsipkan');
select is(
  (select status from public.momen_albums where invitation_id = 'c0000000-0000-4000-8000-0000000000c1'),
  'archived', 'album menjadi archived');
select is(
  (select status::text from public.invitations where id = 'c0000000-0000-4000-8000-0000000000c1'),
  'active', 'undangan add-on TIDAK ikut dicabut — yang dibeli albumnya');

-- 5. Order tak ada -------------------------------------------------------------
select is(
  (select result from public.admin_refund_order('MRV-ZZZZZZ', 'c0000000-0000-4000-8000-00000000000a', 'uji')),
  'not_found', 'kode order tak dikenal ditolak');

-- 6. Hardening execute ---------------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.admin_refund_order(text, uuid, text)', 'execute'),
  'authenticated TIDAK boleh memanggil RPC refund');

select * from finish();
rollback;
