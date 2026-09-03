-- Retensi UU PDP — sertakan Album Momen di purge data pribadi (FASE H #8c).
-- purge_invitation_data (20260808140000) MEMPERTAHANKAN baris undangan sebagai
-- kerangka → FK cascade momen_albums→invitations TIDAK terpicu, jadi foto momen
-- (data pribadi: wajah tamu + nama) akan LOLOS purge = celah kepatuhan. Migrasi
-- ini menghapus momen_albums eksplisit (cascade → momen_photos) dan mengembalikan
-- path OBJEK PENUH foto momen di kolom BARU `momen_paths`.
--
-- Kenapa kolom terpisah (bukan disatukan ke `media_paths`): pemanggil memperlaku-
-- kan tiap `media_paths` sebagai PREFIX lalu meng-expand ke 2 varian galeri
-- (`1600.webp`/`400.webp`) via `mediaObjectPaths`. Foto momen bernama
-- `display`/`thumb` (bukan prefix) → tak cocok expansion itu. `momen_paths`
-- adalah path objek PENUH yang pemanggil hapus LANGSUNG. Jalur `media_paths`
-- (galeri) tidak berubah sama sekali. Perlu DROP+CREATE (tanda tangan berubah).
--
-- Orphan claim-without-confirm (unggah tak pernah confirm → objek tanpa baris)
-- TIDAK dienumerasi (tak ada baris DB, path UUID acak) — konsisten sikap orphan
-- galeri: tak berbahaya. Membersihkannya butuh scan storage by-prefix (di luar
-- lingkup retensi ini).
drop function if exists public.purge_invitation_data(uuid);

create function public.purge_invitation_data(p_invitation_id uuid)
  returns table (result text, media_paths text[], momen_paths text[])
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_paths text[];
  v_momen text[];
begin
  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text, null::text[], null::text[];
    return;
  end if;

  if v_inv.status <> 'expired' then
    return query select 'not_expired'::text, null::text[], null::text[];
    return;
  end if;

  if v_inv.purged_at is not null then
    return query select 'already_purged'::text, null::text[], null::text[];
    return;
  end if;

  -- Prefix media galeri (pemanggil meng-expand ke 2 varian) — TAK berubah.
  select coalesce(array_agg(storage_path), '{}') into v_paths
    from public.media where invitation_id = p_invitation_id;

  -- Path OBJEK PENUH foto momen (display + thumb) — dikumpulkan SEBELUM cascade.
  select coalesce(array_agg(sp), '{}') into v_momen
    from (
      select unnest(array[mp.storage_path, mp.thumb_path]) as sp
      from public.momen_photos mp
      join public.momen_albums ma on ma.id = mp.album_id
      where ma.invitation_id = p_invitation_id
    ) s;

  -- Hapus permanen data pribadi. momen_albums dihapus eksplisit (kerangka
  -- undangan dipertahankan → FK cascade tak terpicu); cascade ke momen_photos.
  delete from public.rsvps where invitation_id = p_invitation_id;
  delete from public.gift_notes where invitation_id = p_invitation_id;
  delete from public.guests where invitation_id = p_invitation_id;
  delete from public.media where invitation_id = p_invitation_id;
  delete from public.invitation_events where invitation_id = p_invitation_id;
  delete from public.momen_albums where invitation_id = p_invitation_id;

  update public.invitations
    set content = '{}'::jsonb, purged_at = now()
    where id = p_invitation_id;

  return query select 'purged'::text, v_paths, v_momen;
end;
$$;

revoke execute on function public.purge_invitation_data(uuid)
  from anon, authenticated, public;
grant execute on function public.purge_invitation_data(uuid)
  to service_role;

comment on function public.purge_invitation_data(uuid) is
  'Hapus permanen data pribadi undangan EXPIRED (tamu/RSVP/gift_notes/media/events + Album Momen albums/photos + scrub content), pertahankan baris undangan (kerangka) & orders. Idempoten via purged_at. Return media_paths (PREFIX galeri, expand di pemanggil) + momen_paths (path OBJEK PENUH foto momen, hapus langsung). HANYA service_role.';
