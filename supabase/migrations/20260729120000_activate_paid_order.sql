-- M3.2 — Aktivasi order terbayar (webhook Pakasir). ATOMIK dalam SATU transaksi:
-- kunci baris order, tandai `paid`, lalu aktifkan undangan (status `active`,
-- active_until = now + durasi paket, published_at diisi sekali). Idempoten:
-- webhook duplikat / order sudah `paid` → tidak menggandakan aktivasi.
--
-- KEAMANAN (kritis): HANYA dipanggil server (service_role) dari handler webhook
-- SETELAH verifikasi otoritatif ke `transactiondetail` (webhook Pakasir TANPA
-- signature → payload = sinyal, bukan bukti). Execute DICABUT dari anon/
-- authenticated/public → klien TAK BISA memanggil untuk mengaktifkan sendiri
-- tanpa bayar. Amount dicek ULANG di DB (defense-in-depth di atas cek handler).
-- SECURITY DEFINER + search_path terkunci (pola harden_functions).

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

  -- Idempoten: sudah diproses → kembalikan slug, JANGAN aktifkan ulang.
  if v_order.status = 'paid' then
    select i.slug into v_slug
      from public.invitations i
      where i.id = v_order.invitation_id;
    return query select 'already_paid'::text, v_slug;
    return;
  end if;

  -- Hanya order `pending` dengan amount cocok yang boleh diaktifkan.
  if v_order.status <> 'pending' or v_order.amount_idr <> p_amount then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  -- Order → paid (+ metode, waktu bayar, payload mentah untuk rekonsiliasi).
  update public.orders
    set status = 'paid',
        payment_method = p_payment_method,
        paid_at = coalesce(p_paid_at, v_now),
        raw_notification = p_raw
    where id = v_order.id;

  -- Durasi paket → active_until (interval bulan Postgres = aman akhir-bulan).
  select duration_months into v_duration
    from public.packages
    where id = v_order.package_id;

  -- Undangan → active HANYA bila statusnya dapat-diaktifkan. JANGAN menimpa
  -- moderasi admin 'suspended' (mis. order `pending` dibuat sebelum admin
  -- men-suspend, lalu tautan Pakasir yang masih valid dibayar → jangan
  -- mem-publikasi ulang konten bermasalah). `returning` dikualifikasi agar tak
  -- bertabrakan dgn OUT param `slug`.
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

  -- Tak dapat diaktifkan (suspended / sudah active). Order TETAP `paid`
  -- (pembayaran nyata & tercatat) tetapi TIDAK dipublikasikan — reinstate oleh admin.
  select i.slug into v_slug
    from public.invitations i
    where i.id = v_order.invitation_id;
  return query select 'held'::text, v_slug;
end;
$$;

revoke execute on function
  public.activate_paid_order(text, int, text, timestamptz, jsonb)
  from anon, authenticated, public;
grant execute on function
  public.activate_paid_order(text, int, text, timestamptz, jsonb)
  to service_role;

comment on function
  public.activate_paid_order(text, int, text, timestamptz, jsonb) is
  'Aktivasi order terbayar (webhook Pakasir M3.2): atomik order->paid + undangan->active (active_until=now+durasi paket, published_at sekali). Idempoten (kunci baris; already_paid=no-op). HANYA service_role (execute dicabut dari authenticated → cegah self-activation).';
