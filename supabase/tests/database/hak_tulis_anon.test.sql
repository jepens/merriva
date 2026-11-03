-- Test DB (pgTAP) — `anon` tanpa hak tulis, `authenticated` tanpa TRUNCATE
-- (migrasi 20261103112021). Jalankan: `pnpm test:db`.
-- Mandiri: tabel probe dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Yang dijaga adalah GRANT-nya, bukan policy. RLS hari ini memang menolak tulis
-- anon, tetapi grant adalah jaring keduanya, dan TRUNCATE tak tunduk pada RLS
-- sama sekali. Memeriksa grant (bukan mencoba menulis) juga menangkap tabel
-- yang kelak ditambahkan: test ini mengiterasi SELURUH tabel public, dan
-- tabel probe membuktikan default privileges ikut tertutup.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (has_any_column_privilege('anon', c.oid, 'INSERT')
        or has_any_column_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE'))),
  '',
  'anon tak punya hak tulis/TRUNCATE di tabel public mana pun');

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and has_table_privilege('authenticated', c.oid, 'TRUNCATE')),
  '',
  'authenticated tak punya TRUNCATE (TRUNCATE tak tunduk RLS)');

-- Tabel baru tak mewarisinya lagi (default privileges).
create table public.pgtap_probe_hak (id int);
select is(
  has_any_column_privilege('anon', 'public.pgtap_probe_hak', 'INSERT')
    or has_any_column_privilege('anon', 'public.pgtap_probe_hak', 'UPDATE')
    or has_table_privilege('anon', 'public.pgtap_probe_hak', 'DELETE')
    or has_table_privilege('anon', 'public.pgtap_probe_hak', 'TRUNCATE'),
  false,
  'tabel baru tak mewarisi hak tulis anon');
select is(
  has_table_privilege('authenticated', 'public.pgtap_probe_hak', 'TRUNCATE'),
  false,
  'tabel baru tak mewarisi TRUNCATE authenticated');

-- Yang memang dibutuhkan tetap ada: katalog publik terbaca anon.
select ok(
  has_table_privilege('anon', 'public.themes', 'SELECT'),
  'anon tetap bisa membaca katalog tema');

select * from finish();
rollback;
