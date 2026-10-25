-- Admin & Pro tidak pernah ditagih (DECISIONS #100, SPEC §4.2/§4.8).
--
-- 1) Peran baru `pro`, diberikan admin dari /admin/pengguna. Aman karena:
--    - kolom `profiles.role` tak bisa ditulis klien (grant kolom, init_schema
--      §6b — hanya full_name & phone), jadi tak ada yang bisa memberi dirinya
--      Pro;
--    - `is_admin()` tetap `role = 'admin'` saja → Pro tak mendapat kuasa admin.
--    Nilai baru TIDAK dipakai di berkas ini: ADD VALUE di dalam transaksi baru
--    boleh dipakai setelah commit (dok. Postgres ALTER TYPE). Fungsi di bawah
--    membandingkan peran sebagai TEKS, jadi tak bergantung pada urutan itu.
alter type public.profile_role add value if not exists 'pro';

-- 2) Aktivasi TANPA bayar untuk undangan milik admin/Pro.
--
--    Order Rp0 bermetode 'gratis' + `activate_paid_order` dalam SATU transaksi
--    (pola `admin_activate_invitation`). Memakai ulang RPC aktivasi yang
--    otoritatif → hasilnya identik dengan aktivasi berbayar: masa aktif, reset
--    pengingat H-14, cabang upgrade (hanya tukar paket) & add-on Album Momen
--    (buat album). Order-nya tetap tercatat di riwayat pesanan & /admin/order,
--    tanpa menambah omzet.
--
--    Kenapa SQL, bukan dua panggilan dari server: order `pending` tanpa
--    `txn_id` tak pernah di-expire cron. Gagal di antara insert & aktivasi akan
--    meninggalkan order Rp0 yatim yang menahan halaman Album Momen/upgrade di
--    poller pembayaran selamanya.
--
--    Pemilik & peran diperiksa DI SINI juga, bukan hanya di server action: RLS
--    memperlihatkan SEMUA undangan kepada admin, dan menggratiskan undangan
--    pelanggan adalah tugas aktivasi manual ber-audit di panel admin.
create or replace function public.activate_free_order(
  p_invitation_id uuid,
  p_package_id uuid,
  p_purpose text,
  p_order_code text,
  p_actor_id uuid
) returns table (result text, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_role text;
  v_res text;
  v_slug text;
begin
  -- Kunci baris undangan: aktivasi gratis untuk undangan yang sama (dua tab,
  -- percobaan ulang) berjalan satu per satu. Kunci yang sama dengan UPDATE
  -- di `activate_paid_order`, dan tak menahan insert tamu/RSVP (FK).
  select i.user_id into v_owner
    from public.invitations i
    where i.id = p_invitation_id
    for no key update;
  select p.role::text into v_role
    from public.profiles p
    where p.id = p_actor_id;

  if v_owner is distinct from p_actor_id
     or v_role is null
     or v_role not in ('admin', 'pro') then
    return query select 'not_allowed'::text, null::text;
    return;
  end if;

  -- Cabang add-on `activate_paid_order` SELALU menjawab 'activated' (album
  -- dibuat `on conflict do nothing`), jadi penahan 'held' di bawah tak pernah
  -- menyala untuknya. Tanpa ini, permintaan kedua mencatat order Rp0 lunas
  -- untuk album yang sudah ada.
  if exists (
    select 1
      from public.momen_albums a, public.packages p
      where a.invitation_id = p_invitation_id
        and p.id = p_package_id
        and p.kind = 'addon_momen'
  ) then
    raise exception 'activate_free_order: held';
  end if;

  -- Tabrakan order_code → pemanggil mencoba lagi dengan kode baru.
  begin
    insert into public.orders (
      user_id, invitation_id, package_id, amount_idr, status,
      order_code, purpose
    ) values (
      v_owner, p_invitation_id, p_package_id, 0, 'pending',
      p_order_code, p_purpose
    );
  exception when unique_violation then
    return query select 'order_code_conflict'::text, null::text;
    return;
  end;

  select a.result, a.slug into v_res, v_slug
    from public.activate_paid_order(
      p_order_code, 0, 'gratis', now(),
      jsonb_build_object('source', 'gratis', 'role', v_role)
    ) a;

  -- Selain 'activated' (mis. 'held': undangan keburu aktif/ditangguhkan, atau
  -- paketnya sudah paket tujuan) → batalkan SELURUHNYA. Order Rp0 'paid' yang
  -- tak memberi apa-apa hanya mengotori riwayat pesanan.
  if v_res is distinct from 'activated' then
    raise exception 'activate_free_order: %', coalesce(v_res, 'kosong');
  end if;

  return query select v_res, v_slug;
end;
$$;

revoke execute on function
  public.activate_free_order(uuid, uuid, text, text, uuid)
  from anon, authenticated, public;
grant execute on function
  public.activate_free_order(uuid, uuid, text, text, uuid)
  to service_role;

comment on function
  public.activate_free_order(uuid, uuid, text, text, uuid) is
  'Aktivasi TANPA bayar untuk undangan MILIK admin/Pro (DECISIONS #100): order Rp0 metode gratis + activate_paid_order dalam satu transaksi; selain activated → rollback; bukan pemilik / bukan admin-Pro → not_allowed. HANYA service_role.';
