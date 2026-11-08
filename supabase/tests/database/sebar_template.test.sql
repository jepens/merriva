-- Test DB (pgTAP) — template pesan Sebar tersimpan per undangan
-- (migrasi 20261108100000, DECISIONS #120).
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Dijalankan sebagai PEMILIK sungguhan (role authenticated + JWT), jalur yang
-- sama dengan Server Action: GRANT kolom + RLS `invitations_update`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('0d870000-0000-4000-8000-00000000000a', 'pgtap-sebar-a@merriva.test'),
  ('0d870000-0000-4000-8000-00000000000b', 'pgtap-sebar-b@merriva.test');

insert into public.invitations (id, user_id, theme_id, slug, category, status, content) values
  ('0d870000-0000-4000-8000-0000000000a1', '0d870000-0000-4000-8000-00000000000a',
   (select id from public.themes order by slug limit 1), 'pgtap-sebar-a1', 'wedding', 'active', '{}'),
  ('0d870000-0000-4000-8000-0000000000b1', '0d870000-0000-4000-8000-00000000000b',
   (select id from public.themes order by slug limit 1), 'pgtap-sebar-b1', 'wedding', 'active', '{}');

-- Retensi UU PDP: template bisa memuat nama keluarga / nomor HP pengirim →
-- purge (jalur cron & hapus akun) WAJIB mengosongkannya.
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, content, share_template, share_template_general)
values
  ('0d870000-0000-4000-8000-0000000000a2', '0d870000-0000-4000-8000-00000000000a',
   (select id from public.themes order by slug limit 1), 'pgtap-sebar-a2', 'wedding', 'expired', '{}',
   'Hormat kami, Kel. Sucipto 0812-0000 {link}', 'Kel. Sucipto {link}');
select is(
  (select result from public.purge_invitation_data('0d870000-0000-4000-8000-0000000000a2')),
  'purged', 'undangan kedaluwarsa ter-purge');
select ok(
  (select share_template is null and share_template_general is null
     from public.invitations where id = '0d870000-0000-4000-8000-0000000000a2'),
  'purge mengosongkan kedua template Sebar');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d870000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

-- 1. Pemilik bisa menyimpan template undangannya sendiri.
select lives_ok(
  $$update public.invitations
      set share_template = 'Halo {nama} {link}', share_template_general = 'Halo {link}'
    where id = '0d870000-0000-4000-8000-0000000000a1'$$,
  'pemilik menyimpan template personal & umum');

-- 2. Isinya benar-benar tersimpan.
select is(
  (select share_template from public.invitations where id = '0d870000-0000-4000-8000-0000000000a1'),
  'Halo {nama} {link}',
  'template personal tersimpan');

-- 3. Undangan orang lain: RLS → 0 baris (diam-diam), nilainya tak berubah.
update public.invitations set share_template = 'retas {link}'
  where id = '0d870000-0000-4000-8000-0000000000b1';
reset role;
select is(
  (select share_template from public.invitations where id = '0d870000-0000-4000-8000-0000000000b1'),
  null,
  'template undangan orang lain tak bisa ditulis (RLS)');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d870000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

-- 4. GRANT kolom baru TIDAK membuka kolom lifecycle (allowlist tetap ketat).
select throws_ok(
  $$update public.invitations set status = 'draft'
    where id = '0d870000-0000-4000-8000-0000000000a1'$$,
  '42501', null,
  'kolom status tetap tak bisa ditulis pemilik');

-- 5. CHECK panjang ≤ 2.000 karakter.
select throws_ok(
  $$update public.invitations set share_template = repeat('x', 2001)
    where id = '0d870000-0000-4000-8000-0000000000a1'$$,
  '23514', null,
  'template > 2.000 karakter ditolak CHECK');

-- 6. NULL (kembali ke bawaan) diterima.
select lives_ok(
  $$update public.invitations set share_template = null
    where id = '0d870000-0000-4000-8000-0000000000a1'$$,
  'template bisa dikembalikan ke bawaan (NULL)');

-- 7. anon tak bisa menulis sama sekali.
reset role;
set local role anon;
select throws_ok(
  $$update public.invitations set share_template = 'x {link}'
    where id = '0d870000-0000-4000-8000-0000000000a1'$$,
  '42501', null,
  'anon tak bisa menulis template');

select * from finish();
rollback;
