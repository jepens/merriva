-- AUDIT-2026-10-01 B3 — upgrade paket di tengah masa aktif (bayar SELISIH).
--
-- Keputusan pemilik (2026-10-04): Basic → Premium membayar selisih harga, dan
-- masa aktif TIDAK di-reset. Itu berarti ada jenis order ketiga yang jalur
-- uangnya sama tetapi EFEKNYA berbeda dari dua yang sudah ada:
--
--   purchase + kind=invitation   → undangan active, active_until dihitung ulang
--   purchase + kind=addon_momen  → album dibuat, undangan tak disentuh
--   upgrade  + kind=invitation   → package_id ditukar, SISANYA tak disentuh
--
-- `packages.kind` saja tak bisa membedakan yang ketiga: paket tujuannya adalah
-- paket undangan biasa (`premium`), dan HARUS tetap begitu — `orders.package_id`
-- dipakai kuitansi, riwayat pesanan, dan `invitations.package_id`. Membuat baris
-- `packages` semu "upgrade_basic_premium" akan membekukan selisih harga di dalam
-- katalog (basi begitu harga paket berubah) dan memaksa indireksi untuk
-- menemukan paket tujuannya. Karena itu penandanya kolom pada ORDER, bukan paket.
--
-- Kolom ber-default: baris lama = 'purchase', jadi tak ada perilaku yang berubah
-- untuk order yang sudah ada.
alter table public.orders
  add column if not exists purpose text not null default 'purchase'
    check (purpose in ('purchase', 'upgrade'));

comment on column public.orders.purpose is
  'purchase = membeli masa aktif (aktivasi/perpanjangan) atau add-on; upgrade = hanya menukar package_id undangan yang SUDAH aktif, nominalnya selisih harga dan masa aktif tak berubah (AUDIT-2026-10-01 B3). Query pemakaian-ulang order pending WAJIB memfilter kolom ini: order upgrade dan order aktivasi punya nominal berbeda untuk paket yang sama.';

-- Pemakaian-ulang order `pending` (per invitation_id + package_id + status +
-- purpose) dipanggil di setiap checkout. Jumlah order per undangan sedikit,
-- tetapi indeks ini juga melayani pencarian order lunas terakhir pada refund.
create index if not exists orders_invitation_purpose_idx
  on public.orders (invitation_id, purpose, status);

-- === activate_paid_order — cabang ketiga ===
--
-- Sisanya identik migrasi 20260826130000 (jalur purchase tak berubah sedikit
-- pun). SECURITY DEFINER + search_path terkunci; execute hanya service_role.
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
    -- Dua syarat pada WHERE, keduanya menahan uang yang sudah masuk agar tak
    -- berubah menjadi layanan yang salah:
    --  * `status = 'active'` — undangan yang kedaluwarsa atau ditangguhkan saat
    --    pembayaran masih berjalan tak boleh ditukar paketnya: Premium tanpa
    --    masa aktif tak bernilai, dan menimpa suspend akan membatalkan moderasi
    --    admin lewat jalur pembayaran.
    --  * `package_id is distinct from` — paketnya sudah menjadi paket tujuan
    --    (mis. undangan kedaluwarsa lalu DIPERPANJANG dengan Premium sementara
    --    order upgrade masih menggantung). Menukarnya jadi no-op senyap:
    --    pelanggan membayar selisih untuk sesuatu yang sudah dimilikinya.
    -- Keduanya jatuh ke 'held' → order TETAP `paid` dan menunggu manusia
    -- (refund atau perpanjangan manual), bukan hilang tanpa jejak.
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

  -- === Jalur UNDANGAN (tidak berubah dari 20260729120000) ===
  -- Undangan → active HANYA bila statusnya dapat-diaktifkan. JANGAN menimpa
  -- moderasi admin 'suspended'. `returning` dikualifikasi (hindari tabrakan OUT).
  update public.invitations
    set status = 'active',
        package_id = v_order.package_id,
        active_until = v_now + (coalesce(v_duration, 6) || ' months')::interval,
        published_at = coalesce(published_at, v_now),
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
  'Aktivasi order terbayar (webhook Pakasir M3.2 + poll M3.3). Atomik + idempoten (kunci baris order). Tiga cabang: purpose=upgrade → HANYA tukar package_id undangan active (B3); kind=addon_momen → create_momen_album tanpa menyentuh undangan (FASE H); sisanya → undangan active (active_until, published_at). HANYA service_role.';

-- === admin_refund_order — cabang upgrade ===
--
-- Tanpa cabang ini refund order upgrade berakhir di cabang undangan, menemukan
-- order aktivasi yang masih lunas, dan menyimpulkan `refunded_still_paid` —
-- benar bahwa undangan tak boleh dicabut, tetapi `package_id` tetap di paket
-- yang BARU SAJA dikembalikan uangnya. Pelanggan dapat uangnya kembali dan
-- tetap memegang Premium; tak ada galat di mana pun.
create or replace function public.admin_refund_order(
  p_order_code text,
  p_admin_id uuid,
  p_reason text
) returns table (result text, slug text, inv_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_kind text;
  v_slug text;
  v_sisa int;
  v_prev uuid;
  v_result text;
begin
  -- Kunci barisnya: webhook & cron rekonsiliasi menyentuh order yang sama.
  select * into v_order from public.orders
    where order_code = p_order_code for update;
  if not found then
    return query select 'not_found'::text, null::text, null::uuid;
    return;
  end if;

  -- Hanya order LUNAS yang bisa dikembalikan. 'pending' dibatalkan lewat cron
  -- expire-orders, bukan di sini; 'refunded' berarti sudah pernah diproses dan
  -- memprosesnya lagi akan menulis jejak audit ganda.
  if v_order.status <> 'paid' then
    return query select ('not_paid:' || v_order.status)::text, null::text,
      v_order.invitation_id;
    return;
  end if;

  select p.kind into v_kind from public.packages p where p.id = v_order.package_id;
  select i.slug into v_slug from public.invitations i where i.id = v_order.invitation_id;

  update public.orders set status = 'refunded' where id = v_order.id;

  if v_order.purpose = 'upgrade' then
    -- Yang dibeli order upgrade adalah KENAIKAN PAKET, bukan masa aktifnya:
    -- masa aktif dibayar order lain dan tak boleh ikut dicabut. Paket diturunkan
    -- ke paket order undangan lunas TERAKHIR selain ini — bukan ke paket
    -- termurah: bila pelanggan sudah memperpanjang dengan Premium setelah
    -- upgrade, Premium memang miliknya dan refund ini tak boleh mencabutnya.
    select o.package_id into v_prev
      from public.orders o
      join public.packages p on p.id = o.package_id
      where o.invitation_id = v_order.invitation_id
        and o.id <> v_order.id
        and o.status = 'paid'
        and p.kind = 'invitation'
      order by o.paid_at desc nulls last, o.created_at desc
      limit 1;

    -- v_prev NULL (mis. undangan diaktifkan manual admin tanpa order) →
    -- package_id dikosongkan. `resolveLimits` memperlakukan paket kosong sebagai
    -- lantai Basic, jadi arahnya aman: layanan yang dikembalikan uangnya dicabut,
    -- dan masa aktif pemberian admin tetap utuh.
    update public.invitations
      set package_id = v_prev, updated_at = now()
      where id = v_order.invitation_id;
    v_result := 'refunded_downgraded';

  elsif v_kind = 'addon_momen' then
    -- Yang dibeli add-on adalah ALBUMNYA, bukan undangannya. Mencabut undangan
    -- di sini akan mematikan layanan yang tak pernah dikembalikan uangnya.
    update public.momen_albums a
      set status = 'archived'
      where a.invitation_id = v_order.invitation_id and a.status = 'active';
    v_result := 'refunded_album_archived';

  else
    -- Undangan hanya dicabut bila TIDAK ADA order undangan lunas lain yang
    -- masih menopangnya. Pelanggan yang membayar aktivasi lalu memperpanjang,
    -- dan hanya salah satunya direfund, tak boleh kehilangan keduanya.
    -- Order upgrade DIKECUALIKAN dari hitungan: ia tak pernah membeli masa
    -- aktif, jadi keberadaannya tak boleh membuat undangan tampak masih
    -- tertopang saat aktivasi satu-satunya justru yang direfund.
    select count(*)::int into v_sisa
      from public.orders o
      join public.packages p on p.id = o.package_id
      where o.invitation_id = v_order.invitation_id
        and o.id <> v_order.id
        and o.status = 'paid'
        and o.purpose = 'purchase'
        and p.kind <> 'addon_momen';

    if v_sisa > 0 then
      v_result := 'refunded_still_paid';
    else
      -- `active_until = now()` disetel bersama statusnya agar datanya koheren:
      -- `admin_reinstate_invitation` memulihkan status DARI active_until, jadi
      -- meninggalkannya di masa depan akan menghidupkan undangan ini lagi.
      update public.invitations
        set status = 'expired', active_until = now(), updated_at = now()
        where id = v_order.invitation_id
          and status in ('active', 'suspended');
      v_result := 'refunded_revoked';
    end if;
  end if;

  insert into public.admin_logs (
    admin_id, action, target_type, target_id, detail
  ) values (
    p_admin_id, 'order.refund', 'order', v_order.id,
    jsonb_build_object(
      'order_code', p_order_code,
      'amount_idr', v_order.amount_idr,
      'package_kind', v_kind,
      'purpose', v_order.purpose,
      'reason', p_reason,
      'outcome', v_result
    )
  );

  return query select v_result, v_slug, v_order.invitation_id;
end;
$$;

comment on function public.admin_refund_order(text, uuid, text) is
  'Tandai order lunas sebagai refunded DAN cabut layanan yang dibeli, atomik beserta admin_logs (AUDIT-2026-10-01 A3). purpose=upgrade → package_id turun ke paket order lunas sebelumnya, masa aktif tak disentuh (B3); addon_momen → album archived; invitation → undangan expired bila tak ada order purchase lunas lain yang menopang. Uang digerakkan terpisah di dashboard Pakasir. HANYA service_role.';

revoke execute on function public.admin_refund_order(text, uuid, text)
  from anon, authenticated, public;

grant execute on function public.admin_refund_order(text, uuid, text)
  to service_role;
