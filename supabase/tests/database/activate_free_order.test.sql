-- Test DB (pgTAP) public.activate_free_order — akun Admin/Pro tak pernah
-- ditagih (DECISIONS #100).
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- KENAPA BERKAS INI ADA: unit test aksi me-MOCK RPC ini. Yang dijaga di sini
-- adalah hal yang tak terlihat dari sana: siapa yang BOLEH (hanya pemilik
-- ber-peran admin/Pro — RLS memperlihatkan semua undangan kepada admin),
-- bahwa hasilnya identik dengan aktivasi berbayar, bahwa kegagalan tak
-- menyisakan order Rp0, dan bahwa klien tak bisa memberi dirinya peran Pro.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Fixture ---------------------------------------------------------------------
-- P = Pro, A = admin, C = klien. Profil dibuat trigger `on_auth_user_created`.
insert into auth.users (id, email) values
  ('0fee0000-0000-4000-8000-00000000000a', 'pgtap-free-pro@merriva.test'),
  ('0fee0000-0000-4000-8000-00000000000b', 'pgtap-free-admin@merriva.test'),
  ('0fee0000-0000-4000-8000-00000000000c', 'pgtap-free-client@merriva.test');
update public.profiles set role = 'pro'
  where id = '0fee0000-0000-4000-8000-00000000000a';
update public.profiles set role = 'admin'
  where id = '0fee0000-0000-4000-8000-00000000000b';

insert into public.themes (id, slug, name, categories) values
  ('0fee0000-0000-4000-8000-0000000000e0', 'pgtap-free-tema', 'pgTAP', '{wedding}');

-- I1 draft milik P · I2 draft milik C · I3 ditangguhkan milik P
-- I4 aktif Basic milik P (upgrade) · I5 aktif Premium milik P (Album Momen)
-- I6 draft milik admin A
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, package_id, active_until, published_at)
values
  ('0fee0000-0000-4000-8000-0000000000a1', '0fee0000-0000-4000-8000-00000000000a',
   '0fee0000-0000-4000-8000-0000000000e0', 'pgtap-free-1', 'wedding', 'draft',
   null, null, null),
  ('0fee0000-0000-4000-8000-0000000000a2', '0fee0000-0000-4000-8000-00000000000c',
   '0fee0000-0000-4000-8000-0000000000e0', 'pgtap-free-2', 'wedding', 'draft',
   null, null, null),
  ('0fee0000-0000-4000-8000-0000000000a3', '0fee0000-0000-4000-8000-00000000000a',
   '0fee0000-0000-4000-8000-0000000000e0', 'pgtap-free-3', 'wedding', 'suspended',
   null, null, null),
  ('0fee0000-0000-4000-8000-0000000000a4', '0fee0000-0000-4000-8000-00000000000a',
   '0fee0000-0000-4000-8000-0000000000e0', 'pgtap-free-4', 'wedding', 'active',
   (select id from public.packages where code = 'basic'),
   '2027-01-15 00:00:00+00', '2026-09-01 00:00:00+00'),
  ('0fee0000-0000-4000-8000-0000000000a5', '0fee0000-0000-4000-8000-00000000000a',
   '0fee0000-0000-4000-8000-0000000000e0', 'pgtap-free-5', 'wedding', 'active',
   (select id from public.packages where code = 'premium'),
   '2027-01-15 00:00:00+00', '2026-09-01 00:00:00+00'),
  ('0fee0000-0000-4000-8000-0000000000a6', '0fee0000-0000-4000-8000-00000000000b',
   '0fee0000-0000-4000-8000-0000000000e0', 'pgtap-free-6', 'wedding', 'draft',
   null, null, null);

-- 1. Aktivasi pertama: identik dengan aktivasi berbayar ----------------------
select is(
  (select result from public.activate_free_order(
     '0fee0000-0000-4000-8000-0000000000a1',
     (select id from public.packages where code = 'premium'),
     'purchase', 'MRV-FREE1', '0fee0000-0000-4000-8000-00000000000a')),
  'activated', 'Pro mengaktifkan undangannya sendiri tanpa bayar');
select is(
  (select status::text from public.invitations
     where id = '0fee0000-0000-4000-8000-0000000000a1'),
  'active', 'undangan menjadi active');
select is(
  (select p.code from public.invitations i
     join public.packages p on p.id = i.package_id
     where i.id = '0fee0000-0000-4000-8000-0000000000a1'),
  'premium', 'paket undangan = paket yang diaktifkan');
-- `now()` stabil per transaksi, dan `activate_paid_order` memakai now() yang
-- sama — jadi kesetaraannya persis, bukan perkiraan.
select is(
  (select active_until from public.invitations
     where id = '0fee0000-0000-4000-8000-0000000000a1'),
  now() + make_interval(months => (
    select duration_months from public.packages where code = 'premium')),
  'masa aktif = now + durasi paket (jalur aktivasi yang sama dengan bayar)');
select is(
  (select concat_ws('|', amount_idr, status, payment_method, purpose, user_id)
     from public.orders where order_code = 'MRV-FREE1'),
  '0|paid|gratis|purchase|0fee0000-0000-4000-8000-00000000000a',
  'tercatat sebagai order Rp0 lunas bermetode gratis atas nama pemilik');
select is(
  (select raw_notification ->> 'role' from public.orders
     where order_code = 'MRV-FREE1'),
  'pro', 'jejak peran yang membebaskan tersimpan di order');

-- 2. Hanya pemilik ber-peran admin/Pro ----------------------------------------
-- Cabang peran `admin` diuji tersendiri: semua kasus lain memakai Pro, jadi
-- gerbang peran yang menyusut menjadi `= 'pro'` tak akan terlihat.
select is(
  (select result from public.activate_free_order(
     '0fee0000-0000-4000-8000-0000000000a6',
     (select id from public.packages where code = 'premium'),
     'purchase', 'MRV-FREE7', '0fee0000-0000-4000-8000-00000000000b')),
  'activated', 'admin mengaktifkan undangannya sendiri tanpa bayar');
select is(
  (select result from public.activate_free_order(
     '0fee0000-0000-4000-8000-0000000000a2',
     (select id from public.packages where code = 'premium'),
     'purchase', 'MRV-FREE2', '0fee0000-0000-4000-8000-00000000000b')),
  'not_allowed', 'admin TIDAK bisa menggratiskan undangan milik pelanggan');
select is(
  (select count(*)::int from public.orders where order_code = 'MRV-FREE2'),
  0, 'penolakan tak meninggalkan order');
select is(
  (select result from public.activate_free_order(
     '0fee0000-0000-4000-8000-0000000000a2',
     (select id from public.packages where code = 'premium'),
     'purchase', 'MRV-FREE3', '0fee0000-0000-4000-8000-00000000000c')),
  'not_allowed', 'klien biasa tidak bebas bayar walau pemilik');
select is(
  (select status::text from public.invitations
     where id = '0fee0000-0000-4000-8000-0000000000a2'),
  'draft', 'undangan yang ditolak tetap draft');

-- 3. Gagal = batal seluruhnya ---------------------------------------------------
select throws_ok(
  $$select * from public.activate_free_order(
      '0fee0000-0000-4000-8000-0000000000a3',
      (select id from public.packages where code = 'premium'),
      'purchase', 'MRV-FREE4', '0fee0000-0000-4000-8000-00000000000a')$$,
  'P0001', 'activate_free_order: held',
  'undangan ditangguhkan → held → galat (tak diam-diam lolos)');
select is(
  (select count(*)::int from public.orders where order_code = 'MRV-FREE4'),
  0, 'order Rp0 ikut di-rollback — tak ada order lunas tanpa efek');
select is(
  (select status::text from public.invitations
     where id = '0fee0000-0000-4000-8000-0000000000a3'),
  'suspended', 'penangguhan admin tidak tertimpa');

-- 4. Upgrade: hanya paket yang ditukar ----------------------------------------
select is(
  (select result from public.activate_free_order(
     '0fee0000-0000-4000-8000-0000000000a4',
     (select id from public.packages where code = 'premium'),
     'upgrade', 'MRV-FREE5', '0fee0000-0000-4000-8000-00000000000a')),
  'activated', 'upgrade gratis berhasil');
select is(
  (select p.code from public.invitations i
     join public.packages p on p.id = i.package_id
     where i.id = '0fee0000-0000-4000-8000-0000000000a4'),
  'premium', 'paket naik ke paket tujuan');
select is(
  (select active_until from public.invitations
     where id = '0fee0000-0000-4000-8000-0000000000a4'),
  '2027-01-15 00:00:00+00'::timestamptz,
  'MASA AKTIF TIDAK BERUBAH pada upgrade');

-- 5. Album Momen: cabang add-on yang sama dengan jalur bayar ------------------
select is(
  (select result from public.activate_free_order(
     '0fee0000-0000-4000-8000-0000000000a5',
     (select id from public.packages where code = 'momen_unlimited'),
     'purchase', 'MRV-FREE6', '0fee0000-0000-4000-8000-00000000000a')),
  'activated', 'Album Momen gratis berhasil');
select ok(
  exists (select 1 from public.momen_albums
            where invitation_id = '0fee0000-0000-4000-8000-0000000000a5'
              and quota_peserta is null and photo_ceiling = 8000),
  'album dibuat dengan kuota tier yang diaktifkan');
-- Cabang add-on selalu menjawab 'activated' (album `on conflict do nothing`),
-- jadi permintaan kedua (dua tab) harus ditolak SEBELUM order dibuat.
select throws_ok(
  $$select * from public.activate_free_order(
      '0fee0000-0000-4000-8000-0000000000a5',
      (select id from public.packages where code = 'momen_unlimited'),
      'purchase', 'MRV-FREE8', '0fee0000-0000-4000-8000-00000000000a')$$,
  'P0001', 'activate_free_order: held',
  'Album Momen kedua untuk undangan yang sama → ditolak');
select is(
  (select count(*)::int from public.orders o
     join public.packages p on p.id = o.package_id
     where o.invitation_id = '0fee0000-0000-4000-8000-0000000000a5'
       and p.kind = 'addon_momen'),
  1, 'tetap SATU order Album Momen — tak ada order Rp0 tanpa efek');

-- 6. Tabrakan kode → pemanggil mencoba lagi -----------------------------------
select is(
  (select result from public.activate_free_order(
     '0fee0000-0000-4000-8000-0000000000a5',
     (select id from public.packages where code = 'premium'),
     'purchase', 'MRV-FREE1', '0fee0000-0000-4000-8000-00000000000a')),
  'order_code_conflict', 'order_code yang sudah ada → order_code_conflict');

-- 7. Batas hak akses ------------------------------------------------------------
select ok(
  not has_function_privilege('authenticated',
    'public.activate_free_order(uuid, uuid, text, text, uuid)', 'execute'),
  'klien tak bisa memanggil RPC ini langsung');
select ok(
  not has_function_privilege('anon',
    'public.activate_free_order(uuid, uuid, text, text, uuid)', 'execute'),
  'anon tak bisa memanggil RPC ini');
-- Seluruh gerbang uang kini bergantung pada `role` yang tak bisa diubah klien.
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'klien tak bisa menulis profiles.role (memberi dirinya Pro/admin)');
-- Sebelum `pro` ada, `role = 'admin'` dan `role <> 'client'` bermakna sama;
-- kini tidak. Kontrol admin lebih dulu: tanpa itu, klaim JWT yang tak terbaca
-- membuat asersi Pro lulus dengan sendirinya.
select set_config('request.jwt.claims',
  '{"sub":"0fee0000-0000-4000-8000-00000000000b"}', true);
select ok(private.is_admin(), 'kontrol: admin tetap admin (is_admin)');
select set_config('request.jwt.claims',
  '{"sub":"0fee0000-0000-4000-8000-00000000000a"}', true);
select ok(not private.is_admin(), 'Pro TIDAK mendapat kuasa admin (is_admin)');

select * from finish();
rollback;
