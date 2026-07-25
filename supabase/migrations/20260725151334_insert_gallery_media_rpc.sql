-- M1.4 (hardening pasca-review) — insert foto galeri ATOMIK dengan penegakan
-- limit paket di DB. Menutup TOCTOU: count-then-insert non-atomik di app bisa
-- dilewati request paralel, dan limit yang dihitung app bisa ditimpa bila RPC
-- menerima max_photos dari pemanggil. Maka fungsi ini MENGHITUNG limit sendiri
-- (paket undangan; Basic 8 bila tanpa paket) → tak bisa di-override lewat REST.
--
-- SECURITY INVOKER: RLS `owns_invitation` berlaku ke SELECT & INSERT pemanggil,
-- jadi hanya pemilik yang bisa menyisipkan. Advisory lock per-undangan
-- menserialkan insert berbarengan → hitung+sisip atomik. sort_order = max+1
-- (bukan count) agar hapus di tengah tak menimbulkan tabrakan urutan.
-- Return NULL bila: undangan bukan milik pemanggil (tak terlihat) atau limit penuh.
create or replace function public.insert_gallery_media(
  media_id uuid,
  inv_id uuid,
  path text,
  w int,
  h int
)
returns public.media
language plpgsql
security invoker
set search_path = ''
as $$
declare
  limit_photos int;
  cur int;
  next_sort int;
  result public.media;
begin
  perform pg_advisory_xact_lock(hashtextextended(inv_id::text, 0));

  -- Limit foto: dari paket undangan (RLS owns_invitation membatasi baca ke
  -- undangan sendiri → baris tak terlihat bila bukan pemilik), else Basic 8.
  select coalesce((p.limits ->> 'max_photos')::int, 8)
    into limit_photos
    from public.invitations i
    left join public.packages p on p.id = i.package_id
    where i.id = inv_id;

  if limit_photos is null then
    return null; -- undangan tak terlihat (bukan milik pemanggil)
  end if;

  select count(*), coalesce(max(sort_order) + 1, 0)
    into cur, next_sort
    from public.media
    where invitation_id = inv_id;

  if cur >= limit_photos then
    return null; -- batas paket tercapai
  end if;

  insert into public.media
    (id, invitation_id, type, storage_path, width, height, sort_order)
  values (media_id, inv_id, 'photo', path, w, h, next_sort)
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.insert_gallery_media(uuid, uuid, text, int, int) from anon, public;
grant execute on function public.insert_gallery_media(uuid, uuid, text, int, int) to authenticated, service_role;

comment on function public.insert_gallery_media(uuid, uuid, text, int, int) is
  'Sisip 1 foto galeri atomik dengan limit paket (dihitung di DB) + advisory lock per-undangan. SECURITY INVOKER → RLS owns_invitation. NULL = bukan pemilik / limit penuh. M1.4.';
