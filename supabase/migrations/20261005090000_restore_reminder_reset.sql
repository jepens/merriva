-- Pulihkan `reminder_sent_at = null` pada aktivasi/perpanjangan BERBAYAR.
--
-- REGRESI YANG SUDAH HIDUP, ditemukan saat merancang peringatan pra-purge (B7).
-- Riwayatnya:
--   20260730130000  menambahkan reset-nya ke `activate_paid_order` ("siklus
--                   aktif baru → pengingat H-14 baru");
--   20260826130000  (FASE H) MEMBUAT ULANG fungsi itu untuk cabang add-on dan
--                   menjatuhkan barisnya;
--   20261004130000  (B3, upgrade paket) membuat ulang lagi dan meneruskan
--                   kelalaian yang sama.
-- Diverifikasi di DB produksi: `activate_paid_order` tak memuat
-- `reminder_sent_at` sama sekali, sementara `admin_extend_invitation` masih.
--
-- AKIBATNYA, pada pelanggan yang justru paling berharga — yang MEMPERPANJANG:
-- cron `expiry-reminders` menyaring `.is("reminder_sent_at", null)`, jadi
-- undangan yang pernah diperingatkan lalu diperpanjang membawa penanda lama
-- selamanya dan TIDAK PERNAH diperingatkan lagi. Masa aktifnya habis tanpa satu
-- pun email, dan tak ada galat di mana pun. `docs/ARCHITECTURE.md` selama ini
-- menjanjikan "di-reset saat perpanjangan" — janji yang sudah tidak benar.
--
-- Kenapa ini bisa hilang DUA KALI: tak ada satu pun test yang menyentuhnya.
-- `supabase/tests/database/reminder_reset.test.sql` dibuat bersama migrasi ini
-- supaya pembuatan-ulang berikutnya memerahkan CI, bukan diam.
--
-- Sisanya identik 20261004130000.
create or replace function public.activate_paid_order(
  p_order_code text,
  p_amount int,
  p_payment_method text,
  p_paid_at timestamptz,
  p_raw jsonb
) returns table (result text, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_duration int;
  v_kind text;
  v_limits jsonb;
  v_slug text;
  v_now timestamptz := now();
begin
  -- Kunci baris order → serialisasi webhook duplikat (idempotensi ras-aman).
  select * into v_order
    from public.orders
    where order_code = p_order_code
    for update;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  -- Idempoten: sudah diproses → kembalikan slug, JANGAN proses ulang.
  if v_order.status = 'paid' then
    select i.slug into v_slug
      from public.invitations i
      where i.id = v_order.invitation_id;
    return query select 'already_paid'::text, v_slug;
    return;
  end if;

  -- Hanya order `pending` dengan amount cocok yang boleh diproses.
  if v_order.status <> 'pending' or v_order.amount_idr <> p_amount then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  -- Order → paid (+ metode, waktu bayar, payload mentah). Sama untuk semua jenis.
  update public.orders
    set status = 'paid',
        payment_method = p_payment_method,
        paid_at = coalesce(p_paid_at, v_now),
        raw_notification = p_raw
    where id = v_order.id;

  -- Jenis paket menentukan cabang: add-on Album Momen vs masa-aktif undangan.
  select p.kind, p.duration_months, p.limits
    into v_kind, v_duration, v_limits
    from public.packages p
    where p.id = v_order.package_id;

  -- === Jalur UPGRADE (B3) ===
  -- Diperiksa SEBELUM `kind` karena yang membedakannya memang bukan paketnya:
  -- paket tujuan upgrade adalah paket undangan biasa.
  if v_order.purpose = 'upgrade' then
    -- HANYA package_id. `active_until`, `published_at`, dan `status` tak
    -- disentuh — itu inti kesepakatannya: pelanggan membayar selisih untuk SISA
    -- masa aktif yang sama, bukan periode baru.
    --
    -- `reminder_sent_at` SENGAJA TIDAK di-reset di sini: masa aktifnya tidak
    -- berubah, jadi pengingat H-14 untuk siklus yang sedang berjalan tetap
    -- berlaku. Me-reset-nya akan mengirim pengingat KEDUA untuk periode yang
    -- sama.
    update public.invitations
      set package_id = v_order.package_id,
          updated_at = v_now
      where id = v_order.invitation_id
        and status = 'active'
        and package_id is distinct from v_order.package_id
      returning invitations.slug into v_slug;

    if found then
      return query select 'activated'::text, v_slug;
      return;
    end if;

    select i.slug into v_slug
      from public.invitations i
      where i.id = v_order.invitation_id;
    return query select 'held'::text, v_slug;
    return;
  end if;

  if v_kind = 'addon_momen' then
    -- Add-on: JANGAN sentuh undangan (sudah aktif; masa aktif tak berubah). Buat
    -- album (idempoten). Kuota peserta & plafon foto dibaca dari limits paket
    -- (quota_peserta null → tak terbatas; photo_ceiling hanya tier ∞).
    perform public.create_momen_album(
      v_order.invitation_id,
      nullif(v_limits ->> 'quota_peserta', '')::int,
      nullif(v_limits ->> 'photo_ceiling', '')::int,
      'hangat'
    );
    select i.slug into v_slug
      from public.invitations i
      where i.id = v_order.invitation_id;
    return query select 'activated'::text, v_slug;
    return;
  end if;

  -- === Jalur UNDANGAN ===
  -- Undangan → active HANYA bila statusnya dapat-diaktifkan. JANGAN menimpa
  -- moderasi admin 'suspended'. `returning` dikualifikasi (hindari tabrakan OUT).
  update public.invitations
    set status = 'active',
        package_id = v_order.package_id,
        active_until = v_now + (coalesce(v_duration, 6) || ' months')::interval,
        published_at = coalesce(published_at, v_now),
        -- SIKLUS AKTIF BARU → pengingat H-14 baru. Baris inilah yang hilang dua
        -- kali; `active_until` dimajukan di sini, jadi penanda siklus lama HARUS
        -- ikut dibersihkan atau pengingat berikutnya tak akan pernah terkirim.
        reminder_sent_at = null,
        updated_at = v_now
    where id = v_order.invitation_id
      and status in ('draft', 'pending_payment', 'expired')
    returning invitations.slug into v_slug;

  if found then
    return query select 'activated'::text, v_slug;
    return;
  end if;

  -- Tak dapat diaktifkan (suspended / sudah active). Order TETAP `paid` tetapi
  -- undangan TIDAK dipublikasikan ulang — reinstate oleh admin.
  select i.slug into v_slug
    from public.invitations i
    where i.id = v_order.invitation_id;
  return query select 'held'::text, v_slug;
end;
$$;

-- create-or-replace mempertahankan ACL; re-grant idempoten demi kejelasan.
revoke execute on function
  public.activate_paid_order(text, int, text, timestamptz, jsonb)
  from anon, authenticated, public;
grant execute on function
  public.activate_paid_order(text, int, text, timestamptz, jsonb)
  to service_role;

comment on function
  public.activate_paid_order(text, int, text, timestamptz, jsonb) is
  'Aktivasi order terbayar (webhook Pakasir M3.2 + poll M3.3). Atomik + idempoten (kunci baris order). Tiga cabang: purpose=upgrade → HANYA tukar package_id undangan active, reminder_sent_at TIDAK di-reset (masa aktif tak berubah); kind=addon_momen → create_momen_album tanpa menyentuh undangan; sisanya → undangan active (active_until, published_at, reminder_sent_at=null). HANYA service_role.';
