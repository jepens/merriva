-- M3.4 — Kedaluwarsakan satu order `pending` (cron expire >24 jam). ATOMIK dalam
-- SATU transaksi: kunci baris order, tandai `expired`, lalu — bila undangan masih
-- menunggu checkout INI (`pending_payment`) dan tak punya order `pending` lain —
-- kembalikan undangan ke `draft` (klien bisa aktivasi ulang).
--
-- KEAMANAN & RAS: HANYA dipanggil server (service_role) dari handler cron SETELAH
-- rekonsiliasi OTORITATIF (`verifyAndActivate` → `transactiondetail`) memastikan
-- order BELUM lunas. Kunci baris + cek ulang `status='pending'` menserialisasi
-- dengan webhook/poll: bila aktivasi menang lebih dulu (order jadi `paid`), RPC
-- ini melihat status bukan `pending` → `not_pending` (TIDAK men-expire yang lunas).
-- Execute dicabut dari anon/authenticated/public. Pola harden_functions.

create or replace function public.expire_pending_order(p_order_code text)
  returns table (result text)
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
    from public.orders
    where order_code = p_order_code
    for update;

  if not found then
    return query select 'not_found'::text;
    return;
  end if;

  -- Idempoten / ras-aman: hanya order yang masih `pending` boleh di-expire.
  if v_order.status <> 'pending' then
    return query select 'not_pending'::text;
    return;
  end if;

  update public.orders
    set status = 'expired'
    where id = v_order.id;

  -- Undangan kembali ke `draft` HANYA bila ia menunggu checkout ini dan tak ada
  -- order `pending` lain (mis. klien sudah mencoba bayar ulang → order baru).
  -- Trigger set_invitations_updated_at mengurus updated_at.
  update public.invitations
    set status = 'draft'
    where id = v_order.invitation_id
      and status = 'pending_payment'
      and not exists (
        select 1 from public.orders o
        where o.invitation_id = v_order.invitation_id
          and o.status = 'pending'
          and o.id <> v_order.id
      );

  return query select 'expired'::text;
end;
$$;

revoke execute on function public.expire_pending_order(text)
  from anon, authenticated, public;
grant execute on function public.expire_pending_order(text)
  to service_role;

comment on function public.expire_pending_order(text) is
  'Expire 1 order pending (cron M3.4 >24 jam): atomik order->expired + (bila menunggu checkout ini & tak ada pending lain) undangan pending_payment->draft. Idempoten (kunci baris; not_pending bila sudah paid/expired). HANYA service_role. Dipanggil SETELAH rekonsiliasi transactiondetail memastikan belum lunas.';
