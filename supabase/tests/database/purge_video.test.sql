-- Test DB (pgTAP) — video undangan ikut terhapus saat retensi (FASE J).
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Video tak punya baris tabel; path berkas + posternya hidup di
-- `content.video` sebagai OBJEK `{path, poster, width, height, durationSec}` —
-- bentuk yang ditulis editor (`videoSchema`). Fixture memakai bentuk itu, bukan
-- bentuk karangan (pelajaran `purge_named_photos.test.sql`), plus bentuk rusak
-- dan path milik undangan lain yang wajib tersaring.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('0d820000-0000-4000-8000-00000000000a', 'pgtap-video@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0d820000-0000-4000-8000-0000000000e0', 'pgtap-video-tema', 'pgTAP', '{wedding}');

-- A: video + poster bentuk yang ditulis editor.
-- B: video tanpa poster (poster opsional).
-- C: bentuk rusak — `video` string, lalu path undangan LAIN & traversal.
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, active_until, content)
values
  ('0d820000-0000-4000-8000-0000000000a1', '0d820000-0000-4000-8000-00000000000a',
   '0d820000-0000-4000-8000-0000000000e0', 'pgtap-video-a', 'wedding', 'expired',
   '2026-01-01 00:00:00+00',
   '{"video":{"path":"video/0d820000-0000-4000-8000-0000000000a1/0d820000-0000-4000-8000-0000000000c1/video.mp4",
              "poster":"video/0d820000-0000-4000-8000-0000000000a1/0d820000-0000-4000-8000-0000000000c1/poster.webp",
              "width":1920,"height":1080,"durationSec":42}}'::jsonb),
  ('0d820000-0000-4000-8000-0000000000a2', '0d820000-0000-4000-8000-00000000000a',
   '0d820000-0000-4000-8000-0000000000e0', 'pgtap-video-b', 'wedding', 'expired',
   '2026-01-01 00:00:00+00',
   '{"video":{"path":"video/0d820000-0000-4000-8000-0000000000a2/0d820000-0000-4000-8000-0000000000c2/video.mov",
              "width":1280,"height":720,"durationSec":12}}'::jsonb),
  ('0d820000-0000-4000-8000-0000000000a3', '0d820000-0000-4000-8000-00000000000a',
   '0d820000-0000-4000-8000-0000000000e0', 'pgtap-video-c', 'wedding', 'expired',
   '2026-01-01 00:00:00+00',
   '{"video":{"path":"video/0d820000-0000-4000-8000-0000000000a1/0d820000-0000-4000-8000-0000000000c1/video.mp4",
              "poster":"video/0d820000-0000-4000-8000-0000000000a3/../../lain/poster.webp"}}'::jsonb);

create temporary table hasil_a on commit drop as
  select * from public.purge_invitation_data('0d820000-0000-4000-8000-0000000000a1');
create temporary table hasil_b on commit drop as
  select * from public.purge_invitation_data('0d820000-0000-4000-8000-0000000000a2');
create temporary table hasil_c on commit drop as
  select * from public.purge_invitation_data('0d820000-0000-4000-8000-0000000000a3');

select is((select result from hasil_a), 'purged', 'undangan bervideo terpurge');
select ok((select 'video/0d820000-0000-4000-8000-0000000000a1/0d820000-0000-4000-8000-0000000000c1/video.mp4' = any(momen_paths) from hasil_a),
  'berkas VIDEO ikut daftar hapus (path objek penuh)');
select ok((select 'video/0d820000-0000-4000-8000-0000000000a1/0d820000-0000-4000-8000-0000000000c1/poster.webp' = any(momen_paths) from hasil_a),
  'POSTER ikut daftar hapus');
select is(
  (select content from public.invitations where id = '0d820000-0000-4000-8000-0000000000a1'),
  '{}'::jsonb, 'content tetap di-scrub');

select is((select momen_paths from hasil_b),
  array['video/0d820000-0000-4000-8000-0000000000a2/0d820000-0000-4000-8000-0000000000c2/video.mov']::text[],
  'tanpa poster: hanya berkas video, tanpa baris NULL');

select is((select result from hasil_c), 'purged', 'content rusak tetap terpurge');
select is(
  (select coalesce(array_length(momen_paths, 1), 0) from hasil_c), 0,
  'path undangan LAIN dan traversal tersaring seluruhnya');

select * from finish();
rollback;
