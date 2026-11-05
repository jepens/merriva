-- Test DB (pgTAP) — draft milik admin/Pro memakai paket teratas (DECISIONS #115).
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Yang dijaga:
--  · peran yang menentukan adalah peran PEMILIK undangan, bukan pemanggil;
--  · hanya cabang DRAFT (paket NULL) — undangan berpaket tetap mengikuti
--    paketnya walau pemiliknya admin;
--  · penegak sungguhan (trigger kuota foto) ikut membaca angka itu: draft admin
--    menerima foto ke-9 yang ditolak pada draft pelanggan.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('0d840000-0000-4000-8000-00000000000a', 'pgtap-paket-admin@merriva.test'),
  ('0d840000-0000-4000-8000-00000000000b', 'pgtap-paket-pro@merriva.test'),
  ('0d840000-0000-4000-8000-00000000000c', 'pgtap-paket-klien@merriva.test');
update public.profiles set role = 'admin' where id = '0d840000-0000-4000-8000-00000000000a';
update public.profiles set role = 'pro'   where id = '0d840000-0000-4000-8000-00000000000b';

insert into public.themes (id, slug, name, categories) values
  ('0d840000-0000-4000-8000-0000000000e0', 'pgtap-paket-tema', 'pgTAP', '{wedding}');

-- a1: draft admin · a2: draft Pro · a3: draft klien · a4: admin, berpaket Basic
insert into public.invitations (id, user_id, theme_id, slug, category, status, content, package_id)
values
  ('0d840000-0000-4000-8000-0000000000a1', '0d840000-0000-4000-8000-00000000000a',
   '0d840000-0000-4000-8000-0000000000e0', 'pgtap-paket-a1', 'wedding', 'draft', '{}'::jsonb, null),
  ('0d840000-0000-4000-8000-0000000000a2', '0d840000-0000-4000-8000-00000000000b',
   '0d840000-0000-4000-8000-0000000000e0', 'pgtap-paket-a2', 'wedding', 'draft', '{}'::jsonb, null),
  ('0d840000-0000-4000-8000-0000000000a3', '0d840000-0000-4000-8000-00000000000c',
   '0d840000-0000-4000-8000-0000000000e0', 'pgtap-paket-a3', 'wedding', 'draft', '{}'::jsonb, null),
  ('0d840000-0000-4000-8000-0000000000a4', '0d840000-0000-4000-8000-00000000000a',
   '0d840000-0000-4000-8000-0000000000e0', 'pgtap-paket-a4', 'wedding', 'draft', '{}'::jsonb,
   (select id from public.packages where code = 'basic'));

-- Paket teratas sebagaimana dipilih aktivasi gratis.
create temporary table teratas on commit drop as
  select public.normalize_package_limits(p.limits) as lim
  from public.packages p
  where p.is_active and p.kind = 'invitation'
  order by p.price_idr desc, p.code desc limit 1;

select is(public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a1'),
  (select lim from teratas), 'draft ADMIN → batas paket teratas');
select is(public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a2'),
  (select lim from teratas), 'draft PRO → batas paket teratas');
select is(public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a3'),
  public.normalize_package_limits(null), 'draft KLIEN → lantai Basic (tak berubah)');
select is(public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a4'),
  public.normalize_package_limits((select limits from public.packages where code = 'basic')),
  'undangan admin BERPAKET Basic → paketnya sendiri, bukan teratas');

select is((public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a1') ->> 'watermark')::boolean,
  false, 'draft admin: tanpa watermark (kunci Premium di Tampilan terbuka)');
select is((public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a1') ->> 'youtube')::boolean,
  true, 'draft admin: fitur video terbuka');

-- Penegak sungguhan: trigger kuota foto pada INSERT langsung ------------------
-- `storage_path` wajib `inv/<invitation_id>/<id>` (constraint 20261103045611).
insert into public.media (id, invitation_id, storage_path, width, height)
  select g, '0d840000-0000-4000-8000-0000000000a1',
         'inv/0d840000-0000-4000-8000-0000000000a1/' || g::text, 1600, 1200
  from (select gen_random_uuid() as g from generate_series(1, 9)) s;
select is((select count(*)::int from public.media where invitation_id = '0d840000-0000-4000-8000-0000000000a1'),
  9, 'draft admin menerima foto ke-9 (Basic berhenti di 8)');

insert into public.media (id, invitation_id, storage_path, width, height)
  select g, '0d840000-0000-4000-8000-0000000000a3',
         'inv/0d840000-0000-4000-8000-0000000000a3/' || g::text, 1600, 1200
  from (select gen_random_uuid() as g from generate_series(1, 8)) s;
select throws_ok(
  $$insert into public.media (id, invitation_id, storage_path, width, height)
    values ('0d840000-0000-4000-8000-0000000000f9', '0d840000-0000-4000-8000-0000000000a3',
            'inv/0d840000-0000-4000-8000-0000000000a3/0d840000-0000-4000-8000-0000000000f9', 1600, 1200)$$,
  '23514', null,
  'draft klien tetap ditolak di foto ke-9 (check_violation)');

-- Sebagai PEMANGGIL sungguhan (role authenticated + JWT), bukan superuser ----
-- Di bawah superuser `auth.uid()` NULL, jadi mutasi "peran PEMANGGIL"
-- (`... or private.is_admin()`) lolos tanpa blok ini. Ekspektasi dihitung
-- inline: temp table milik postgres tak terbaca role authenticated.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d840000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select is(public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a3'),
  public.normalize_package_limits(null),
  'ADMIN membuka draft PELANGGAN → tetap Basic (peran pemilik, bukan pemanggil)');
select is(public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a1'),
  (select public.normalize_package_limits(p.limits) from public.packages p
     where p.is_active and p.kind = 'invitation'
     order by p.price_idr desc, p.code desc limit 1),
  'admin pemilik → teratas (peran terbaca lewat RLS profiles_select)');

select set_config('request.jwt.claims',
  '{"sub":"0d840000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select is((public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a2') ->> 'watermark')::boolean,
  false, 'Pro pemilik → teratas lewat RLS (tanpa watermark)');

select set_config('request.jwt.claims',
  '{"sub":"0d840000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select is(public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a3'),
  public.normalize_package_limits(null), 'klien pemilik → lantai Basic');
reset role;

-- Pemilik tanpa profil (akun terhapus → user_id NULL) → lantai Basic.
update public.invitations set user_id = null where id = '0d840000-0000-4000-8000-0000000000a2';
select is(public.invitation_effective_limits('0d840000-0000-4000-8000-0000000000a2'),
  public.normalize_package_limits(null), 'draft tanpa pemilik → lantai Basic');

select * from finish();
rollback;
