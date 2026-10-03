-- AUDIT-2026-10-01 A6 — penghapusan akun yang bisa dijalankan.
--
-- `/privasi` sudah tayang menjanjikan "Anda dapat meminta penghapusan data
-- kapan saja", tetapi `auth.admin.deleteUser` tak pernah dipanggil di mana pun
-- dan panel admin hanya bisa MEMBEKUKAN (ban GoTrue), bukan menghapus. Janji
-- publik tanpa mekanisme adalah eksposur kepatuhan, bukan sekadar celah fitur.
--
-- =============================================================================
-- 1) FK: CASCADE → SET NULL pada kedua kolom `user_id`
-- =============================================================================
-- Keputusan pemilik (2026-10-03): riwayat pesanan DIPERTAHANKAN ter-anonimisasi.
-- Itu MUSTAHIL dengan skema sebelumnya — rantainya
--   profiles → CASCADE → invitations.user_id
--   profiles → CASCADE → orders.user_id
--   invitations → CASCADE → orders.invitation_id
-- sehingga menghapus profil pasti ikut menghapus setiap order. Dengan SET NULL,
-- baris order bertahan tanpa pemilik dan `admin_month_revenue` tetap melihat
-- transaksi yang benar-benar terjadi; rekonsiliasi dengan mutasi rekening utuh.
--
-- `orders.invitation_id` SENGAJA dibiarkan NOT NULL + CASCADE: kerangka undangan
-- memang dipertahankan (pola retensi yang sudah ada — `purge_invitation_data`
-- mengosongkan isinya dan menyetel `purged_at`, barisnya tetap), jadi tak ada
-- order yang kehilangan induknya.
--
-- Nullable TIDAK melemahkan RLS: seluruh policy membandingkan
-- `user_id = auth.uid()`, dan NULL = uuid menghasilkan NULL (bukan true), jadi
-- baris yatim tak terlihat oleh klien mana pun — hanya service_role/admin.
-- Hal yang sama berlaku pada `with check` di jalur INSERT: user_id NULL ditolak.

alter table public.invitations alter column user_id drop not null;
alter table public.invitations drop constraint invitations_user_id_fkey;
alter table public.invitations add constraint invitations_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.orders alter column user_id drop not null;
alter table public.orders drop constraint orders_user_id_fkey;
alter table public.orders add constraint orders_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

comment on column public.orders.user_id is
  'NULL = pemiliknya sudah menghapus akunnya. Barisnya DIPERTAHANKAN untuk kewajiban pembukuan & rekonsiliasi Pakasir (AUDIT-2026-10-01 A6).';
comment on column public.invitations.user_id is
  'NULL = pemiliknya sudah menghapus akunnya. Barisnya tinggal kerangka ter-purge yang menahan FK `orders.invitation_id`.';

-- =============================================================================
-- 2) RPC penghapusan akun
-- =============================================================================
create or replace function public.admin_delete_account(
  p_user_id uuid,
  p_admin_id uuid,
  p_reason text
) returns table (
  result text,
  media_paths text[],
  momen_paths text[],
  purged_count int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exists boolean;
  v_active int;
  v_inv record;
  v_p record;
  v_media text[] := '{}';
  v_momen text[] := '{}';
  v_count int := 0;
begin
  select true into v_exists from public.profiles where id = p_user_id;
  if not found then
    return query select 'not_found'::text, null::text[], null::text[], 0;
    return;
  end if;

  -- Keputusan pemilik: undangan yang MASIH AKTIF menahan penghapusan. Tamunya
  -- sudah memegang tautan di grup WhatsApp dan acaranya mungkin besok; ini juga
  -- sejalan dengan boundary "jangan pernah hapus undangan yang masih aktif".
  select count(*)::int into v_active
    from public.invitations
    where user_id = p_user_id and status = 'active';
  if v_active > 0 then
    return query select 'has_active'::text, null::text[], null::text[], v_active;
    return;
  end if;

  for v_inv in
    select id, status from public.invitations where user_id = p_user_id
  loop
    -- `purge_invitation_data` hanya mau menyentuh undangan 'expired'. Akun yang
    -- dihapus berarti seluruh undangannya berakhir, jadi status disetel dulu.
    if v_inv.status <> 'expired' then
      update public.invitations
        set status = 'expired', active_until = now(), updated_at = now()
        where id = v_inv.id;
    end if;

    select * into v_p from public.purge_invitation_data(v_inv.id);
    if v_p.result = 'purged' then
      v_media := v_media || coalesce(v_p.media_paths, '{}');
      v_momen := v_momen || coalesce(v_p.momen_paths, '{}');
      v_count := v_count + 1;
    end if;
  end loop;

  -- Ditulis SEBELUM profil dihapus; `admin_logs.admin_id` menunjuk profil ADMIN
  -- (berbeda) sehingga jejaknya tak ikut hilang.
  insert into public.admin_logs (
    admin_id, action, target_type, target_id, detail
  ) values (
    p_admin_id, 'user.delete_account', 'user', p_user_id,
    jsonb_build_object(
      'reason', p_reason,
      'invitations_purged', v_count
    )
  );

  -- SET NULL mengosongkan `invitations.user_id` dan `orders.user_id` di sini.
  -- Baris order tetap ada; kerangka undangan tetap menahan FK-nya.
  delete from public.profiles where id = p_user_id;

  return query select 'deleted'::text, v_media, v_momen, v_count;
end;
$$;

comment on function public.admin_delete_account(uuid, uuid, text) is
  'Hapus akun: purge data pribadi tiap undangan, anonimkan orders & kerangka undangan lewat FK SET NULL, hapus baris profiles, dan catat admin_logs — satu transaksi (AUDIT-2026-10-01 A6). MENOLAK bila ada undangan berstatus active. Pemanggil WAJIB menghapus objek storage yang dikembalikan lalu auth.admin.deleteUser. HANYA service_role.';

revoke execute on function public.admin_delete_account(uuid, uuid, text)
  from anon, authenticated, public;

grant execute on function public.admin_delete_account(uuid, uuid, text)
  to service_role;
