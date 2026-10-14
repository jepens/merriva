-- Foto bernama (sampul / mempelai / logo) ikut terhapus saat retensi.
--
-- TEMUAN: `purge_invitation_data` mengumpulkan path objek HANYA dari tabel
-- `media` (galeri) dan `momen_photos`. Foto bernama tidak punya baris tabel —
-- ia hidup sebagai path di dalam `invitations.content`:
--
--     content->>'coverPhoto'          content->>'logo'
--     content->'groom'->>'photo'      content->'bride'->>'photo'
--
-- Dan beberapa baris di bawah, fungsi yang sama menimpa `content` menjadi
-- `'{}'`. Jadi urutannya: satu-satunya rujukan ke objek itu DIHAPUS, objeknya
-- sendiri TIDAK — foto wajah mempelai tertinggal di storage selamanya, tanpa
-- apa pun yang masih menunjuknya. Itu kebalikan dari yang dijanjikan
-- `/privasi` dan dituntut UU PDP 27/2022, dan tak akan pernah terlihat dari
-- luar: cron melaporkan "purged" dengan jujur.
--
-- Belum pernah menggigit karena editornya belum punya tombol unggah untuk foto
-- ini sama sekali (SPEC §4.4 langkah 2 menuntutnya; UI-nya tak pernah dibuat),
-- sehingga kolomnya selalu kosong di produksi. Migrasi ini mendahului tombol
-- itu — bukan menyusulnya.
--
-- KENAPA IKUT `media_paths`, BUKAN KOLOM KEMBALIAN BARU: foto bernama memakai
-- bentuk objek yang SAMA PERSIS dengan galeri — satu prefix berisi dua varian
-- `1600.webp` + `400.webp` (`lib/media.ts`). Pemanggil sudah meng-expand tiap
-- entri `media_paths` lewat `mediaObjectPaths(prefix)`, jadi menambahkannya ke
-- sana membuat penghapusannya benar TANPA mengubah tipe kembalian, tanpa
-- menyentuh TypeScript pemanggil, dan tanpa `drop function`.
--
-- `admin_delete_account` ikut sembuh gratis: ia mengakumulasi `media_paths`
-- dari fungsi ini (`v_media := v_media || coalesce(v_p.media_paths, '{}')`).
--
-- Sisanya identik migrasi 20261005100000.
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

  if v_inv.status not in ('expired', 'suspended') then
    return query select 'not_expired'::text, null::text[], null::text[];
    return;
  end if;

  if v_inv.purged_at is not null then
    return query select 'already_purged'::text, null::text[], null::text[];
    return;
  end if;

  -- Prefix media galeri (pemanggil meng-expand ke 2 varian).
  select coalesce(array_agg(storage_path), '{}') into v_paths
    from public.media where invitation_id = p_invitation_id;

  -- Prefix foto bernama, DIPANEN SEBELUM `content` dikosongkan di bawah.
  -- Bentuknya sama dengan galeri (prefix 2 varian) sehingga ikut jalur yang
  -- sama. `->>` pada content yang bukan objek mengembalikan NULL, jadi
  -- undangan lama / content kosong aman tanpa penjagaan tambahan.
  v_paths := v_paths || (
    select coalesce(array_agg(p), '{}')
    from unnest(array[
      v_inv.content->>'coverPhoto',
      v_inv.content->'groom'->>'photo',
      v_inv.content->'bride'->>'photo',
      v_inv.content->>'logo'
    ]) as p
    where p is not null and p <> ''
  );

  -- Path OBJEK PENUH foto momen (display + thumb) — dikumpulkan SEBELUM cascade.
  select coalesce(array_agg(sp), '{}') into v_momen
    from (
      select unnest(array[mp.storage_path, mp.thumb_path]) as sp
      from public.momen_photos mp
      join public.momen_albums ma on ma.id = mp.album_id
      where ma.invitation_id = p_invitation_id
    ) s;

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
  'Hapus permanen data pribadi undangan EXPIRED atau SUSPENDED (tamu/RSVP/gift_notes/media/events + Album Momen albums/photos + scrub content), pertahankan baris undangan (kerangka) & orders. Jam retensi tetap active_until. Idempoten via purged_at. Return media_paths (PREFIX 2-varian: galeri DAN foto bernama cover/mempelai/logo yang dipanen dari content sebelum di-scrub, expand di pemanggil) + momen_paths (path OBJEK PENUH foto momen, hapus langsung). HANYA service_role.';
