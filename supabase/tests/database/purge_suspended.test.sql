-- Test DB (pgTAP) — cakupan status `purge_invitation_data`.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- KENAPA BERKAS INI ADA: undangan `suspended` sebelumnya TIDAK PERNAH dipurge,
-- dan tak ada satu pun jalur yang menutup lingkaran itu —
-- `admin_suspend_invitation` tak menyentuh `active_until`, cron
-- `expire-invitations` hanya membalik `active` → `expired`, dan RPC ini menolak
-- apa pun selain `expired`. Akibatnya nama tamu, nomor HP, isi ucapan, dan
-- catatan amplop tersimpan SELAMANYA, di luar retensi 6 bulan yang dijanjikan
-- `/privasi` dan di luar UU PDP 27/2022 — dan yang menanggungnya adalah TAMU,
-- yang tak melakukan apa pun.
--
-- Yang dijaga di sini adalah BATAS cakupannya, dua arah sekaligus: `suspended`
-- harus ikut, dan status yang masih hidup harus tetap ditolak. Melebarkannya
-- terlalu jauh jauh lebih berbahaya daripada kurang — `active` yang ikut terpurge
-- berarti menghapus data undangan yang sedang tayang.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('0d800000-0000-4000-8000-00000000000a', 'pgtap-purge-susp@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0d800000-0000-4000-8000-0000000000e0', 'pgtap-purge-tema', 'pgTAP', '{wedding}');

-- A: ditangguhkan · B: masih aktif · C: kedaluwarsa (penjaga regresi)
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, active_until, content)
values
  ('0d800000-0000-4000-8000-0000000000a1', '0d800000-0000-4000-8000-00000000000a',
   '0d800000-0000-4000-8000-0000000000e0', 'pgtap-purge-a', 'wedding', 'suspended',
   '2026-01-01 00:00:00+00', '{"mempelai":"A & B"}'::jsonb),
  ('0d800000-0000-4000-8000-0000000000a2', '0d800000-0000-4000-8000-00000000000a',
   '0d800000-0000-4000-8000-0000000000e0', 'pgtap-purge-b', 'wedding', 'active',
   '2027-01-01 00:00:00+00', '{"mempelai":"C & D"}'::jsonb),
  ('0d800000-0000-4000-8000-0000000000a3', '0d800000-0000-4000-8000-00000000000a',
   '0d800000-0000-4000-8000-0000000000e0', 'pgtap-purge-c', 'wedding', 'expired',
   '2026-01-01 00:00:00+00', '{"mempelai":"E & F"}'::jsonb);

-- `guests.token` minimal 10 karakter (check constraint).
insert into public.guests (invitation_id, name, token) values
  ('0d800000-0000-4000-8000-0000000000a1', 'Tamu A', 'pgtap-token-a1'),
  ('0d800000-0000-4000-8000-0000000000a2', 'Tamu B', 'pgtap-token-b1'),
  ('0d800000-0000-4000-8000-0000000000a3', 'Tamu C', 'pgtap-token-c1');
insert into public.gift_notes (invitation_id, guest_name, type, amount) values
  ('0d800000-0000-4000-8000-0000000000a1', 'Tamu A', 'transfer', 100000);

-- 1. DITANGGUHKAN ikut dipurge --------------------------------------------------
select is(
  (select result from public.purge_invitation_data(
     '0d800000-0000-4000-8000-0000000000a1')),
  'purged', 'undangan DITANGGUHKAN kini ikut retensi — sebelumnya tak pernah dipurge sama sekali');
select is(
  (select count(*)::int from public.guests
     where invitation_id = '0d800000-0000-4000-8000-0000000000a1'),
  0, 'data tamu undangan yang ditangguhkan benar-benar terhapus');
select is(
  (select count(*)::int from public.gift_notes
     where invitation_id = '0d800000-0000-4000-8000-0000000000a1'),
  0, 'catatan amplop ikut terhapus');
select ok(
  (select content = '{}'::jsonb and purged_at is not null
     from public.invitations where id = '0d800000-0000-4000-8000-0000000000a1'),
  'content di-scrub dan purged_at terisi (kerangka undangan tetap ada)');

-- 2. Status yang MASIH HIDUP tetap ditolak --------------------------------------
-- Arah ini lebih berbahaya daripada arah sebaliknya: `active` yang ikut terpurge
-- berarti menghapus data undangan yang sedang tayang untuk tamunya.
select is(
  (select result from public.purge_invitation_data(
     '0d800000-0000-4000-8000-0000000000a2')),
  'not_expired', 'undangan AKTIF tetap ditolak');
select is(
  (select count(*)::int from public.guests
     where invitation_id = '0d800000-0000-4000-8000-0000000000a2'),
  1, 'data tamu undangan aktif tak tersentuh');

-- 3. Jalur kedaluwarsa tak berubah (penjaga regresi) ----------------------------
select is(
  (select result from public.purge_invitation_data(
     '0d800000-0000-4000-8000-0000000000a3')),
  'purged', 'undangan kedaluwarsa tetap dipurge seperti sebelumnya');

select * from finish();
rollback;
