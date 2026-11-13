-- Test DB (pgTAP) — slug undangan terkunci sesudah keluar dari draft
-- (migrasi 20261113130000, DECISIONS #138).
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Dijalankan sebagai PEMILIK sungguhan (role authenticated + JWT) — jalur yang
-- dipakai serangan: PATCH langsung lewat PostgREST, melewati aksi aplikasi yang
-- sudah memfilter `status = 'draft'`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('51a90000-0000-4000-8000-00000000000a', 'pgtap-slug@merriva.test'),
  ('51a90000-0000-4000-8000-00000000000d', 'pgtap-slug-admin@merriva.test');
update public.profiles set role = 'admin' where id = '51a90000-0000-4000-8000-00000000000d';

insert into public.themes (id, slug, name, categories, tier, is_active) values
  ('51a90000-0000-4000-8000-0000000000e1', 'pgtap-slug-tema', 'Tema', '{wedding}', 'standard', true);

-- d1 draft · a1 aktif · p1 menunggu bayar · x1 kedaluwarsa · s1 ditangguhkan
-- a2 aktif (diubah admin) · a3 aktif (diubah service_role) · a4 aktif (pemilik DB)
insert into public.invitations (id, user_id, theme_id, slug, category, status, content) values
  ('51a90000-0000-4000-8000-0000000000d1', '51a90000-0000-4000-8000-00000000000a', '51a90000-0000-4000-8000-0000000000e1', 'pgtap-slug-d1', 'wedding', 'draft', '{}'),
  ('51a90000-0000-4000-8000-0000000000a1', '51a90000-0000-4000-8000-00000000000a', '51a90000-0000-4000-8000-0000000000e1', 'pgtap-slug-a1', 'wedding', 'active', '{}'),
  ('51a90000-0000-4000-8000-0000000000b1', '51a90000-0000-4000-8000-00000000000a', '51a90000-0000-4000-8000-0000000000e1', 'pgtap-slug-p1', 'wedding', 'pending_payment', '{}'),
  ('51a90000-0000-4000-8000-0000000000c1', '51a90000-0000-4000-8000-00000000000a', '51a90000-0000-4000-8000-0000000000e1', 'pgtap-slug-x1', 'wedding', 'expired', '{}'),
  ('51a90000-0000-4000-8000-0000000000f1', '51a90000-0000-4000-8000-00000000000a', '51a90000-0000-4000-8000-0000000000e1', 'pgtap-slug-s1', 'wedding', 'suspended', '{}'),
  ('51a90000-0000-4000-8000-0000000000a2', '51a90000-0000-4000-8000-00000000000a', '51a90000-0000-4000-8000-0000000000e1', 'pgtap-slug-a2', 'wedding', 'active', '{}'),
  ('51a90000-0000-4000-8000-0000000000a3', '51a90000-0000-4000-8000-00000000000a', '51a90000-0000-4000-8000-0000000000e1', 'pgtap-slug-a3', 'wedding', 'active', '{}'),
  ('51a90000-0000-4000-8000-0000000000a4', '51a90000-0000-4000-8000-00000000000a', '51a90000-0000-4000-8000-0000000000e1', 'pgtap-slug-a4', 'wedding', 'active', '{}');

-- Pemilik ----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"51a90000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$update public.invitations set slug = 'pgtap-slug-d1-baru'
    where id = '51a90000-0000-4000-8000-0000000000d1'$$,
  'DRAFT: pemilik boleh mengganti slug');
select is(
  (select slug from public.invitations where id = '51a90000-0000-4000-8000-0000000000d1'),
  'pgtap-slug-d1-baru',
  'DRAFT: slug baru tersimpan');

select throws_ok(
  $$update public.invitations set slug = 'pgtap-slug-a1-baru'
    where id = '51a90000-0000-4000-8000-0000000000a1'$$,
  '42501', 'Alamat undangan tidak bisa diubah setelah undangan keluar dari draft.',
  'AKTIF: pemilik TAK bisa mengganti slug lewat API');
select throws_ok(
  $$update public.invitations set slug = 'pgtap-slug-p1-baru'
    where id = '51a90000-0000-4000-8000-0000000000b1'$$,
  '42501', 'Alamat undangan tidak bisa diubah setelah undangan keluar dari draft.',
  'MENUNGGU BAYAR: pemilik TAK bisa mengganti slug');
select throws_ok(
  $$update public.invitations set slug = 'pgtap-slug-x1-baru'
    where id = '51a90000-0000-4000-8000-0000000000c1'$$,
  '42501', 'Alamat undangan tidak bisa diubah setelah undangan keluar dari draft.',
  'KEDALUWARSA: pemilik TAK bisa mengganti slug (slug lama tak boleh bebas)');
select throws_ok(
  $$update public.invitations set slug = 'pgtap-slug-s1-baru'
    where id = '51a90000-0000-4000-8000-0000000000f1'$$,
  '42501', 'Alamat undangan tidak bisa diubah setelah undangan keluar dari draft.',
  'DITANGGUHKAN: pemilik TAK bisa mengganti slug');
select is(
  (select slug from public.invitations where id = '51a90000-0000-4000-8000-0000000000a1'),
  'pgtap-slug-a1',
  'AKTIF: slug tetap yang lama sesudah percobaan ditolak');

select lives_ok(
  $$update public.invitations set content = '{"catatan":"edit biasa"}'
    where id = '51a90000-0000-4000-8000-0000000000a1'$$,
  'AKTIF: mengedit kolom lain tetap boleh');
select lives_ok(
  $$update public.invitations set slug = 'pgtap-slug-a1'
    where id = '51a90000-0000-4000-8000-0000000000a1'$$,
  'AKTIF: mengirim slug yang SAMA (no-op, mis. form simpan penuh) tetap lolos');

-- Admin (setara policy invitations_delete) ---------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"51a90000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
select lives_ok(
  $$update public.invitations set slug = 'pgtap-slug-a2-admin'
    where id = '51a90000-0000-4000-8000-0000000000a2'$$,
  'ADMIN boleh mengganti slug undangan aktif');

-- Jalur server tepercaya ---------------------------------------------------------
reset role;
set local role service_role;
select lives_ok(
  $$update public.invitations set slug = 'pgtap-slug-a3-server'
    where id = '51a90000-0000-4000-8000-0000000000a3'$$,
  'SERVICE_ROLE (aksi server) tak dibatasi');

reset role;
select lives_ok(
  $$update public.invitations set slug = 'pgtap-slug-a4-db'
    where id = '51a90000-0000-4000-8000-0000000000a4'$$,
  'PEMILIK DB (SQL Editor, perbaikan darurat) tak dibatasi');

select is(
  (select slug from public.invitations where id = '51a90000-0000-4000-8000-0000000000a1'),
  'pgtap-slug-a1',
  'AKTIF: slug pemilik tetap terkunci di akhir');

select * from finish();
rollback;
