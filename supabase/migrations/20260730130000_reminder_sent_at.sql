-- M3.5 — Pengingat masa aktif (H-14). Kolom `reminder_sent_at` menandai bahwa
-- email pengingat sudah dikirim untuk siklus aktif ini → cron idempoten (tak
-- mengirim ganda). Tak diberikan ke `authenticated` (bukan bagian grant kolom
-- konten M1) → hanya service_role (cron) yang menulisnya.
alter table public.invitations
  add column if not exists reminder_sent_at timestamptz;

comment on column public.invitations.reminder_sent_at is
  'Waktu email pengingat H-14 dikirim untuk siklus aktif berjalan (M3.5). Di-reset ke NULL saat (re)aktivasi agar perpanjangan memicu pengingat baru.';

-- Recreate activate_paid_order (M3.2) + RESET reminder_sent_at pada (re)aktivasi:
-- undangan yang diperpanjang (expired→active) harus dapat pengingat H-14 baru
-- untuk active_until yang baru. Sisa logika IDENTIK M3.2 (atomik, idempoten,
-- guard status, service_role-only).
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
  select * into v_order
    from public.orders
    where order_code = p_order_code
    for update;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if v_order.status = 'paid' then
    select i.slug into v_slug
      from public.invitations i
      where i.id = v_order.invitation_id;
    return query select 'already_paid'::text, v_slug;
    return;
  end if;

  if v_order.status <> 'pending' or v_order.amount_idr <> p_amount then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  update public.orders
    set status = 'paid',
        payment_method = p_payment_method,
        paid_at = coalesce(p_paid_at, v_now),
        raw_notification = p_raw
    where id = v_order.id;

  select duration_months into v_duration
    from public.packages
    where id = v_order.package_id;

  update public.invitations
    set status = 'active',
        package_id = v_order.package_id,
        active_until = v_now + (coalesce(v_duration, 6) || ' months')::interval,
        published_at = coalesce(published_at, v_now),
        reminder_sent_at = null, -- M3.5: siklus aktif baru → pengingat H-14 baru
        updated_at = v_now
    where id = v_order.invitation_id
      and status in ('draft', 'pending_payment', 'expired')
    returning invitations.slug into v_slug;

  if found then
    return query select 'activated'::text, v_slug;
    return;
  end if;

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
