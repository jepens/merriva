-- Test DB (pgTAP) RLS tabel `orders` — AUDIT-2026-10-01 A4.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
--
-- `orders` adalah tabel uang dan sampai audit ini TIDAK punya satu pun test DB.
-- Dua hal yang membuatnya layak dijaga sungguhan:
--   * §6b migrasi awal mencabut hak per-KOLOM untuk profiles/invitations/rsvps
--     dan MELEWATKAN `orders` — grant SELECT `authenticated` masih mencakup
--     seluruh kolom, termasuk `raw_notification`. Satu policy UPDATE yang
--     longgar langsung membuat pelanggan bisa menulis ulang nominalnya sendiri.
--   * `user_id` kini NULLABLE (DECISIONS #53). Baris yatim pasca-hapus-akun
--     TIDAK boleh terlihat oleh klien mana pun.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'pgtap-rls-a@merriva.test'),
  ('a0000000-0000-4000-8000-00000000000b', 'pgtap-rls-b@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('a0000000-0000-4000-8000-0000000000e0', 'pgtap-rls-tema', 'pgTAP', '{wedding}');
insert into public.invitations (id, user_id, theme_id, slug, category) values
  ('a0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000e0', 'pgtap-rls-a1', 'wedding');

insert into public.orders (user_id, invitation_id, package_id, amount_idr, status, order_code)
values
  ('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
   (select id from public.packages where kind = 'invitation' and is_active limit 1),
   99000, 'pending', 'MRV-RLSAA1'),
  ('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
   (select id from public.packages where kind = 'invitation' and is_active limit 1),
   99000, 'paid', 'MRV-RLSAA2'),
  -- Baris YATIM: pemiliknya sudah menghapus akunnya.
  (null, 'a0000000-0000-4000-8000-0000000000a1',
   (select id from public.packages where kind = 'invitation' and is_active limit 1),
   99000, 'paid', 'MRV-RLSYAT');

-- 1. Pemilik melihat SELURUH ordernya, tetapi bukan yang yatim -----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.orders), 2,
  'pemilik melihat kedua ordernya');
select is((select count(*)::int from public.orders where order_code = 'MRV-RLSYAT'), 0,
  'baris yatim (user_id NULL) TIDAK terlihat pemilik mana pun');

-- 2. Tulis-ulang ditolak — grant kolomnya memang masih terbuka -----------------
update public.orders set status = 'paid' where order_code = 'MRV-RLSAA1';
update public.orders set amount_idr = 0 where order_code = 'MRV-RLSAA2';
delete from public.orders where order_code = 'MRV-RLSAA1';

reset role;
select is((select status::text from public.orders where order_code = 'MRV-RLSAA1'), 'pending',
  'pelanggan TIDAK bisa menaikkan statusnya sendiri jadi lunas');
select is((select amount_idr from public.orders where order_code = 'MRV-RLSAA2'), 99000,
  'pelanggan TIDAK bisa menulis ulang nominalnya');
select is((select count(*)::int from public.orders where order_code = 'MRV-RLSAA1'), 1,
  'pelanggan TIDAK bisa menghapus ordernya');

-- 3. Pengguna LAIN yang LOGIN — bukan hanya anon -------------------------------
-- Fixture buatan sendiri hanya menguji yang sudah terpikirkan; menguji `anon`
-- saja akan melewatkan kebocoran antar-pelanggan, yang justru kasus nyatanya.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.orders), 0,
  'pengguna lain yang login tidak melihat satu pun order milik A');

-- 4. Anon ----------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.orders), 0,
  'anon tidak melihat order apa pun');

-- 5. Insert langsung ditolak (order hanya dibuat service_role) ------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.orders (user_id, invitation_id, package_id, amount_idr, status, order_code)
     values ('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
             (select id from public.packages where kind = 'invitation' and is_active limit 1),
             1, 'paid', 'MRV-RLSHAX') $$,
  '42501',
  null,
  'pelanggan TIDAK bisa menyisipkan order lunas sendiri');

reset role;
select is((select count(*)::int from public.orders), 3,
  'seluruh baris utuh dilihat service_role/superuser');

select * from finish();
rollback;
