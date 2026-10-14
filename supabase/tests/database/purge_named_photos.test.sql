-- Test DB (pgTAP) — foto bernama ikut terhapus saat retensi.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- KENAPA BERKAS INI ADA: foto sampul, foto mempelai, dan logo perusahaan tidak
-- punya baris tabel — pathnya hidup di dalam `invitations.content`. Fungsi yang
-- sama yang mengembalikan daftar objek untuk dihapus juga menimpa `content`
-- menjadi `'{}'`. Jadi sebelum migrasi 20261014120000, urutannya adalah:
-- satu-satunya rujukan ke objek itu dihapus, objeknya sendiri tidak. Foto wajah
-- mempelai tertinggal di storage selamanya, dan cron melaporkan "purged" dengan
-- jujur — tak ada apa pun yang terlihat salah dari luar.
--
-- Yang dijaga: keempat jenis foto ikut terpanen, prefix galeri TETAP ikut, dan
-- content kosong tidak menyisipkan baris NULL ke daftar (satu NULL di sana
-- membuat penghapusan di sisi aplikasi melempar untuk SELURUH undangan itu).
--
-- Hasil ditangkap ke tabel sementara karena panggilan kedua pada undangan yang
-- sama menjawab `already_purged` — daftar pathnya hanya ada di panggilan
-- PERTAMA.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('0d810000-0000-4000-8000-00000000000a', 'pgtap-foto@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-tema', 'pgTAP', '{wedding,corporate}');

-- A: wedding — sampul + kedua mempelai + satu prefix galeri
-- B: corporate — logo
-- C: content kosong (penjaga regresi)
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, active_until, content)
values
  ('0d810000-0000-4000-8000-0000000000a1', '0d810000-0000-4000-8000-00000000000a',
   '0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-a', 'wedding', 'expired',
   '2026-01-01 00:00:00+00',
   '{"coverPhoto":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c1",
     "groom":{"name":"A","photo":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c2"},
     "bride":{"name":"B","photo":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c3"}}'::jsonb),
  ('0d810000-0000-4000-8000-0000000000a2', '0d810000-0000-4000-8000-00000000000a',
   '0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-b', 'corporate', 'expired',
   '2026-01-01 00:00:00+00', '{"logo":"inv/0d810000-0000-4000-8000-0000000000a2/foto/0d810000-0000-4000-8000-0000000000c4"}'::jsonb),
  ('0d810000-0000-4000-8000-0000000000a3', '0d810000-0000-4000-8000-00000000000a',
   '0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-c', 'wedding', 'expired',
   '2026-01-01 00:00:00+00', '{}'::jsonb);

-- `media.storage_path` dibatasi check constraint `media_storage_path_format`
-- ke bentuk `inv/<uuid>/<uuid>` PERSIS. Prefix foto bernama sengaja berbeda
-- (`inv/<uuid>/foto/<uuid>`) dan memang tak pernah masuk tabel ini.
insert into public.media (invitation_id, storage_path, width, height) values
  ('0d810000-0000-4000-8000-0000000000a1', 'inv/0d810000-0000-4000-8000-0000000000a1/0d810000-0000-4000-8000-0000000000f1', 1600, 1200);

create temporary table hasil_a on commit drop as
  select * from public.purge_invitation_data('0d810000-0000-4000-8000-0000000000a1');
create temporary table hasil_b on commit drop as
  select * from public.purge_invitation_data('0d810000-0000-4000-8000-0000000000a2');
create temporary table hasil_c on commit drop as
  select * from public.purge_invitation_data('0d810000-0000-4000-8000-0000000000a3');

-- Assert ----------------------------------------------------------------------
select is((select result from hasil_a), 'purged',
  'undangan wedding berfoto terpurge');

select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c1' = any(media_paths) from hasil_a),
  'foto SAMPUL ikut daftar hapus');
select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c2' = any(media_paths) from hasil_a),
  'foto MEMPELAI PRIA ikut daftar hapus');
select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c3' = any(media_paths) from hasil_a),
  'foto MEMPELAI WANITA ikut daftar hapus');

select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/0d810000-0000-4000-8000-0000000000f1' = any(media_paths) from hasil_a),
  'prefix galeri TETAP ikut — foto bernama menambah, bukan menggantikan');

select ok((select 'inv/0d810000-0000-4000-8000-0000000000a2/foto/0d810000-0000-4000-8000-0000000000c4' = any(media_paths) from hasil_b),
  'LOGO corporate ikut daftar hapus');

select is((select result from hasil_c), 'purged',
  'content kosong tetap terpurge tanpa galat');
select is(
  (select coalesce(array_length(media_paths, 1), 0) from hasil_c), 0,
  'content kosong menghasilkan daftar kosong, bukan baris NULL');

select * from finish();
rollback;
