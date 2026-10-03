-- AUDIT-2026-10-01 A3 — jalur eksekusi refund.
--
-- Enum `order_status` sudah memuat 'refunded' sejak migrasi awal, tetapi TIDAK
-- ADA satu baris kode pun yang pernah menulisnya: /admin/order read-only, dan
-- `PaymentGateway` tak punya `refundTransaction`. Akibatnya refund yang
-- disetujui dikerjakan di luar sistem — order tetap 'paid', undangan tetap
-- aktif, sehingga pelanggan mendapat uang kembali DAN layanan, sementara
-- laporan admin berhenti cocok dengan mutasi rekening.
--
-- Uangnya sendiri tetap digerakkan di dashboard Pakasir (gateway tak punya API
-- refund); fungsi ini mencatat keputusannya dan MENCABUT layanan yang dibeli,
-- dalam satu transaksi beserta jejak auditnya.
--
-- Pola sama dengan admin_lifecycle_rpcs: SECURITY DEFINER + search_path='',
-- execute hanya service_role, admin_logs ditulis ATOMIK, baris dikunci.

-- Nama kolom OUT diubah (invitation_id -> inv_id) setelah pengujian langsung
-- menemukan `column reference "invitation_id" is ambiguous`: parameter OUT
-- menaungi kolom `momen_albums.invitation_id` di cabang add-on, sehingga SETIAP
-- refund add-on gagal. `create or replace` tak bisa mengubah tipe kembalian →
-- drop dulu. Fungsi ini belum pernah punya pemanggil di produksi.
drop function if exists public.admin_refund_order(text, uuid, text);

create function public.admin_refund_order(
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

  if v_kind = 'addon_momen' then
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
    select count(*)::int into v_sisa
      from public.orders o
      join public.packages p on p.id = o.package_id
      where o.invitation_id = v_order.invitation_id
        and o.id <> v_order.id
        and o.status = 'paid'
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
      'reason', p_reason,
      'outcome', v_result
    )
  );

  return query select v_result, v_slug, v_order.invitation_id;
end;
$$;

comment on function public.admin_refund_order(text, uuid, text) is
  'Tandai order lunas sebagai refunded DAN cabut layanan yang dibeli, atomik beserta admin_logs (AUDIT-2026-10-01 A3). invitation → undangan expired bila tak ada order lunas lain yang menopang; addon_momen → album archived, undangan tak disentuh. Uang digerakkan terpisah di dashboard Pakasir. HANYA service_role.';

revoke execute on function public.admin_refund_order(text, uuid, text)
  from anon, authenticated, public;

grant execute on function public.admin_refund_order(text, uuid, text)
  to service_role;
