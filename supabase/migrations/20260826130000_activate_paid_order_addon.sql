-- FASE H — Cabang add-on Album Momen di dalam activate_paid_order (Design A,
-- DECISIONS #22). Order add-on (packages.kind='addon_momen') MEMAKAI-ULANG alur
-- order + webhook + verifyAndActivate + RPC yang sama — TAK ada alur bayar kedua
-- dan verifikasi 2-lapis TIDAK berubah. Perbedaannya hanya di dalam RPC ATOMIK
-- ini: alih-alih mengaktifkan undangan, order add-on lunas membuat album lewat
-- create_momen_album dan TIDAK menyentuh undangan (masa aktif undangan tak
-- berubah). Mengembalikan 'activated' + slug undangan agar pemanggil (webhook/
-- poll) & kuitansi tetap bekerja tanpa perubahan. Idempoten: create_momen_album
-- unique(invitation_id) → webhook duplikat / beli-ulang tak menggandakan album.
--
-- Sisanya identik migrasi 20260729120000 (jalur undangan tak berubah). SECURITY
-- DEFINER + search_path terkunci; execute hanya service_role.
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

  -- Order → paid (+ metode, waktu bayar, payload mentah). Sama untuk kedua jenis.
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
  'Aktivasi order terbayar (webhook Pakasir M3.2 + poll M3.3). Atomik + idempoten (kunci baris order). Cabang pada packages.kind: invitation → undangan active (active_until, published_at); addon_momen → create_momen_album TANPA menyentuh undangan (FASE H). HANYA service_role.';
