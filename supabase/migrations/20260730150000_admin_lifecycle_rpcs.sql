-- M4.1b — RPC lifecycle admin (panel admin, SPEC §4.9). Semua fungsi:
--   * SECURITY DEFINER + search_path='' (pola harden_functions) — nama dikualifikasi.
--   * Execute DICABUT dari anon/authenticated/public → HANYA service_role. Mutasi
--     admin selalu lewat Server Action ber-`requireAdmin()` (defense-in-depth).
--   * Menulis `admin_logs` DALAM transaksi yang sama → audit ATOMIK: tak ada
--     mutasi lifecycle yang lolos tanpa jejak (lebih kuat dari log best-effort).
--   * Mengunci baris undangan (`for update`) → aman-ras vs webhook/cron/poll.

-- -----------------------------------------------------------------------------
-- 1) Aktivasi MANUAL (bayar di luar sistem, mis. klien jasa EO).
--    MEMAKAI ULANG `activate_paid_order` → hasil IDENTIK dengan aktivasi via
--    pembayaran (kriteria terima §4.9). Atomik: buat order 'manual' pending +
--    aktifkan dalam SATU transaksi. `order_code` dibuat pemanggil (retry saat
--    tabrakan UNIQUE → 'order_code_conflict').
-- -----------------------------------------------------------------------------
create or replace function public.admin_activate_invitation(
  p_invitation_id uuid,
  p_package_id uuid,
  p_admin_id uuid,
  p_order_code text
) returns table (result text, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_price int;
  v_active boolean;
  v_res text;
  v_slug text;
begin
  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  -- Alamat masih 'draft-…' → publik 404 & TERKUNCI setelah aktif → tolak.
  if v_inv.slug like 'draft-%' then
    return query select 'draft_slug'::text, v_inv.slug;
    return;
  end if;

  -- Hanya status dapat-dibayar. active/suspended → tolak (reinstate/lihat dulu).
  if v_inv.status not in ('draft', 'pending_payment', 'expired') then
    return query select 'not_payable'::text, v_inv.slug;
    return;
  end if;

  select price_idr, is_active into v_price, v_active
    from public.packages where id = p_package_id;
  if v_price is null or v_active is not true then
    return query select 'package_unavailable'::text, v_inv.slug;
    return;
  end if;

  -- Order 'manual' pending; tabrakan order_code → pemanggil retry kode baru.
  begin
    insert into public.orders (
      user_id, invitation_id, package_id, amount_idr, status,
      order_code, payment_method
    ) values (
      v_inv.user_id, p_invitation_id, p_package_id, v_price, 'pending',
      p_order_code, 'manual'
    );
  exception when unique_violation then
    return query select 'order_code_conflict'::text, v_inv.slug;
    return;
  end;

  -- Jalur aktivasi OTORITATIF yang SAMA dengan pembayaran (idempoten +
  -- active_until = now + durasi paket). raw = jejak asal manual + admin.
  select a.result, a.slug into v_res, v_slug
    from public.activate_paid_order(
      p_order_code, v_price, 'manual', now(),
      jsonb_build_object('source', 'admin_manual', 'admin_id', p_admin_id)
    ) a;

  if v_res in ('activated', 'already_paid') then
    insert into public.admin_logs (
      admin_id, action, target_type, target_id, detail
    ) values (
      p_admin_id, 'invitation.activate_manual', 'invitation', p_invitation_id,
      jsonb_build_object(
        'package_id', p_package_id, 'order_code', p_order_code,
        'amount_idr', v_price, 'activate_result', v_res
      )
    );
  end if;

  return query select v_res, coalesce(v_slug, v_inv.slug);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Perpanjang masa aktif (goodwill / bayar di luar sistem tanpa order baru).
--    active_until = max(active_until, now) + N bulan; expired → active kembali.
-- -----------------------------------------------------------------------------
create or replace function public.admin_extend_invitation(
  p_invitation_id uuid,
  p_months int,
  p_admin_id uuid
) returns table (result text, slug text, active_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_now timestamptz := now();
  v_until timestamptz;
begin
  if p_months is null or p_months < 1 or p_months > 24 then
    return query select 'invalid_months'::text, null::text, null::timestamptz;
    return;
  end if;

  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text, null::text, null::timestamptz;
    return;
  end if;

  -- Hanya undangan yang pernah/masih aktif. draft/pending/suspended → tolak
  -- (aktivasi manual / reinstate dulu).
  if v_inv.status not in ('active', 'expired') then
    return query
      select 'not_extendable'::text, v_inv.slug, v_inv.active_until;
    return;
  end if;

  v_until := greatest(coalesce(v_inv.active_until, v_now), v_now)
    + (p_months || ' months')::interval;

  update public.invitations
    set status = 'active',
        active_until = v_until,
        published_at = coalesce(published_at, v_now),
        reminder_sent_at = null, -- siklus aktif baru → pengingat H-14 baru
        updated_at = v_now
    where id = p_invitation_id;

  insert into public.admin_logs (
    admin_id, action, target_type, target_id, detail
  ) values (
    p_admin_id, 'invitation.extend', 'invitation', p_invitation_id,
    jsonb_build_object(
      'months', p_months, 'active_until', v_until, 'prev_status', v_inv.status
    )
  );

  return query select 'extended'::text, v_inv.slug, v_until;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Suspend (konten bermasalah). Undangan publik menampilkan notis, bukan konten.
-- -----------------------------------------------------------------------------
create or replace function public.admin_suspend_invitation(
  p_invitation_id uuid,
  p_admin_id uuid,
  p_reason text
) returns table (result text, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
begin
  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;
  if v_inv.status = 'suspended' then
    return query select 'already_suspended'::text, v_inv.slug;
    return;
  end if;

  update public.invitations
    set status = 'suspended', updated_at = now()
    where id = p_invitation_id;

  insert into public.admin_logs (
    admin_id, action, target_type, target_id, detail
  ) values (
    p_admin_id, 'invitation.suspend', 'invitation', p_invitation_id,
    jsonb_build_object('reason', p_reason, 'prev_status', v_inv.status)
  );

  return query select 'suspended'::text, v_inv.slug;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Reinstate (batalkan suspend). Status dipulihkan dari active_until:
--    masa depan → active · masa lalu → expired · belum pernah aktif → draft.
-- -----------------------------------------------------------------------------
create or replace function public.admin_reinstate_invitation(
  p_invitation_id uuid,
  p_admin_id uuid
) returns table (result text, slug text, new_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_now timestamptz := now();
  v_new text;
begin
  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;
  if v_inv.status <> 'suspended' then
    return query select 'not_suspended'::text, v_inv.slug, v_inv.status::text;
    return;
  end if;

  if v_inv.active_until is not null and v_inv.active_until > v_now then
    v_new := 'active';
  elsif v_inv.active_until is not null then
    v_new := 'expired';
  else
    v_new := 'draft';
  end if;

  update public.invitations
    set status = v_new::public.invitation_status, updated_at = v_now
    where id = p_invitation_id;

  insert into public.admin_logs (
    admin_id, action, target_type, target_id, detail
  ) values (
    p_admin_id, 'invitation.reinstate', 'invitation', p_invitation_id,
    jsonb_build_object('new_status', v_new)
  );

  return query select 'reinstated'::text, v_inv.slug, v_new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) Ganti kepemilikan (klien jasa EO). Pindahkan undangan + riwayat order-nya
--    ke pemilik baru agar RLS `orders_select`/`invitations_select` konsisten.
-- -----------------------------------------------------------------------------
create or replace function public.admin_change_owner(
  p_invitation_id uuid,
  p_new_user_id uuid,
  p_admin_id uuid
) returns table (result text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_exists boolean;
begin
  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text;
    return;
  end if;

  select exists (select 1 from public.profiles where id = p_new_user_id)
    into v_exists;
  if not v_exists then
    return query select 'user_not_found'::text;
    return;
  end if;
  if v_inv.user_id = p_new_user_id then
    return query select 'noop'::text;
    return;
  end if;

  update public.invitations
    set user_id = p_new_user_id, updated_at = now()
    where id = p_invitation_id;
  update public.orders
    set user_id = p_new_user_id
    where invitation_id = p_invitation_id;

  insert into public.admin_logs (
    admin_id, action, target_type, target_id, detail
  ) values (
    p_admin_id, 'invitation.change_owner', 'invitation', p_invitation_id,
    jsonb_build_object('from', v_inv.user_id, 'to', p_new_user_id)
  );

  return query select 'changed'::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- Hardening execute: cabut dari anon/authenticated/public, beri service_role.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.admin_activate_invitation(uuid, uuid, uuid, text),
  public.admin_extend_invitation(uuid, int, uuid),
  public.admin_suspend_invitation(uuid, uuid, text),
  public.admin_reinstate_invitation(uuid, uuid),
  public.admin_change_owner(uuid, uuid, uuid)
  from anon, authenticated, public;

grant execute on function
  public.admin_activate_invitation(uuid, uuid, uuid, text),
  public.admin_extend_invitation(uuid, int, uuid),
  public.admin_suspend_invitation(uuid, uuid, text),
  public.admin_reinstate_invitation(uuid, uuid),
  public.admin_change_owner(uuid, uuid, uuid)
  to service_role;
