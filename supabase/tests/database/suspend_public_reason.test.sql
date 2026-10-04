-- Test DB (pgTAP) — `admin_suspend_invitation` dengan alasan publik terpisah.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- KENAPA BERKAS INI ADA: kolom `p_reason` sejak awal ditulis admin UNTUK admin
-- dan hanya pernah mendarat di `admin_logs.detail`. Isinya wajar memuat hal yang
-- tak boleh dibaca pelanggan — nama pelapor, nomor telepon pihak ketiga, dugaan
-- yang belum pasti. Begitu teks semacam itu dipakai sebagai isi email, satu kolom
-- berarti satu-satunya pengaman adalah kehati-hatian admin saat mengetik.
--
-- Yang dijaga di sini ada di LAPISAN DB, tempat batas itu paling sulit dilanggar
-- tanpa sengaja:
--   * kedua teks tercatat di slot JSON masing-masing, tak pernah bertukar;
--   * kunci `public_reason` SELALU ada — termasuk saat kosong. "Tak ada penjelasan
--     publik" adalah fakta yang kelak dipertanyakan bila pelanggan membantah, dan
--     kunci yang hilang tak bisa dibedakan dari kolom yang belum pernah ada;
--   * panggilan 3-argumen (kode aplikasi yang belum ter-deploy) tetap jalan, agar
--     urutan deploy migrasi-dulu-lalu-aplikasi tak pernah menurunkan layanan;
--   * hanya ADA SATU fungsi bernama itu. Membiarkan versi 3-argumen hidup
--     berdampingan membuat panggilan 3-argumen ambigu dan gagal saat dijalankan.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('0d900000-0000-4000-8000-00000000000a', 'pgtap-suspend@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0d900000-0000-4000-8000-0000000000e0', 'pgtap-suspend-tema', 'pgTAP', '{wedding}');
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, active_until)
values
  ('0d900000-0000-4000-8000-0000000000a1', '0d900000-0000-4000-8000-00000000000a',
   '0d900000-0000-4000-8000-0000000000e0', 'pgtap-suspend-a', 'wedding', 'active',
   '2027-01-01 00:00:00+00');

-- 1) Hanya satu fungsi: tak ada ambiguitas overload ---------------------------
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_suspend_invitation'),
  1,
  'hanya ada SATU admin_suspend_invitation (versi 3-argumen sudah di-drop)'
);

-- 2) Panggilan 4-argumen berhasil ---------------------------------------------
select is(
  (select result from public.admin_suspend_invitation(
     '0d900000-0000-4000-8000-0000000000a1',
     '0d900000-0000-4000-8000-00000000000a',
     'RAHASIA: dilaporkan 3 orang, cek 0812-9999-1111',
     'Undangan memuat materi yang melanggar ketentuan kami.')),
  'suspended',
  '4-argumen menangguhkan undangan aktif'
);

select is(
  (select status::text from public.invitations
    where id = '0d900000-0000-4000-8000-0000000000a1'),
  'suspended',
  'statusnya benar-benar berubah'
);

-- 3) Kedua teks tercatat, di slot masing-masing -------------------------------
-- Dibaca lewat `detail ->> 'reason'`, BUKAN lewat urutan `created_at`: `now()`
-- stabil per-transaksi, sehingga dua baris log dalam transaksi yang sama
-- bercap waktu identik dan `order by created_at desc limit 1` tak menentukan.
select is(
  (select detail ->> 'public_reason' from public.admin_logs
    where target_id = '0d900000-0000-4000-8000-0000000000a1'
      and detail ->> 'reason' like 'RAHASIA:%'),
  'Undangan memuat materi yang melanggar ketentuan kami.',
  'alasan publik tercatat di slotnya sendiri'
);

select ok(
  (select detail ->> 'reason' from public.admin_logs
    where target_id = '0d900000-0000-4000-8000-0000000000a1'
      and detail ->> 'public_reason' like 'Undangan memuat%') like 'RAHASIA:%',
  'catatan internal tetap di slot `reason`, tidak bertukar'
);

-- 4) Idempoten: panggilan kedua tak menambah baris log ------------------------
select is(
  (select result from public.admin_suspend_invitation(
     '0d900000-0000-4000-8000-0000000000a1',
     '0d900000-0000-4000-8000-00000000000a',
     'klik kedua', 'tidak seharusnya terkirim')),
  'already_suspended',
  'undangan yang sudah ditangguhkan → already_suspended'
);

select is(
  (select count(*)::int from public.admin_logs
    where target_id = '0d900000-0000-4000-8000-0000000000a1'
      and action = 'invitation.suspend'),
  1,
  'already_suspended tidak menulis baris audit kedua'
);

-- 5) Panggilan 3-argumen (kode lama) tetap jalan ------------------------------
-- Default `null` pada parameter keempat ada DEMI INI: migrasi mendahului deploy,
-- jadi untuk sesaat DB baru dipanggil aplikasi lama.
update public.invitations set status = 'active'
  where id = '0d900000-0000-4000-8000-0000000000a1';
delete from public.admin_logs
  where target_id = '0d900000-0000-4000-8000-0000000000a1';

select is(
  (select result from public.admin_suspend_invitation(
     '0d900000-0000-4000-8000-0000000000a1',
     '0d900000-0000-4000-8000-00000000000a',
     'hanya catatan internal')),
  'suspended',
  '3-argumen masih diterima (DB baru + aplikasi lama)'
);

-- 6) Kunci public_reason ADA meski nilainya null ------------------------------
select ok(
  (select detail ? 'public_reason' from public.admin_logs
    where target_id = '0d900000-0000-4000-8000-0000000000a1'
      and action = 'invitation.suspend')
  and (select detail ->> 'public_reason' is null from public.admin_logs
    where target_id = '0d900000-0000-4000-8000-0000000000a1'
      and action = 'invitation.suspend'),
  'kunci public_reason tetap tercatat dengan nilai null, bukan hilang'
);

select * from finish();
rollback;
