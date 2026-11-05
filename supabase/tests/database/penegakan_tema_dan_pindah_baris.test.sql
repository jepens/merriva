-- Test DB (pgTAP) — tema premium mengikuti paket & baris tak bisa dipindah
-- antar-undangan (migrasi 20261106100000, DECISIONS #116).
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Dijalankan sebagai PEMILIK sungguhan (role authenticated + JWT) — jalur yang
-- dipakai serangan: PATCH/UPDATE langsung lewat PostgREST.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('0d860000-0000-4000-8000-00000000000a', 'pgtap-tema@merriva.test'),
  ('0d860000-0000-4000-8000-00000000000b', 'pgtap-tema-pro@merriva.test');
-- Pro: draft tanpa paket memakai paket teratas (#115) → boleh tema premium.
update public.profiles set role = 'pro' where id = '0d860000-0000-4000-8000-00000000000b';

insert into public.themes (id, slug, name, categories, tier, is_active) values
  ('0d860000-0000-4000-8000-0000000000e1', 'pgtap-std', 'Std', '{wedding}', 'standard', true),
  ('0d860000-0000-4000-8000-0000000000e2', 'pgtap-prem', 'Prem', '{wedding}', 'premium', true),
  ('0d860000-0000-4000-8000-0000000000e3', 'pgtap-mati', 'Mati', '{wedding}', 'standard', false),
  ('0d860000-0000-4000-8000-0000000000e4', 'pgtap-korp', 'Korp', '{corporate}', 'standard', true);

-- a1: undangan Basic berbayar (tema standar) · a2: Premium berbayar (tema standar)
-- a3: draft DIBUAT dengan tema premium (INSERT tak diperiksa) · a4: draft lain milik pemilik sama
-- b1: draft milik akun Pro (tanpa paket)
-- a5: Premium KEDALUWARSA dengan order perpanjangan Basic yang masih pending
-- a6: Premium kedaluwarsa dengan order perpanjangan PREMIUM pending (pembanding)
insert into public.invitations (id, user_id, theme_id, slug, category, status, content, package_id) values
  ('0d860000-0000-4000-8000-0000000000a1', '0d860000-0000-4000-8000-00000000000a', '0d860000-0000-4000-8000-0000000000e1',
   'pgtap-tema-a1', 'wedding', 'active', '{}', (select id from public.packages where code = 'basic')),
  ('0d860000-0000-4000-8000-0000000000a2', '0d860000-0000-4000-8000-00000000000a', '0d860000-0000-4000-8000-0000000000e1',
   'pgtap-tema-a2', 'wedding', 'active', '{}', (select id from public.packages where code = 'premium')),
  ('0d860000-0000-4000-8000-0000000000a3', '0d860000-0000-4000-8000-00000000000a', '0d860000-0000-4000-8000-0000000000e2',
   'pgtap-tema-a3', 'wedding', 'draft', '{}', null),
  ('0d860000-0000-4000-8000-0000000000a4', '0d860000-0000-4000-8000-00000000000a', '0d860000-0000-4000-8000-0000000000e1',
   'pgtap-tema-a4', 'wedding', 'draft', '{}', null),
  ('0d860000-0000-4000-8000-0000000000b1', '0d860000-0000-4000-8000-00000000000b', '0d860000-0000-4000-8000-0000000000e1',
   'pgtap-tema-b1', 'wedding', 'draft', '{}', null),
  ('0d860000-0000-4000-8000-0000000000a5', '0d860000-0000-4000-8000-00000000000a', '0d860000-0000-4000-8000-0000000000e1',
   'pgtap-tema-a5', 'wedding', 'expired', '{}', (select id from public.packages where code = 'premium')),
  ('0d860000-0000-4000-8000-0000000000a6', '0d860000-0000-4000-8000-00000000000a', '0d860000-0000-4000-8000-0000000000e1',
   'pgtap-tema-a6', 'wedding', 'expired', '{}', (select id from public.packages where code = 'premium'));

insert into public.orders (user_id, invitation_id, package_id, amount_idr, status, order_code, purpose) values
  ('0d860000-0000-4000-8000-00000000000a', '0d860000-0000-4000-8000-0000000000a5',
   (select id from public.packages where code = 'basic'), 99000, 'pending', 'MRV-PGTTEMA5', 'purchase'),
  ('0d860000-0000-4000-8000-00000000000a', '0d860000-0000-4000-8000-0000000000a6',
   (select id from public.packages where code = 'premium'), 199000, 'pending', 'MRV-PGTTEMA6', 'purchase');

insert into public.guests (id, invitation_id, name, token) values
  ('0d860000-0000-4000-8000-0000000000c1', '0d860000-0000-4000-8000-0000000000a4', 'Tamu X', 'pgtaptemax000001');
-- `storage_path` wajib `inv/<invitation_id>/<id>` (constraint 20261103045611).
insert into public.media (id, invitation_id, storage_path, width, height) values
  ('0d860000-0000-4000-8000-0000000000d1', '0d860000-0000-4000-8000-0000000000a4',
   'inv/0d860000-0000-4000-8000-0000000000a4/0d860000-0000-4000-8000-0000000000d1', 1600, 1200);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d860000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

-- Tema ------------------------------------------------------------------------
select throws_ok(
  $$update public.invitations set theme_id = '0d860000-0000-4000-8000-0000000000e2'
    where id = '0d860000-0000-4000-8000-0000000000a1'$$,
  '23514', 'Tema premium hanya untuk paket Premium.',
  'undangan BASIC tak bisa dipindah ke tema premium lewat API');
select lives_ok(
  $$update public.invitations set theme_id = '0d860000-0000-4000-8000-0000000000e2'
    where id = '0d860000-0000-4000-8000-0000000000a2'$$,
  'undangan PREMIUM boleh pindah ke tema premium');
select throws_ok(
  $$update public.invitations set theme_id = '0d860000-0000-4000-8000-0000000000e3'
    where id = '0d860000-0000-4000-8000-0000000000a1'$$,
  '23514', 'Tema tidak tersedia untuk undangan ini.',
  'tema NONAKTIF ditolak');
select throws_ok(
  $$update public.invitations set theme_id = '0d860000-0000-4000-8000-0000000000e4'
    where id = '0d860000-0000-4000-8000-0000000000a1'$$,
  '23514', 'Tema tidak tersedia untuk undangan ini.',
  'tema berkategori LAIN ditolak');
select lives_ok(
  $$update public.invitations set content = '{"title":"x"}'::jsonb
    where id = '0d860000-0000-4000-8000-0000000000a3'$$,
  'draft yang DIBUAT dengan tema premium tetap bisa disimpan (tema tak diganti)');
select is((select theme_id from public.invitations where id = '0d860000-0000-4000-8000-0000000000a1'),
  '0d860000-0000-4000-8000-0000000000e1'::uuid, 'tema undangan Basic tak berubah');
select throws_ok(
  $$update public.invitations set theme_id = '0d860000-0000-4000-8000-0000000000e2'
    where id = '0d860000-0000-4000-8000-0000000000a5'$$,
  '23514', 'Tema premium hanya untuk paket Premium.',
  'Premium KEDALUWARSA + order Basic pending → tak bisa pindah ke tema premium sebelum bayar');
select lives_ok(
  $$update public.invitations set theme_id = '0d860000-0000-4000-8000-0000000000e2'
    where id = '0d860000-0000-4000-8000-0000000000a6'$$,
  'Premium kedaluwarsa + order PREMIUM pending → boleh tema premium');
select throws_ok(
  $$update public.invitations set theme_id = '0d860000-0000-4000-8000-0000000000e2'
    where id = '0d860000-0000-4000-8000-0000000000a4'$$,
  '23514', 'Tema premium hanya untuk paket Premium.',
  'draft PELANGGAN (tanpa paket = lantai Basic) tak bisa berganti ke tema premium');

-- Pindah baris ----------------------------------------------------------------
select throws_ok(
  $$update public.guests set invitation_id = '0d860000-0000-4000-8000-0000000000a1'
    where id = '0d860000-0000-4000-8000-0000000000c1'$$,
  '23514', 'Baris guests tak bisa dipindah ke undangan lain.',
  'tamu tak bisa dipindah antar-undangan (jalan pintas kuota)');
select lives_ok(
  $$update public.guests set name = 'Tamu X (ganti nama)'
    where id = '0d860000-0000-4000-8000-0000000000c1'$$,
  'menyunting tamu biasa tetap jalan');
select throws_ok(
  $$update public.media set invitation_id = '0d860000-0000-4000-8000-0000000000a1'
    where id = '0d860000-0000-4000-8000-0000000000d1'$$,
  '23514', 'Baris media tak bisa dipindah ke undangan lain.',
  'foto tak bisa dipindah antar-undangan');

-- Draft akun Pro: batas efektif = paket teratas (#115), dibaca lewat fungsi
-- INVOKER dari trigger DEFINER — jalur satu-satunya cabang #115 berperan.
select set_config('request.jwt.claims',
  '{"sub":"0d860000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select lives_ok(
  $$update public.invitations set theme_id = '0d860000-0000-4000-8000-0000000000e2'
    where id = '0d860000-0000-4000-8000-0000000000b1'$$,
  'draft akun PRO (paket teratas) boleh berganti ke tema premium');

reset role;
select is((select invitation_id from public.guests where id = '0d860000-0000-4000-8000-0000000000c1'),
  '0d860000-0000-4000-8000-0000000000a4'::uuid, 'tamu tetap di undangan asalnya');
select is((select theme_id from public.invitations where id = '0d860000-0000-4000-8000-0000000000b1'),
  '0d860000-0000-4000-8000-0000000000e2'::uuid, 'draft Pro BENAR-BENAR berganti tema (bukan 0 baris karena RLS)');

select * from finish();
rollback;
