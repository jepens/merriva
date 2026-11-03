-- Test DB (pgTAP) — `media.storage_path` terikat ke barisnya sendiri
-- (migrasi 20261103045611).
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Yang dijaga: pemilik undangan TIDAK bisa membuat barisnya menunjuk objek
-- milik undangan lain, baik lewat UPDATE maupun INSERT langsung. Setiap jalur
-- hapus (galeri, draft, purge, hapus akun) menghapus objek sesuai kolom ini
-- dengan driver storage server, jadi satu baris yang dibelokkan = foto orang
-- lain hilang. Penyerangnya pengguna yang LOGIN, bukan anon: menguji anon saja
-- melewatkan kasus nyatanya (lihat orders_rls.test.sql). Jalur sah
-- (`insert_gallery_media`) harus tetap jalan.
--
-- Penolakan dicocokkan sampai PESAN constraint-nya, bukan hanya SQLSTATE:
-- trigger batas foto `enforce_media_limit` juga melempar 23514, jadi test
-- INSERT bisa hijau karena alasan yang salah bila fixture menyentuh batas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('0d820000-0000-4000-8000-00000000000a', 'pgtap-media-penyerang@merriva.test'),
  ('0d820000-0000-4000-8000-00000000000b', 'pgtap-media-korban@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0d820000-0000-4000-8000-0000000000e0', 'pgtap-media-tema', 'pgTAP', '{wedding}');
insert into public.invitations (id, user_id, theme_id, slug, category) values
  ('0d820000-0000-4000-8000-0000000000a1', '0d820000-0000-4000-8000-00000000000a',
   '0d820000-0000-4000-8000-0000000000e0', 'pgtap-media-penyerang', 'wedding'),
  ('0d820000-0000-4000-8000-0000000000b1', '0d820000-0000-4000-8000-00000000000b',
   '0d820000-0000-4000-8000-0000000000e0', 'pgtap-media-korban', 'wedding');

-- Foto korban, berbentuk persis seperti hasil unggahan sah.
insert into public.media (id, invitation_id, storage_path, width, height) values
  ('0d820000-0000-4000-8000-0000000000f1', '0d820000-0000-4000-8000-0000000000b1',
   'inv/0d820000-0000-4000-8000-0000000000b1/0d820000-0000-4000-8000-0000000000f1', 1600, 1200);

-- Penyerang: pengguna login yang memegang draft sendiri ------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d820000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

-- 1. Jalur sah tetap jalan: RPC yang dipakai aksi unggah galeri.
select isnt(
  (select id from public.insert_gallery_media(
     '0d820000-0000-4000-8000-0000000000f2', '0d820000-0000-4000-8000-0000000000a1',
     'inv/0d820000-0000-4000-8000-0000000000a1/0d820000-0000-4000-8000-0000000000f2', 1600, 1200)),
  null,
  'unggah sah lewat insert_gallery_media tetap diterima');

-- 2. Membelokkan baris sendiri ke foto korban.
select throws_ok(
  $$ update public.media
       set storage_path = 'inv/0d820000-0000-4000-8000-0000000000b1/0d820000-0000-4000-8000-0000000000f1'
     where id = '0d820000-0000-4000-8000-0000000000f2' $$,
  '23514', 'new row for relation "media" violates check constraint "media_storage_path_format"',
  'UPDATE storage_path ke foto undangan lain ditolak');

-- 3. Menyisipkan baris baru yang langsung menunjuk foto korban.
select throws_ok(
  $$ insert into public.media (invitation_id, storage_path, width, height)
     values ('0d820000-0000-4000-8000-0000000000a1',
             'inv/0d820000-0000-4000-8000-0000000000b1/0d820000-0000-4000-8000-0000000000f1',
             1600, 1200) $$,
  '23514', 'new row for relation "media" violates check constraint "media_storage_path_format"',
  'INSERT dengan path foto undangan lain ditolak');

-- 4. Prefix undangan sendiri, tetapi id foto lain: tetap ditolak. Path terikat
--    ke `id` barisnya juga, bukan hanya ke undangannya.
select throws_ok(
  $$ insert into public.media (id, invitation_id, storage_path, width, height)
     values ('0d820000-0000-4000-8000-0000000000f3', '0d820000-0000-4000-8000-0000000000a1',
             'inv/0d820000-0000-4000-8000-0000000000a1/0d820000-0000-4000-8000-0000000000f4',
             1600, 1200) $$,
  '23514', 'new row for relation "media" violates check constraint "media_storage_path_format"',
  'path yang tak cocok dengan id barisnya ditolak');

-- Sesudahnya, dilihat tanpa RLS -----------------------------------------------
reset role;
select is(
  (select storage_path from public.media where id = '0d820000-0000-4000-8000-0000000000f2'),
  'inv/0d820000-0000-4000-8000-0000000000a1/0d820000-0000-4000-8000-0000000000f2',
  'baris penyerang tetap menunjuk objeknya sendiri');
select is(
  (select count(*)::int from public.media
    where storage_path = 'inv/0d820000-0000-4000-8000-0000000000b1/0d820000-0000-4000-8000-0000000000f1'),
  1,
  'hanya baris korban sendiri yang menunjuk foto korban');

select * from finish();
rollback;
