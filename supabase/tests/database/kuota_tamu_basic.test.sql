-- Test DB (pgTAP) — kuota tamu Basic 500 (migrasi 20261105140000).
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Yang dijaga BUKAN hanya angkanya, tetapi bahwa draft dan Basic berbayar
-- membaca angka yang SAMA, dan bahwa penegaknya (trigger `enforce_guest_limit`)
-- benar-benar memakai angka itu: tamu ke-151 kini masuk, tamu ke-501 ditolak.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Lantai murni ------------------------------------------------------------------
select is((public.normalize_package_limits(null) ->> 'max_guests')::int, 500,
  'draft (limits NULL) → lantai 500');
select is((public.normalize_package_limits('{"max_guests": 0}') ->> 'max_guests')::int, 500,
  'max_guests rusak → lantai 500, BUKAN tanpa batas');
select is(public.normalize_package_limits('{"max_guests": null}') -> 'max_guests', 'null'::jsonb,
  'JSON null eksplisit tetap tanpa batas (Premium)');
select is((public.normalize_package_limits('{"max_guests": 1000}') ->> 'max_guests')::int, 1000,
  'angka eksplisit paket dihormati apa adanya');

-- Baris paket -----------------------------------------------------------------
select is((select (limits ->> 'max_guests')::int from public.packages where code = 'basic'), 500,
  'paket Basic = 500');
select is((select limits -> 'max_guests' from public.packages where code = 'premium'), 'null'::jsonb,
  'paket Premium tetap tanpa batas');

-- Penegak sungguhan: trigger pada INSERT langsung, draft tanpa paket ------------
insert into auth.users (id, email) values
  ('0d830000-0000-4000-8000-00000000000a', 'pgtap-kuota@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0d830000-0000-4000-8000-0000000000e0', 'pgtap-kuota-tema', 'pgTAP', '{wedding}');
insert into public.invitations (id, user_id, theme_id, slug, category, status, content)
values ('0d830000-0000-4000-8000-0000000000a1', '0d830000-0000-4000-8000-00000000000a',
        '0d830000-0000-4000-8000-0000000000e0', 'pgtap-kuota-a', 'wedding', 'draft', '{}'::jsonb);

insert into public.guests (invitation_id, name, token)
  select '0d830000-0000-4000-8000-0000000000a1', 'Tamu ' || n, 'pgtapkuota' || lpad(n::text, 6, '0')
  from generate_series(1, 500) as n;

select is((select count(*)::int from public.guests where invitation_id = '0d830000-0000-4000-8000-0000000000a1'), 500,
  'draft menerima 500 tamu (dulu berhenti di 150)');
select throws_ok(
  $$insert into public.guests (invitation_id, name, token)
    values ('0d830000-0000-4000-8000-0000000000a1', 'Tamu 501', 'pgtapkuota000501')$$,
  '23514', 'Batas tamu paket tercapai (maks 500).',
  'tamu ke-501 ditolak trigger kuota (check_violation, maks 500)');

select * from finish();
rollback;
