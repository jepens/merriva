-- Undangan yang DITANGGUHKAN ikut retensi yang sama (keputusan pemilik
-- 2026-10-05).
--
-- TEMUAN: undangan `suspended` TIDAK PERNAH dipurge, jadi nama tamu, nomor HP,
-- isi ucapan, dan catatan amplop tersimpan SELAMANYA — di luar retensi 6 bulan
-- yang dijanjikan `/privasi` dan di luar UU PDP 27/2022. Rantainya:
--   * `admin_suspend_invitation` hanya menyetel `status='suspended'` dan TIDAK
--     menyentuh `active_until`;
--   * `cron/expire-invitations` hanya membalik `active` → `expired`, jadi
--     undangan suspended tak pernah sampai ke `expired`;
--   * `purge_invitation_data` menolak apa pun selain `expired` (`not_expired`).
-- Tak ada satu pun jalur yang menutup lingkaran itu.
--
-- Yang ditanggung orang lain: tamu. Mereka tak melakukan apa pun, tetapi data
-- pribadinya ikut tersimpan tanpa batas waktu karena HOST-nya bermasalah.
--
-- JAM RETENSINYA TIDAK BERUBAH: tetap `active_until`, yang justru TIDAK
-- disentuh oleh suspend — jadi tak ada tanggal baru yang perlu dikarang dan
-- tak ada kolom baru. Undangan yang ditangguhkan dipurge pada hari yang sama
-- seperti seandainya ia tidak pernah ditangguhkan.
--
-- Konsekuensi yang diterima sadar: bila sengketa konten muncul lebih dari 6
-- bulan setelah masa aktif berakhir, bukti isinya sudah tidak ada. `admin_logs`
-- (alasan suspend + admin yang melakukannya) TETAP tersimpan, begitu pula
-- `orders`; yang hilang adalah data pribadi tamu — dan memang itu yang tak
-- boleh disimpan selamanya.
--
-- Sisanya identik migrasi 20260904120000.
create or replace function public.purge_invitation_data(p_invitation_id uuid)
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

  -- `suspended` IKUT: lihat catatan di kepala migrasi. `active`/`draft`/
  -- `pending_payment` tetap ditolak — undangan yang masih hidup atau belum
  -- pernah terbit tak punya jam retensi yang berjalan.
  if v_inv.status not in ('expired', 'suspended') then
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
  'Hapus permanen data pribadi undangan EXPIRED atau SUSPENDED (tamu/RSVP/gift_notes/media/events + Album Momen albums/photos + scrub content), pertahankan baris undangan (kerangka) & orders. Jam retensi tetap active_until. Idempoten via purged_at. Return media_paths (PREFIX galeri, expand di pemanggil) + momen_paths (path OBJEK PENUH foto momen, hapus langsung). HANYA service_role.';

-- Indeks parsial lama hanya mencakup `status = 'expired'`, jadi ia TIDAK
-- melayani scan yang kini juga mencari `suspended` — tanpa indeks baru, cron
-- retensi berubah jadi seq scan pada tabel yang terus tumbuh.
create index if not exists invitations_purge_scan_v2_idx
  on public.invitations (active_until)
  where status in ('expired', 'suspended') and purged_at is null;

-- Yang lama sepenuhnya tercakup yang baru ('expired' ⊂ {'expired','suspended'}),
-- jadi membiarkannya hanya menambah biaya tulis tanpa melayani query mana pun.
drop index if exists public.invitations_purge_scan_idx;
