-- Test DB (pgTAP) RPC public.admin_delete_account — DECISIONS #53.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- Yang dijaga di sini bukan "fungsinya jalan", melainkan invarian yang membuat
-- perubahan FK CASCADE → SET NULL ada gunanya: riwayat pesanan HARUS bertahan
-- setelah akunnya hilang. Bila seseorang kelak mengembalikan FK ke CASCADE,
-- test ini yang akan memberi tahu — bukan laporan keuangan yang bolong.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-00000000000a', 'pgtap-del@merriva.test'),
  ('d0000000-0000-4000-8000-00000000000f', 'pgtap-del-admin@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('d0000000-0000-4000-8000-0000000000e0', 'pgtap-del-tema', 'pgTAP', '{wedding}');

insert into public.invitations (id, user_id, theme_id, slug, category, status, active_until) values
  ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-0000000000e0', 'pgtap-del-a', 'wedding', 'active', now() + interval '30 days'),
  ('d0000000-0000-4000-8000-0000000000a2', 'd0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-0000000000e0', 'pgtap-del-b', 'wedding', 'draft', null);

insert into public.guests (invitation_id, name, token) values
  ('d0000000-0000-4000-8000-0000000000a1', 'Tamu pgTAP', 'pgtaptokenhapus1');

insert into public.orders (user_id, invitation_id, package_id, amount_idr, status, order_code, paid_at)
values ('d0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-0000000000a1',
        (select id from public.packages where kind = 'invitation' and is_active limit 1),
        99000, 'paid', 'MRV-PGTDEL', now());

-- 1. Undangan AKTIF menahan penghapusan ----------------------------------------
select is(
  (select result from public.admin_delete_account(
     'd0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000f', 'uji')),
  'has_active', 'undangan aktif menahan penghapusan');
select is(
  (select count(*)::int from public.profiles where id = 'd0000000-0000-4000-8000-00000000000a'),
  1, 'penolakan tak menyentuh profil');
select is(
  (select count(*)::int from public.guests where invitation_id = 'd0000000-0000-4000-8000-0000000000a1'),
  1, 'penolakan tak menyentuh data tamu');

-- 2. Setelah tak ada undangan aktif → penghapusan berjalan ---------------------
update public.invitations
  set status = 'expired', active_until = now()
  where id = 'd0000000-0000-4000-8000-0000000000a1';

select is(
  (select result from public.admin_delete_account(
     'd0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000f', 'permintaan pelanggan')),
  'deleted', 'akun tanpa undangan aktif dihapus');
select is(
  (select count(*)::int from public.profiles where id = 'd0000000-0000-4000-8000-00000000000a'),
  0, 'baris profiles terhapus');
select is(
  (select count(*)::int from public.guests where invitation_id = 'd0000000-0000-4000-8000-0000000000a1'),
  0, 'data tamu terhapus permanen');

-- 3. INVARIAN INTI: riwayat pesanan BERTAHAN ter-anonimisasi -------------------
select is(
  (select count(*)::int from public.orders where order_code = 'MRV-PGTDEL'),
  1, 'baris order BERTAHAN setelah akunnya dihapus');
select ok(
  (select user_id is null from public.orders where order_code = 'MRV-PGTDEL'),
  'orders.user_id dikosongkan oleh FK SET NULL, bukan di-cascade');
select is(
  (select amount_idr from public.orders where order_code = 'MRV-PGTDEL'),
  99000, 'nominalnya utuh — laporan omzet tetap melihat transaksi ini');

-- 4. Kerangka undangan bertahan (menahan FK orders.invitation_id) --------------
select is(
  (select count(*)::int from public.invitations where id = 'd0000000-0000-4000-8000-0000000000a1'),
  1, 'kerangka undangan bertahan');
select ok(
  (select user_id is null and purged_at is not null and content = '{}'::jsonb
     from public.invitations where id = 'd0000000-0000-4000-8000-0000000000a1'),
  'kerangka: tanpa pemilik, ter-purge, isi kosong');

-- 5. Jejak audit & idempotensi -------------------------------------------------
select is(
  (select count(*)::int from public.admin_logs where action = 'user.delete_account'),
  1, 'jejak audit ditulis sebelum profil dihapus');
select is(
  (select result from public.admin_delete_account(
     'd0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000f', 'uji')),
  'not_found', 'memanggil ulang untuk akun yang sudah tiada ditolak');

-- 6. Hardening execute ---------------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.admin_delete_account(uuid, uuid, text)', 'execute'),
  'authenticated TIDAK boleh memanggil RPC hapus akun');

select * from finish();
rollback;
