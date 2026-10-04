-- Test DB (pgTAP) — `reminder_sent_at` di `activate_paid_order`.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- KENAPA BERKAS INI ADA: baris `reminder_sent_at = null` sudah HILANG DUA KALI
-- dari fungsi ini — sekali saat FASE H membuatnya ulang untuk cabang add-on
-- (20260826130000), sekali lagi saat B3 membuatnya ulang untuk cabang upgrade
-- (20261004130000). Keduanya lolos review, typecheck, dan seluruh unit test,
-- karena tak ada satu pun yang menyentuhnya.
--
-- Akibat hilangnya: cron `expiry-reminders` menyaring `.is("reminder_sent_at",
-- null)`, jadi undangan yang pernah diperingatkan lalu DIPERPANJANG membawa
-- penanda lama selamanya dan tak pernah diperingatkan lagi. Masa aktifnya habis
-- tanpa satu pun email — pada pelanggan yang justru sudah terbukti mau membayar.
--
-- Yang diuji di sini adalah ASIMETRI-nya, dan itu yang mudah salah: perpanjangan
-- MERESET (siklus baru), upgrade TIDAK (masa aktif tak berubah, jadi pengingat
-- siklus berjalan masih sah dan me-reset-nya akan mengirim pengingat kedua).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('0c500000-0000-4000-8000-00000000000a', 'pgtap-reminder@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0c500000-0000-4000-8000-0000000000e0', 'pgtap-reminder-tema', 'pgTAP', '{wedding}');

-- Semua ber-`reminder_sent_at` TERISI: itu keadaan yang membedakan hasilnya.
-- A: kedaluwarsa → diperpanjang · B: aktif → di-upgrade
-- C: aktif → beli add-on       · D: ditangguhkan → order lunas tetapi `held`
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, package_id, active_until,
   published_at, reminder_sent_at)
values
  ('0c500000-0000-4000-8000-0000000000a1', '0c500000-0000-4000-8000-00000000000a',
   '0c500000-0000-4000-8000-0000000000e0', 'pgtap-rmn-a', 'wedding', 'expired',
   (select id from public.packages where code = 'basic'),
   '2026-09-30 00:00:00+00', '2026-03-01 00:00:00+00', '2026-09-16 00:00:00+00'),
  ('0c500000-0000-4000-8000-0000000000a2', '0c500000-0000-4000-8000-00000000000a',
   '0c500000-0000-4000-8000-0000000000e0', 'pgtap-rmn-b', 'wedding', 'active',
   (select id from public.packages where code = 'basic'),
   '2027-01-15 00:00:00+00', '2026-09-01 00:00:00+00', '2026-09-16 00:00:00+00'),
  ('0c500000-0000-4000-8000-0000000000a3', '0c500000-0000-4000-8000-00000000000a',
   '0c500000-0000-4000-8000-0000000000e0', 'pgtap-rmn-c', 'wedding', 'active',
   (select id from public.packages where code = 'basic'),
   '2027-01-15 00:00:00+00', '2026-09-01 00:00:00+00', '2026-09-16 00:00:00+00'),
  ('0c500000-0000-4000-8000-0000000000a4', '0c500000-0000-4000-8000-00000000000a',
   '0c500000-0000-4000-8000-0000000000e0', 'pgtap-rmn-d', 'wedding', 'suspended',
   (select id from public.packages where code = 'basic'),
   '2027-01-15 00:00:00+00', '2026-09-01 00:00:00+00', '2026-09-16 00:00:00+00');

insert into public.orders
  (user_id, invitation_id, package_id, amount_idr, status, order_code, purpose)
values
  ('0c500000-0000-4000-8000-00000000000a', '0c500000-0000-4000-8000-0000000000a1',
   (select id from public.packages where code = 'basic'), 99000, 'pending',
   'MRV-RMNA1', 'purchase'),
  ('0c500000-0000-4000-8000-00000000000a', '0c500000-0000-4000-8000-0000000000a2',
   (select id from public.packages where code = 'premium'), 100000, 'pending',
   'MRV-RMNB1', 'upgrade'),
  ('0c500000-0000-4000-8000-00000000000a', '0c500000-0000-4000-8000-0000000000a3',
   (select id from public.packages where kind = 'addon_momen' and code = 'momen_50'),
   199000, 'pending', 'MRV-RMNC1', 'purchase'),
  ('0c500000-0000-4000-8000-00000000000a', '0c500000-0000-4000-8000-0000000000a4',
   (select id from public.packages where code = 'basic'), 99000, 'pending',
   'MRV-RMND1', 'purchase');

-- 1. PERPANJANGAN berbayar → penanda DIBERSIHKAN -------------------------------
select is(
  (select result from public.activate_paid_order(
     'MRV-RMNA1', 99000, 'qris', now(), '{}'::jsonb)),
  'activated', 'perpanjangan berbayar mengaktifkan kembali');
select is(
  (select reminder_sent_at from public.invitations
     where id = '0c500000-0000-4000-8000-0000000000a1'),
  null::timestamptz,
  'SIKLUS BARU: reminder_sent_at dibersihkan — tanpa ini pengingat H-14 berikutnya tak pernah terkirim');
select ok(
  (select active_until > now() from public.invitations
     where id = '0c500000-0000-4000-8000-0000000000a1'),
  'masa aktif memang dimajukan (penanda dibersihkan karena SIKLUSNYA baru)');

-- 2. UPGRADE → penanda TETAP ---------------------------------------------------
-- Masa aktif tidak berubah, jadi pengingat siklus yang sedang berjalan masih
-- sah. Me-reset-nya akan mengirim pengingat KEDUA untuk periode yang sama.
select is(
  (select result from public.activate_paid_order(
     'MRV-RMNB1', 100000, 'qris', now(), '{}'::jsonb)),
  'activated', 'upgrade lunas menukar paket');
select is(
  (select reminder_sent_at from public.invitations
     where id = '0c500000-0000-4000-8000-0000000000a2'),
  '2026-09-16 00:00:00+00'::timestamptz,
  'upgrade TIDAK menyentuh penanda pengingat');

-- 3. ADD-ON → undangan tak disentuh sama sekali --------------------------------
select is(
  (select result from public.activate_paid_order(
     'MRV-RMNC1', 199000, 'qris', now(), '{}'::jsonb)),
  'activated', 'add-on Album Momen lunas membuat album');
select is(
  (select reminder_sent_at from public.invitations
     where id = '0c500000-0000-4000-8000-0000000000a3'),
  '2026-09-16 00:00:00+00'::timestamptz,
  'add-on: baris undangan tak disentuh, termasuk penanda pengingat');

-- 4. `held` (ditangguhkan) → penanda TETAP -------------------------------------
-- Order menjadi `paid` tetapi undangan tidak dipublikasikan ulang; tak ada
-- siklus baru, jadi tak ada yang perlu dibersihkan.
select is(
  (select reminder_sent_at from public.invitations
     where id = '0c500000-0000-4000-8000-0000000000a4'),
  '2026-09-16 00:00:00+00'::timestamptz,
  'undangan ditangguhkan: penanda tak disentuh meski ordernya lunas');

select * from finish();
rollback;
