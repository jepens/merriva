-- Retensi foto khas tema (DECISIONS #131, UU PDP).
--
-- Tema kini boleh punya slot foto sendiri (mis. "Foto berita utama" Warta,
-- `x-berita`), disimpan di `content.themePhotos` = objek `{ "x-…": foto }`.
-- Nilainya `photoSchema` yang SAMA dengan foto bernama lain — OBJEK
-- `{path,x,y,zoom}` atau STRING lama — dengan path `inv/<id undangan>/foto/<uuid>`.
-- Tak ada baris tabel yang menunjuknya; satu-satunya rujukan hidup di `content`,
-- yang dikosongkan fungsi ini juga. Tanpa pemanenan di bawah, foto itu
-- tertinggal di storage selamanya sesudah purge melaporkan "purged".
--
-- Badan fungsi = definisi terakhir (20261111090000_purge_foto_cerita.sql) APA
-- ADANYA, kecuali blok foto bernama: kandidatnya kini juga memuat NILAI
-- `themePhotos` (kuncinya tak dibaca), lewat CASE dan regex terikat undangan
-- yang SAMA, dan dipanen `distinct`. Cermin `namedPhotoPathsFromContent()` di
-- `lib/media.ts` — keduanya harus berubah bersama.
--
-- Non-destruktif: hanya `create or replace function`; signature, hak eksekusi,
-- dan kolom kembalian tidak berubah.
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

  -- Prefix media galeri (pemanggil meng-expand ke 2 varian). Bentuknya sudah
  -- dijamin check constraint `media_storage_path_format`.
  select coalesce(array_agg(storage_path), '{}') into v_paths
    from public.media where invitation_id = p_invitation_id;

  -- Prefix foto bernama, DIPANEN SEBELUM `content` dikosongkan di bawah.
  -- Bentuknya sama dengan galeri (prefix 2 varian) sehingga ikut jalur sama.
  --
  -- `object` = bentuk yang ditulis `photoSchema` hari ini; `string` = dua foto
  -- produksi yang tersimpan sebelum editor non-destruktif ada dan sengaja
  -- tetap diterima tanpa migrasi data (`tests/unit/lib/photo-schema.test.ts`).
  -- Bentuk lain apa pun → NULL → tersaring, bukan diteruskan sebagai teks JSON.
  --
  -- Foto per entri cerita (DECISIONS #127) ikut sebagai kandidat: `story`
  -- hanya dibaca bila ia ARRAY (kategori lain tak punya kunci ini; nilai rusak
  -- jatuh ke array kosong, bukan galat `jsonb_array_elements`), dan entri yang
  -- bukan objek atau tanpa `photo` menghasilkan NULL lalu tersaring di sini.
  --
  -- Foto khas tema (DECISIONS #131) juga: `themePhotos` hanya dibaca bila ia
  -- OBJEK (bentuk lain jatuh ke objek kosong, bukan galat `jsonb_each`); setiap
  -- NILAI-nya kandidat, apa pun kuncinya — path tetap harus lolos regex di bawah.
  -- `distinct`: satu path yang dirujuk dua kali cukup dihapus sekali.
  v_paths := v_paths || (
    select coalesce(array_agg(distinct p), '{}')
    from (
      select case jsonb_typeof(nilai)
               when 'object' then nilai->>'path'
               when 'string' then nilai #>> '{}'
             end as p
      from (
        select unnest(array[
          v_inv.content->'coverPhoto',
          v_inv.content->'groom'->'photo',
          v_inv.content->'bride'->'photo',
          v_inv.content->'logo'
        ])
        union all
        select entri->'photo'
        from jsonb_array_elements(
          case jsonb_typeof(v_inv.content->'story')
            when 'array' then v_inv.content->'story'
            else '[]'::jsonb
          end
        ) as entri
        union all
        select slot.value
        from jsonb_each(
          case jsonb_typeof(v_inv.content->'themePhotos')
            when 'object' then v_inv.content->'themePhotos'
            else '{}'::jsonb
          end
        ) as slot
      ) as sumber (nilai)
    ) kandidat
    where p ~ ('^inv/' || p_invitation_id::text ||
               '/foto/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );

  -- Path OBJEK PENUH foto momen (display + thumb) — dikumpulkan SEBELUM cascade.
  select coalesce(array_agg(sp), '{}') into v_momen
    from (
      select unnest(array[mp.storage_path, mp.thumb_path]) as sp
      from public.momen_photos mp
      join public.momen_albums ma on ma.id = mp.album_id
      where ma.invitation_id = p_invitation_id
    ) s;

  -- Objek VIDEO undangan (FASE J) — path OBJEK PENUH (berkas video + poster),
  -- dipanen dari `content` SEBELUM di-scrub, sama seperti foto bernama.
  --
  -- Ikut `momen_paths`, bukan kolom kembalian baru, dengan alasan yang sama
  -- dengan 20261014120000 memasukkan foto bernama ke `media_paths`: kolom itu
  -- di ketiga pemanggil (cron purge-expired, purge oleh pemilik, hapus akun —
  -- yang terakhir mengakumulasinya dari fungsi ini) berarti "path objek penuh,
  -- hapus langsung". Tanpa `drop function`, tanpa menyentuh TypeScript.
  --
  -- `#>>` pada `video` yang bukan objek menjawab NULL; kunci yang berisi objek
  -- menjawab teks JSON — keduanya gugur di regex bentuk penuh yang TERIKAT pada
  -- `p_invitation_id`, cermin `isVideoObjectPath()` di `lib/media.ts`.
  v_momen := v_momen || (
    select coalesce(array_agg(p), '{}')
    from unnest(array[
      v_inv.content #>> '{video,path}',
      v_inv.content #>> '{video,poster}'
    ]) as p
    where p ~ ('^video/' || p_invitation_id::text ||
               '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' ||
               '/(video\.(mp4|webm|mov)|poster\.(webp|jpg))$')
  );

  -- Objek MUSIK UNGGAHAN (DECISIONS #121) — path OBJEK PENUH, ikut `momen_paths`
  -- dengan alasan yang sama dengan video. Dipanen dari `music_uploads`, BUKAN
  -- dari `content.customMusic`: catatan unggah memuat juga objek yang diunggah
  -- lalu tak pernah tersimpan atau sudah diganti tetapi belum disapu cron.
  -- Regex bentuk penuh terikat undangan tetap dipasang walau check constraint
  -- tabel sudah menjaminnya — pertahanan berlapis, cermin `isCustomMusicPath()`.
  v_momen := v_momen || (
    select coalesce(array_agg(m.path), '{}')
    from public.music_uploads m
    where m.invitation_id = p_invitation_id
      and m.removed_at is null
      and m.path ~ ('^audio/' || p_invitation_id::text ||
                    '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp3$')
  );

  -- Barisnya DIPERTAHANKAN (catatan unggah tanpa isi berkas); hanya ditandai.
  update public.music_uploads
    set removed_at = now(), removed_reason = 'purge'
    where invitation_id = p_invitation_id and removed_at is null;

  delete from public.rsvps where invitation_id = p_invitation_id;
  delete from public.gift_notes where invitation_id = p_invitation_id;
  delete from public.guests where invitation_id = p_invitation_id;
  delete from public.media where invitation_id = p_invitation_id;
  delete from public.invitation_events where invitation_id = p_invitation_id;
  delete from public.momen_albums where invitation_id = p_invitation_id;

  update public.invitations
    set content = '{}'::jsonb,
        share_template = null,
        share_template_general = null,
        purged_at = now()
    where id = p_invitation_id;

  return query select 'purged'::text, v_paths, v_momen;
end;
$$;

revoke execute on function public.purge_invitation_data(uuid)
  from anon, authenticated, public;
grant execute on function public.purge_invitation_data(uuid)
  to service_role;

comment on function public.purge_invitation_data(uuid) is
  'Hapus permanen data pribadi undangan EXPIRED atau SUSPENDED (tamu/RSVP/gift_notes/media/events + Album Momen albums/photos + scrub content & template Sebar share_template/share_template_general), pertahankan baris undangan (kerangka) & orders. Jam retensi tetap active_until. Idempoten via purged_at. Return media_paths (PREFIX 2-varian: galeri DAN foto bernama cover/mempelai/logo, foto per entri cerita story[].photo, serta nilai foto khas tema themePhotos (x-…) yang dipanen dari content sebelum di-scrub — diterima bentuk OBJEK {path,...} maupun STRING lama, story hanya bila array, themePhotos hanya bila objek, lalu disaring ke bentuk inv/<id undangan>/foto/<uuid> tanpa duplikat) + momen_paths (path OBJEK PENUH, hapus langsung: foto momen, video undangan + posternya yang dipanen dari content.video dan disaring ke bentuk video/<id undangan>/<uuid>/(video.*|poster.*), serta SEMUA musik unggahan yang masih hidup menurut music_uploads, disaring ke bentuk audio/<id undangan>/<uuid>.mp3 lalu barisnya ditandai removed_reason=purge). HANYA service_role.';
