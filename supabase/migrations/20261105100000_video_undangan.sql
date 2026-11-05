-- Video undangan (FASE J): bucket menerima video, dan retensi ikut menghapusnya.
--
-- 1) BUCKET `media`. Bucket ini terkunci ke MIME gambar + audio, 8 MB
--    (20260804190000, 20260826100000). Dengan driver `supabase` (bawaan dev &
--    CI), unggah video ditolak storage sebelum menyentuh aplikasi. Batas baru =
--    `VIDEO_MAX_BYTES` (`lib/video.ts`, 40 MB, keputusan owner 5 Nov 2026);
--    validasi ketat per-tipe dan per-ukuran tetap DI APLIKASI (route
--    `/api/invitations/[id]/video` + `isVariantBlob` untuk poster). Produksi
--    hari ini memakai driver `local` sehingga bucket ini tak dilewati di sana —
--    tetapi migrasi ini membuat dev, CI, dan cutover ke Supabase/R2 berikutnya
--    tak menemukan kejutan.
--
-- 2) RETENSI. Video tak punya baris tabel — pathnya hidup di `content.video`,
--    yang di-scrub `purge_invitation_data`. Tanpa pemanenan di sini, klip wajah
--    mempelai tertinggal di storage selamanya setelah satu-satunya rujukannya
--    dihapus: persis lubang yang ditutup 20261014120000 untuk foto bernama.
--    Fungsi di bawah identik 20261016111713 kecuali satu blok `v_momen`.
update storage.buckets
set
  allowed_mime_types = array[
    'image/webp',
    'image/jpeg',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/opus',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]::text[],
  file_size_limit = 41943040 -- 40 MB = VIDEO_MAX_BYTES
where id = 'media';

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
  v_paths := v_paths || (
    select coalesce(array_agg(p), '{}')
    from (
      select case jsonb_typeof(nilai)
               when 'object' then nilai->>'path'
               when 'string' then nilai #>> '{}'
             end as p
      from unnest(array[
        v_inv.content->'coverPhoto',
        v_inv.content->'groom'->'photo',
        v_inv.content->'bride'->'photo',
        v_inv.content->'logo'
      ]) as nilai
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
  'Hapus permanen data pribadi undangan EXPIRED atau SUSPENDED (tamu/RSVP/gift_notes/media/events + Album Momen albums/photos + scrub content), pertahankan baris undangan (kerangka) & orders. Jam retensi tetap active_until. Idempoten via purged_at. Return media_paths (PREFIX 2-varian: galeri DAN foto bernama cover/mempelai/logo yang dipanen dari content sebelum di-scrub — diterima bentuk OBJEK {path,...} maupun STRING lama, lalu disaring ke bentuk inv/<id undangan>/foto/<uuid>) + momen_paths (path OBJEK PENUH, hapus langsung: foto momen DAN video undangan + posternya yang dipanen dari content.video, disaring ke bentuk video/<id undangan>/<uuid>/(video.*|poster.*)). HANYA service_role.';
