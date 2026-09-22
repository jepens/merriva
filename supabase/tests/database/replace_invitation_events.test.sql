-- Test DB (pgTAP) RPC public.replace_invitation_events — DECISIONS #42 & #43.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Test kontrak migrasi (tests/unit/migrations-schedule-contract.test.ts) hanya
-- membaca TEKS SQL; berkas ini menjalankan fungsinya sungguhan di bawah RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Fixture ----------------------------------------------------------------------
-- A memiliki dua undangan (A1, A2); B memiliki satu (B). Keduanya bukan admin.
insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-00000000000a', 'pgtap-a@merriva.test'),
  ('f0000000-0000-4000-8000-00000000000b', 'pgtap-b@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('f0000000-0000-4000-8000-0000000000e0', 'pgtap-tema', 'pgTAP', '{wedding}');
insert into public.invitations (id, user_id, theme_id, slug, category) values
  ('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-0000000000e0', 'pgtap-a1', 'wedding'),
  ('f0000000-0000-4000-8000-0000000000a2', 'f0000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-0000000000e0', 'pgtap-a2', 'wedding'),
  ('f0000000-0000-4000-8000-0000000000b1', 'f0000000-0000-4000-8000-00000000000b', 'f0000000-0000-4000-8000-0000000000e0', 'pgtap-b1', 'wedding');
insert into public.invitation_events (id, invitation_id, name, start_at, sort_order) values
  ('e0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-0000000000a1', 'Akad', '2026-12-20T02:00:00Z', 0),
  ('e0000000-0000-4000-8000-0000000000a2', 'f0000000-0000-4000-8000-0000000000a1', 'Resepsi', '2026-12-20T05:00:00Z', 1),
  ('e0000000-0000-4000-8000-0000000000a3', 'f0000000-0000-4000-8000-0000000000a2', 'Undangan lain A', '2026-12-21T02:00:00Z', 0),
  ('e0000000-0000-4000-8000-0000000000b1', 'f0000000-0000-4000-8000-0000000000b1', 'Milik B', '2026-12-22T02:00:00Z', 0);

-- Calon check-in Fase 2: baris anak ber-FK cascade ke sesi. Hapus-lalu-sisip
-- (RPC lama) menghapusnya walau id sesi yang disisip ulang "tetap sama" —
-- id saja tak membedakan keduanya; baris anak inilah yang membedakan.
create table public.pgtap_checkin_probe (
  event_id uuid not null references public.invitation_events (id) on delete cascade
);
insert into public.pgtap_checkin_probe (event_id) values
  ('e0000000-0000-4000-8000-0000000000a1'),
  ('e0000000-0000-4000-8000-0000000000a2');

-- Pemanggil = pengguna A (authenticated, bukan admin).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

-- 1. Upsert per id: id lama DIPERBARUI di tempat, sesi tanpa id disisipkan -------
select lives_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000a1', '[
       {"id":"e0000000-0000-4000-8000-0000000000a2","name":"Resepsi","end_at":"2026-12-20T08:00:00Z","venue_name":"Gedung","address":"Jl. Melati 1","maps_url":"https://maps.app/x","sort_order":0},
       {"id":"e0000000-0000-4000-8000-0000000000a1","name":"Akad Nikah","start_at":"2026-12-20T03:00:00Z","sort_order":1},
       {"name":"","sort_order":2}]'::jsonb) $$,
  'pemilik: upsert per id berjalan');
select results_eq(
  $$ select id::text, name, sort_order from public.invitation_events
     where invitation_id = 'f0000000-0000-4000-8000-0000000000a1'
       and id in ('e0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-0000000000a2')
     order by sort_order $$,
  $$ values ('e0000000-0000-4000-8000-0000000000a2', 'Resepsi', 0),
            ('e0000000-0000-4000-8000-0000000000a1', 'Akad Nikah', 1) $$,
  '#43: id sesi yang dikirim TETAP sama; isi & urutan diperbarui di tempat');
select is(
  (select start_at from public.invitation_events where id = 'e0000000-0000-4000-8000-0000000000a1'),
  '2026-12-20T03:00:00Z'::timestamptz,
  'jam mulai yang baru ikut diperbarui');
select is(
  (select start_at from public.invitation_events where id = 'e0000000-0000-4000-8000-0000000000a2'),
  null::timestamptz,
  '#42: sesi tanpa jam mulai tersimpan dengan start_at NULL (tak dibuang)');
select results_eq(
  $$ select name, start_at, end_at, venue_name, address, maps_url, sort_order
     from public.invitation_events where id = 'e0000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('Resepsi', null::timestamptz, '2026-12-20T08:00:00Z'::timestamptz,
             'Gedung', 'Jl. Melati 1', 'https://maps.app/x', 0) $$,
  'SEMUA kolom sesi yang diperbarui di tempat ikut tersimpan (bukan hanya sebagian)');
select is(
  (select count(*)::int from public.invitation_events
   where invitation_id = 'f0000000-0000-4000-8000-0000000000a1' and sort_order = 2 and name = ''),
  1,
  '#43: sesi tanpa id disisipkan sebagai baris baru; #42: nama kosong tetap kosong (bukan "Acara")');

-- 2. Sesi yang tak dikirim lagi terhapus; yang dikirim tetap -------------------
select lives_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000a1',
       '[{"id":"e0000000-0000-4000-8000-0000000000a1","name":"Akad Nikah","sort_order":0}]'::jsonb) $$,
  'pemilik: kirim satu sesi saja');
select results_eq(
  $$ select id::text from public.invitation_events
     where invitation_id = 'f0000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('e0000000-0000-4000-8000-0000000000a1') $$,
  'sesi yang dibuang pemilik terhapus; sesi yang dikirim tetap ber-id sama');

reset role;
select is(
  (select count(*)::int from public.pgtap_checkin_probe where event_id = 'e0000000-0000-4000-8000-0000000000a1'),
  1,
  '#43: baris anak ber-FK (calon check-in Fase 2) SELAMAT melewati dua simpanan — sesi diperbarui di tempat, bukan dihapus lalu disisip ulang');
select is(
  (select count(*)::int from public.pgtap_checkin_probe where event_id = 'e0000000-0000-4000-8000-0000000000a2'),
  0,
  'sesi yang dibuang pemilik tetap meng-cascade anaknya (soft-delete diputuskan saat desain check-in Fase 2)');
set local role authenticated;

-- 3. Id milik undangan ORANG LAIN disusupkan → dilewati tanpa galat -------------
select lives_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000a1', '[
       {"id":"e0000000-0000-4000-8000-0000000000a1","name":"Akad Nikah","sort_order":0},
       {"id":"e0000000-0000-4000-8000-0000000000b1","name":"DIBAJAK","sort_order":1}]'::jsonb) $$,
  'id sesi orang lain tak menggagalkan simpanan');
select is(
  (select count(*)::int from public.invitation_events where invitation_id = 'f0000000-0000-4000-8000-0000000000a1'),
  1,
  'id sesi orang lain tak menyisipkan apa pun ke undangan pemanggil');

-- 4. Id sesi undangan LAIN milik pemanggil sendiri → juga dilewati --------------
select lives_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000a1', '[
       {"id":"e0000000-0000-4000-8000-0000000000a1","name":"Akad Nikah","sort_order":0},
       {"id":"e0000000-0000-4000-8000-0000000000a3","name":"PINDAH","sort_order":1}]'::jsonb) $$,
  'id sesi undangan lain milik sendiri tak menggagalkan simpanan');
select results_eq(
  $$ select invitation_id::text, name from public.invitation_events
     where id = 'e0000000-0000-4000-8000-0000000000a3' $$,
  $$ values ('f0000000-0000-4000-8000-0000000000a2', 'Undangan lain A') $$,
  'sesi undangan lain milik sendiri tidak dipindah maupun diubah');

-- 5. Memanggil RPC untuk undangan orang lain -----------------------------------
select lives_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000b1', '[]'::jsonb) $$,
  'daftar kosong untuk undangan orang lain: tak ada galat');
select throws_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000b1',
       '[{"name":"Spam","sort_order":0}]'::jsonb) $$,
  '42501', null,
  'sesi baru untuk undangan orang lain ditolak RLS');
select throws_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000b1',
       '[{"id":"e0000000-0000-4000-8000-0000000000b1","name":"DIBAJAK","sort_order":0}]'::jsonb) $$,
  '42501', null,
  'mengubah sesi orang lain lewat undangannya sendiri ditolak RLS');

-- 6. Id ganda dalam satu kiriman ditolak Postgres (alasan aksi men-dedupe) ------
select throws_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000a1', '[
       {"id":"e0000000-0000-4000-8000-0000000000a1","name":"X","sort_order":0},
       {"id":"e0000000-0000-4000-8000-0000000000a1","name":"Y","sort_order":1}]'::jsonb) $$,
  '21000', null,
  'id ganda: "ON CONFLICT DO UPDATE cannot affect row a second time"');

-- 7. Kompatibilitas: aplikasi LAMA (tanpa id) = perilaku sebelum #43 ------------
select lives_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000a1',
       '[{"name":"Lama 1","sort_order":0},{"name":"Lama 2","sort_order":1}]'::jsonb) $$,
  'payload tanpa id diterima');
select results_eq(
  $$ select name from public.invitation_events
     where invitation_id = 'f0000000-0000-4000-8000-0000000000a1' order by sort_order $$,
  $$ values ('Lama 1'), ('Lama 2') $$,
  'payload tanpa id: semua sesi lama diganti (hapus + sisip ulang)');
select is(
  (select count(*)::int from public.invitation_events where id = 'e0000000-0000-4000-8000-0000000000a1'),
  0,
  'payload tanpa id: id lama tak dipertahankan (sama seperti RPC lama)');
select lives_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000a1', 'null'::jsonb) $$,
  'events bukan array diterima');
select is(
  (select count(*)::int from public.invitation_events where invitation_id = 'f0000000-0000-4000-8000-0000000000a1'),
  0,
  'events bukan array: semua sesi terhapus (sama seperti RPC lama)');

-- Pemeriksaan sebagai pemilik DB: baris orang lain utuh ------------------------
reset role;
select results_eq(
  $$ select invitation_id::text, name from public.invitation_events
     where id = 'e0000000-0000-4000-8000-0000000000b1' $$,
  $$ values ('f0000000-0000-4000-8000-0000000000b1', 'Milik B') $$,
  'sesi pengguna B utuh setelah semua percobaan pengguna A');

-- 8. anon tak bisa mengeksekusi ------------------------------------------------
set local role anon;
select throws_ok(
  $$ select public.replace_invitation_events('f0000000-0000-4000-8000-0000000000a1', '[]'::jsonb) $$,
  '42501', null,
  'anon tak punya hak eksekusi');
reset role;

-- 9. Kontrak keamanan fungsi ---------------------------------------------------
select is(
  (select prosecdef from pg_proc where oid = 'public.replace_invitation_events(uuid, jsonb)'::regprocedure),
  false,
  'RPC SECURITY INVOKER (RLS pemanggil berlaku)');
select is(
  has_function_privilege('public', 'public.replace_invitation_events(uuid, jsonb)', 'execute'),
  false,
  'PUBLIC tak punya hak eksekusi');

select * from finish();
rollback;
