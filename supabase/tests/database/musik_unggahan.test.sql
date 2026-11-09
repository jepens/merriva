-- Test DB (pgTAP) — musik unggahan klien (migrasi 20261108120000, DECISIONS #121).
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Yang dijaga:
--  1. `music_uploads` hanya untuk service_role — pemilik tak bisa membaca atau
--     memalsukan catatan unggahnya sendiri (itulah yang membuatnya bisa
--     dipercaya sebagai catatan pernyataan hak);
--  2. kunci unggah (`invitations.music_locked_at`) tak bisa dibuka pemilik;
--  3. path TERIKAT pada undangannya (check constraint);
--  4. purge memanen SEMUA objek musik hidup (bukan hanya yang dirujuk
--     `content`) dan barisnya dipertahankan bertanda `purge` — tanpa merusak
--     pemanenan video & scrub template Sebar yang sudah ada;
--  5. takedown & buka kunci atomik dengan admin_logs, hanya service_role;
--  6. hapus akun memutus tautan identitas, catatannya tetap;
--  7. kandidat penyapu (`music_uploads_usang`) tak pernah memuat rujukan saat
--     ini, memuat undangan purged walau dirujuk, menghormati batas, dan hanya
--     bisa dipanggil service_role.
--
-- `now()` stabil per transaksi: urutan baris ditentukan lewat `created_at`
-- EKSPLISIT, bukan lewat waktu sisip.
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('0d880000-0000-4000-8000-00000000000a', 'pgtap-musik-a@merriva.test'),
  ('0d880000-0000-4000-8000-00000000000b', 'pgtap-musik-b@merriva.test'),
  ('0d880000-0000-4000-8000-00000000000f', 'pgtap-musik-admin@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0d880000-0000-4000-8000-0000000000e0', 'pgtap-musik-tema', 'pgTAP', '{wedding}');

-- A1: undangan AKTIF ber-musik unggahan (target takedown).
-- B1: undangan AKTIF milik orang lain (tak boleh tersentuh takedown/purge A).
-- A2: undangan KEDALUWARSA ber-musik + video + template Sebar (target purge).
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, active_until, content,
   share_template, share_template_general)
values
  ('0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-00000000000a',
   '0d880000-0000-4000-8000-0000000000e0', 'pgtap-musik-a1', 'wedding', 'active',
   now() + interval '30 days',
   '{"title":"Andi & Sinta",
     "customMusic":{"path":"audio/0d880000-0000-4000-8000-0000000000a1/0d880000-0000-4000-8000-0000000000c2.mp3","name":"lagu.mp3"}}'::jsonb,
   null, null),
  ('0d880000-0000-4000-8000-0000000000b1', '0d880000-0000-4000-8000-00000000000b',
   '0d880000-0000-4000-8000-0000000000e0', 'pgtap-musik-b1', 'wedding', 'active',
   now() + interval '30 days', '{}'::jsonb, null, null),
  ('0d880000-0000-4000-8000-0000000000a2', '0d880000-0000-4000-8000-00000000000a',
   '0d880000-0000-4000-8000-0000000000e0', 'pgtap-musik-a2', 'wedding', 'expired',
   '2026-01-01 00:00:00+00',
   '{"video":{"path":"video/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000d1/video.mp4",
              "width":1280,"height":720,"durationSec":12},
     "customMusic":{"path":"audio/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000c6.mp3"}}'::jsonb,
   'Hormat kami, Kel. Sucipto 0812-0000 {link}', 'Kel. Sucipto {link}');

-- c1, c2 hidup (c2 dirujuk content); c3 sudah disapu cron (`replaced`).
-- c4 milik B1. c5 hidup TAK dirujuk content (diunggah lalu tak tersimpan),
-- c6 hidup dirujuk content, c7 sudah disapu — ketiganya milik A2.
insert into public.music_uploads
  (path, invitation_id, user_id, sha256, bytes, duration_ms, attest_version,
   created_at, removed_at, removed_reason)
values
  ('audio/0d880000-0000-4000-8000-0000000000a1/0d880000-0000-4000-8000-0000000000c1.mp3',
   '0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-00000000000a',
   repeat('1', 64), 1000, 180000, 1, now() - interval '3 hours', null, null),
  ('audio/0d880000-0000-4000-8000-0000000000a1/0d880000-0000-4000-8000-0000000000c2.mp3',
   '0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-00000000000a',
   repeat('2', 64), 2000, 190000, 1, now() - interval '2 hours', null, null),
  ('audio/0d880000-0000-4000-8000-0000000000a1/0d880000-0000-4000-8000-0000000000c3.mp3',
   '0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-00000000000a',
   repeat('3', 64), 3000, 200000, 1, now() - interval '3 days',
   '2026-11-01 00:00:00+00', 'replaced'),
  ('audio/0d880000-0000-4000-8000-0000000000b1/0d880000-0000-4000-8000-0000000000c4.mp3',
   '0d880000-0000-4000-8000-0000000000b1', '0d880000-0000-4000-8000-00000000000b',
   repeat('4', 64), 4000, 210000, 1, now() - interval '1 hour', null, null),
  ('audio/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000c5.mp3',
   '0d880000-0000-4000-8000-0000000000a2', '0d880000-0000-4000-8000-00000000000a',
   repeat('5', 64), 5000, 220000, 1, now() - interval '5 hours', null, null),
  ('audio/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000c6.mp3',
   '0d880000-0000-4000-8000-0000000000a2', '0d880000-0000-4000-8000-00000000000a',
   repeat('6', 64), 6000, 230000, 1, now() - interval '4 hours', null, null),
  ('audio/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000c7.mp3',
   '0d880000-0000-4000-8000-0000000000a2', '0d880000-0000-4000-8000-00000000000a',
   repeat('7', 64), 7000, 240000, 1, now() - interval '3 days',
   '2026-11-01 00:00:00+00', 'replaced');

-- 1. Hak akses tabel catatan --------------------------------------------------
select table_privs_are('public', 'music_uploads', 'anon', array[]::text[],
  'anon tak punya hak tabel apa pun di music_uploads');
select table_privs_are('public', 'music_uploads', 'authenticated', array[]::text[],
  'authenticated tak punya hak tabel apa pun di music_uploads');
select ok(
  not has_any_column_privilege('anon', 'public.music_uploads', 'SELECT, INSERT, UPDATE, REFERENCES')
  and not has_any_column_privilege('authenticated', 'public.music_uploads', 'SELECT, INSERT, UPDATE, REFERENCES'),
  'anon & authenticated juga tak punya hak KOLOM apa pun');

-- 2. Jalur sungguhan: pemilik ber-JWT -----------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d880000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$select count(*) from public.music_uploads$$,
  '42501', null,
  'pemilik tak bisa membaca catatan unggahnya sendiri');
select throws_ok(
  $$insert into public.music_uploads
      (path, invitation_id, user_id, sha256, bytes, duration_ms, attest_version)
    values ('audio/0d880000-0000-4000-8000-0000000000a1/0d880000-0000-4000-8000-0000000000c9.mp3',
            '0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-00000000000a',
            repeat('9', 64), 1, 1, 1)$$,
  '42501', null,
  'pemilik tak bisa memalsukan catatan unggah');
select throws_ok(
  $$update public.invitations set music_locked_at = now()
    where id = '0d880000-0000-4000-8000-0000000000a1'$$,
  '42501', null,
  'pemilik tak bisa menulis music_locked_at');
-- Kontrol: penolakan di atas karena kolomnya, bukan karena pemilik tak bisa
-- meng-UPDATE undangannya sama sekali.
select lives_ok(
  $$update public.invitations set share_template = null
    where id = '0d880000-0000-4000-8000-0000000000a1'$$,
  'kontrol: pemilik tetap bisa menulis kolom allowlist undangannya');
select throws_ok(
  $$select * from public.admin_takedown_custom_music(
      '0d880000-0000-4000-8000-0000000000b1', '0d880000-0000-4000-8000-00000000000a', 'x', null)$$,
  '42501', null,
  'pemilik tak bisa memanggil RPC takedown');
select throws_ok(
  $$select * from public.admin_unlock_custom_music(
      '0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-00000000000a')$$,
  '42501', null,
  'pemilik tak bisa memanggil RPC buka kunci');
reset role;

-- 3. EXECUTE hanya service_role -----------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.admin_takedown_custom_music(uuid, uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_takedown_custom_music(uuid, uuid, text, text)', 'execute'),
  'anon & authenticated tak bisa EXECUTE admin_takedown_custom_music');
select ok(
  not has_function_privilege('authenticated', 'public.admin_unlock_custom_music(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.admin_unlock_custom_music(uuid, uuid)', 'execute'),
  'anon & authenticated tak bisa EXECUTE admin_unlock_custom_music');
select ok(
  not has_function_privilege('authenticated', 'public.purge_invitation_data(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.purge_invitation_data(uuid)', 'execute'),
  'anon & authenticated tak bisa EXECUTE purge_invitation_data');
select ok(
  has_function_privilege('service_role', 'public.admin_takedown_custom_music(uuid, uuid, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.admin_unlock_custom_music(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.purge_invitation_data(uuid)', 'execute'),
  'kontrol: service_role bisa EXECUTE ketiganya');

-- 4. Path TERIKAT pada undangannya --------------------------------------------
select lives_ok(
  $$insert into public.music_uploads
      (path, invitation_id, user_id, sha256, bytes, duration_ms, attest_version)
    values ('audio/0d880000-0000-4000-8000-0000000000b1/0d880000-0000-4000-8000-0000000000c8.mp3',
            '0d880000-0000-4000-8000-0000000000b1', null, repeat('8', 64), 1, 1, 1)$$,
  'kontrol: path bentuk benar diterima');
select throws_ok(
  $$insert into public.music_uploads
      (path, invitation_id, user_id, sha256, bytes, duration_ms, attest_version)
    values ('audio/0d880000-0000-4000-8000-0000000000b1/0d880000-0000-4000-8000-0000000000ca.mp3',
            '0d880000-0000-4000-8000-0000000000a1', null, repeat('a', 64), 1, 1, 1)$$,
  '23514', null,
  'path milik undangan LAIN ditolak');
select throws_ok(
  $$insert into public.music_uploads
      (path, invitation_id, user_id, sha256, bytes, duration_ms, attest_version)
    values ('audio/0d880000-0000-4000-8000-0000000000a1/0d880000-0000-4000-8000-0000000000ca.m4a',
            '0d880000-0000-4000-8000-0000000000a1', null, repeat('a', 64), 1, 1, 1)$$,
  '23514', null,
  'ekstensi selain .mp3 ditolak');
select throws_ok(
  $$insert into public.music_uploads
      (path, invitation_id, user_id, sha256, bytes, duration_ms, attest_version)
    values ('audio/0d880000-0000-4000-8000-0000000000a1/0D880000-0000-4000-8000-0000000000CA.mp3',
            '0d880000-0000-4000-8000-0000000000a1', null, repeat('a', 64), 1, 1, 1)$$,
  '23514', null,
  'UUID berhuruf besar ditolak');
select throws_ok(
  $$insert into public.music_uploads
      (path, invitation_id, user_id, sha256, bytes, duration_ms, attest_version)
    values ('audio/0d880000-0000-4000-8000-0000000000a1/0d880000-0000-4000-8000-0000000000ca.MP3',
            '0d880000-0000-4000-8000-0000000000a1', null, repeat('a', 64), 1, 1, 1)$$,
  '23514', null,
  'ekstensi berhuruf besar ditolak');
-- Baris kontrol tadi dibuang agar tak mengganggu hitungan B1 di bawah.
delete from public.music_uploads
  where path = 'audio/0d880000-0000-4000-8000-0000000000b1/0d880000-0000-4000-8000-0000000000c8.mp3';

-- 5. Purge memanen semua musik hidup ------------------------------------------
create temporary table hasil_purge on commit drop as
  select * from public.purge_invitation_data('0d880000-0000-4000-8000-0000000000a2');

select is((select result from hasil_purge), 'purged', 'undangan kedaluwarsa ter-purge');
select ok(
  (select array[
     'audio/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000c5.mp3',
     'audio/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000c6.mp3'
   ]::text[] <@ momen_paths from hasil_purge),
  'SEMUA musik hidup dipanen — termasuk yang tak dirujuk content');
select ok(
  (select not ('audio/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000c7.mp3' = any(momen_paths))
     from hasil_purge),
  'musik yang sudah disapu (removed) tidak dipanen ulang');
select is(
  (select count(*)::int from public.music_uploads
     where invitation_id = '0d880000-0000-4000-8000-0000000000a2'),
  3, 'baris catatan DIPERTAHANKAN sesudah purge');
select is(
  (select array_agg(removed_reason order by created_at) from public.music_uploads
     where invitation_id = '0d880000-0000-4000-8000-0000000000a2'),
  array['replaced', 'purge', 'purge']::text[],
  'baris hidup ditandai purge; yang sudah replaced tak ditimpa');
select is(
  (select removed_at from public.music_uploads
     where path = 'audio/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000c7.mp3'),
  '2026-11-01 00:00:00+00'::timestamptz,
  'removed_at baris lama tak diubah purge');
select ok(
  (select 'video/0d880000-0000-4000-8000-0000000000a2/0d880000-0000-4000-8000-0000000000d1/video.mp4' = any(momen_paths)
     from hasil_purge),
  'REGRESI: video tetap dipanen');
select ok(
  (select share_template is null and share_template_general is null and content = '{}'::jsonb
     from public.invitations where id = '0d880000-0000-4000-8000-0000000000a2'),
  'REGRESI: template Sebar di-null-kan & content di-scrub');
select is(
  (select count(*)::int from public.music_uploads
     where invitation_id in ('0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-0000000000b1')
       and removed_at is null),
  3, 'purge tak menyentuh musik undangan lain');

-- 6. Takedown -----------------------------------------------------------------
select is(
  (select result from public.admin_takedown_custom_music(
     '0d880000-0000-4000-8000-0000000000ff', '0d880000-0000-4000-8000-00000000000f', 'x', null)),
  'not_found', 'takedown undangan tak dikenal → not_found');

create temporary table hasil_takedown on commit drop as
  select * from public.admin_takedown_custom_music(
    '0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-00000000000f',
    'laporan label X, kontak 0812-1', 'Pemegang hak melaporkan lagu ini.');

select is(
  (select row(result, slug, owner_id)::text from hasil_takedown),
  row('removed', 'pgtap-musik-a1', '0d880000-0000-4000-8000-00000000000a'::uuid)::text,
  'takedown → removed + slug + pemilik');
select is(
  (select paths from hasil_takedown),
  array[
    'audio/0d880000-0000-4000-8000-0000000000a1/0d880000-0000-4000-8000-0000000000c1.mp3',
    'audio/0d880000-0000-4000-8000-0000000000a1/0d880000-0000-4000-8000-0000000000c2.mp3'
  ]::text[],
  'paths = SEMUA objek hidup (urut unggah), tanpa yang sudah disapu');
select is(
  (select array_agg(removed_reason order by created_at) from public.music_uploads
     where invitation_id = '0d880000-0000-4000-8000-0000000000a1'),
  array['replaced', 'takedown', 'takedown']::text[],
  'baris hidup ditandai takedown; yang sudah replaced tak ditimpa');
select is(
  (select content from public.invitations where id = '0d880000-0000-4000-8000-0000000000a1'),
  '{"title":"Andi & Sinta"}'::jsonb,
  'content.customMusic dibuang, isi content lainnya utuh');
select isnt(
  (select music_locked_at from public.invitations where id = '0d880000-0000-4000-8000-0000000000a1'),
  null, 'unggah musik dikunci (music_locked_at terisi)');
select is(
  (select row(admin_id, target_type, detail->>'reason', detail->>'public_reason', detail->>'owner_id')::text
     from public.admin_logs
     where action = 'invitation.music_takedown'
       and target_id = '0d880000-0000-4000-8000-0000000000a1'),
  row('0d880000-0000-4000-8000-00000000000f'::uuid, 'invitation',
      'laporan label X, kontak 0812-1', 'Pemegang hak melaporkan lagu ini.',
      '0d880000-0000-4000-8000-00000000000a')::text,
  'admin_logs mencatat admin, kedua alasan, dan pemilik');
select is(
  (select array_agg(f->>'sha256' order by f->>'uploaded_at')
     from public.admin_logs l, jsonb_array_elements(l.detail->'files') f
     where l.action = 'invitation.music_takedown'
       and l.target_id = '0d880000-0000-4000-8000-0000000000a1'),
  array[repeat('1', 64), repeat('2', 64)]::text[],
  'admin_logs.files memuat sidik sha256 setiap berkas yang dihapus');
select is(
  (select count(*)::int from public.music_uploads
     where invitation_id = '0d880000-0000-4000-8000-0000000000b1' and removed_at is null),
  1, 'takedown tak menyentuh musik undangan lain');

-- Pemilik tak bisa membuka kuncinya sendiri.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d880000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$update public.invitations set music_locked_at = null
    where id = '0d880000-0000-4000-8000-0000000000a1'$$,
  '42501', null,
  'pemilik tak bisa membuka kunci unggah musik');
reset role;

-- 7. Buka kunci ---------------------------------------------------------------
select is(
  (select row(result, slug)::text from public.admin_unlock_custom_music(
     '0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-00000000000f')),
  row('unlocked', 'pgtap-musik-a1')::text,
  'buka kunci → unlocked');
select is(
  (select music_locked_at from public.invitations where id = '0d880000-0000-4000-8000-0000000000a1'),
  null, 'music_locked_at dikosongkan');
select is(
  (select count(*)::int from public.admin_logs
     where action = 'invitation.music_unlock'
       and target_id = '0d880000-0000-4000-8000-0000000000a1'
       and admin_id = '0d880000-0000-4000-8000-00000000000f'
       and detail ? 'locked_at'),
  1, 'buka kunci tercatat di admin_logs');
select is(
  (select result from public.admin_unlock_custom_music(
     '0d880000-0000-4000-8000-0000000000a1', '0d880000-0000-4000-8000-00000000000f')),
  'not_locked', 'buka kunci kedua → not_locked');
select is(
  (select result from public.admin_unlock_custom_music(
     '0d880000-0000-4000-8000-0000000000ff', '0d880000-0000-4000-8000-00000000000f')),
  'not_found', 'buka kunci undangan tak dikenal → not_found');

-- 8. Hapus akun: tautan identitas putus, catatan tetap ------------------------
delete from public.profiles where id = '0d880000-0000-4000-8000-00000000000b';
select is(
  (select count(*)::int from public.music_uploads
     where path = 'audio/0d880000-0000-4000-8000-0000000000b1/0d880000-0000-4000-8000-0000000000c4.mp3'
       and user_id is null and sha256 = repeat('4', 64)),
  1, 'hapus profil → user_id NULL, baris catatan tetap');

-- 9. Kandidat penyapu (`music_uploads_usang`) ---------------------------------
-- Fixture bertahun 2000 dengan `p_sebelum` 2000-02-01: unggahan sungguhan di
-- DB lokal pengembang (selalu lebih baru) tak pernah ikut terhitung.
-- A3: AKTIF, merujuk e1. A4: sudah di-PURGE tetapi content-nya masih merujuk
-- e5 (jendela unggah-vs-purge). A5: `customMusic` berupa STRING = path e6.
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, active_until, content, purged_at)
values
  ('0d880000-0000-4000-8000-0000000000a3', '0d880000-0000-4000-8000-00000000000a',
   '0d880000-0000-4000-8000-0000000000e0', 'pgtap-musik-a3', 'wedding', 'active',
   now() + interval '30 days',
   jsonb_build_object('customMusic', jsonb_build_object('path', 'audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e1.mp3')), null),
  ('0d880000-0000-4000-8000-0000000000a4', '0d880000-0000-4000-8000-00000000000a',
   '0d880000-0000-4000-8000-0000000000e0', 'pgtap-musik-a4', 'wedding', 'expired',
   '2026-01-01 00:00:00+00',
   jsonb_build_object('customMusic', jsonb_build_object('path', 'audio/0d880000-0000-4000-8000-0000000000a4/0d880000-0000-4000-8000-0000000000e5.mp3')), now()),
  ('0d880000-0000-4000-8000-0000000000a5', '0d880000-0000-4000-8000-00000000000a',
   '0d880000-0000-4000-8000-0000000000e0', 'pgtap-musik-a5', 'wedding', 'active',
   now() + interval '30 days',
   jsonb_build_object('customMusic', 'audio/0d880000-0000-4000-8000-0000000000a5/0d880000-0000-4000-8000-0000000000e6.mp3'::text), null);

-- e1 dirujuk · e2 diganti (tak dirujuk) · e3 sudah disapu · e4 tak dirujuk
-- tetapi LEBIH MUDA dari p_sebelum · e5 dirujuk undangan purged · e6 dirujuk
-- lewat bentuk string.
insert into public.music_uploads
  (path, invitation_id, user_id, sha256, bytes, duration_ms, attest_version,
   created_at, removed_at, removed_reason)
values
  ('audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e1.mp3', '0d880000-0000-4000-8000-0000000000a3', null, repeat('b', 64), 1, 1, 1,
   '2000-01-01 00:00:01+00', null, null),
  ('audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e2.mp3', '0d880000-0000-4000-8000-0000000000a3', null, repeat('b', 64), 1, 1, 1,
   '2000-01-01 00:00:02+00', null, null),
  ('audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e3.mp3', '0d880000-0000-4000-8000-0000000000a3', null, repeat('b', 64), 1, 1, 1,
   '2000-01-01 00:00:03+00', '2000-01-05 00:00:00+00', 'replaced'),
  ('audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e4.mp3', '0d880000-0000-4000-8000-0000000000a3', null, repeat('b', 64), 1, 1, 1,
   '2000-03-01 00:00:00+00', null, null),
  ('audio/0d880000-0000-4000-8000-0000000000a4/0d880000-0000-4000-8000-0000000000e5.mp3', '0d880000-0000-4000-8000-0000000000a4', null, repeat('b', 64), 1, 1, 1,
   '2000-01-01 00:00:05+00', null, null),
  ('audio/0d880000-0000-4000-8000-0000000000a5/0d880000-0000-4000-8000-0000000000e6.mp3', '0d880000-0000-4000-8000-0000000000a5', null, repeat('b', 64), 1, 1, 1,
   '2000-01-01 00:00:06+00', null, null);

create temporary table kandidat_sapu on commit drop as
  select array_agg(path order by urutan) as paths
  from public.music_uploads_usang('2000-02-01 00:00:00+00', 100)
    with ordinality as k(id, path, urutan);

select ok(
  (select not ('audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e1.mp3' = any(paths)) from kandidat_sapu),
  'rujukan saat ini (content.customMusic.path) TAK PERNAH jadi kandidat');
select ok(
  (select 'audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e2.mp3' = any(paths) from kandidat_sapu),
  'unggahan yang sudah diganti jadi kandidat');
select ok(
  (select 'audio/0d880000-0000-4000-8000-0000000000a4/0d880000-0000-4000-8000-0000000000e5.mp3' = any(paths) from kandidat_sapu),
  'undangan purged: jadi kandidat walau content masih merujuknya');
select ok(
  (select not ('audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e3.mp3' = any(paths)) from kandidat_sapu),
  'baris yang sudah removed tak jadi kandidat lagi');
select ok(
  (select not ('audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e4.mp3' = any(paths)) from kandidat_sapu),
  'unggahan yang lebih muda dari p_sebelum tak jadi kandidat');
select ok(
  (select 'audio/0d880000-0000-4000-8000-0000000000a5/0d880000-0000-4000-8000-0000000000e6.mp3' = any(paths) from kandidat_sapu),
  'customMusic berupa string (bukan objek) dianggap tak merujuk');
select is(
  (select paths from kandidat_sapu),
  array['audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e2.mp3', 'audio/0d880000-0000-4000-8000-0000000000a4/0d880000-0000-4000-8000-0000000000e5.mp3', 'audio/0d880000-0000-4000-8000-0000000000a5/0d880000-0000-4000-8000-0000000000e6.mp3']::text[],
  'hanya ketiga kandidat itu, urut created_at');
select is(
  array(select k.path from public.music_uploads_usang('2000-02-01 00:00:00+00', 2) k),
  array['audio/0d880000-0000-4000-8000-0000000000a3/0d880000-0000-4000-8000-0000000000e2.mp3', 'audio/0d880000-0000-4000-8000-0000000000a4/0d880000-0000-4000-8000-0000000000e5.mp3']::text[],
  'p_batas dihormati — yang tertua dulu');
select is(
  (select count(*)::int from public.music_uploads_usang('2000-02-01 00:00:00+00', -1)),
  0, 'p_batas negatif → nol baris, bukan galat LIMIT');

-- Kontrol: yang membuat e5 muncul memang purged_at, bukan hal lain.
update public.invitations set purged_at = null
  where id = '0d880000-0000-4000-8000-0000000000a4';
select ok(
  not exists (select 1 from public.music_uploads_usang('2000-02-01 00:00:00+00', 100) k
              where k.path = 'audio/0d880000-0000-4000-8000-0000000000a4/0d880000-0000-4000-8000-0000000000e5.mp3'),
  'kontrol: tanpa purged_at, rujukan yang sama bukan kandidat');

select ok(
  not has_function_privilege('anon', 'public.music_uploads_usang(timestamptz, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.music_uploads_usang(timestamptz, integer)', 'execute')
  and has_function_privilege('service_role', 'public.music_uploads_usang(timestamptz, integer)', 'execute'),
  'music_uploads_usang: EXECUTE hanya service_role');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d880000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.music_uploads_usang(now(), 10)$$,
  -- Pesan dicocokkan: tanpa itu, fungsi yang KEBOBOLAN grant tetap lolos di
  -- sini karena gagal 42501 juga di tabel music_uploads.
  '42501', 'permission denied for function music_uploads_usang',
  'pemilik tak bisa memanggil RPC kandidat penyapu');
reset role;

select * from finish();
rollback;
