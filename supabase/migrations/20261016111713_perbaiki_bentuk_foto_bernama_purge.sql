-- Purge foto bernama membaca bentuk yang SALAH — dan test-nya mengesahkannya.
--
-- TEMUAN (audit kesiapan cutover R2, 16 Okt 2026). Migrasi 20261014120000
-- memanen path foto bernama dengan `content->>'coverPhoto'`, yakni mengira
-- nilainya STRING. Sejak editor foto non-destruktif ada, `photoSchema`
-- (`src/lib/validation/content/shared.ts:48`) menormalkan SETIAP foto menjadi
-- OBJEK `{path,x,y,zoom}` — dan `photo-field.tsx:114` memang menulis objek.
--
-- `->>` pada objek tidak mengembalikan NULL. Ia mengembalikan TEKS JSON-nya.
-- Dibuktikan di Postgres, bukan disimpulkan:
--
--   select '{"coverPhoto":{"path":"inv/a/foto/b","x":0.5}}'::jsonb
--            ->> 'coverPhoto';
--   → {"x": 0.5, "path": "inv/a/foto/b"}
--
-- Akibatnya, untuk setiap undangan yang punya foto sampul/mempelai/logo:
--
--   1. Yang masuk `media_paths` adalah teks JSON itu, bukan path. Pemanggil
--      menempelkan `/1600.webp` padanya lalu menyerahkannya ke storage. Driver
--      `local` menolaknya di `segmenObjek()` dan MELEMPAR; driver `r2`
--      menyerahkannya ke `new URL()` yang meng-encode `{`/`"`/spasi berbeda
--      dari cara aws4fetch meng-encode `:` dan `,` saat menandatangani →
--      403 SignatureDoesNotMatch. Dua-duanya gagal, hanya dengan pesan beda.
--   2. Foto wajah mempelai TIDAK PERNAH terhapus — persis lubang UU PDP yang
--      migrasi 20261014120000 diklaim menutup. Dan beberapa baris kemudian
--      `content` di-scrub menjadi `'{}'`, jadi satu-satunya rujukan ke objek
--      itu lenyap: objeknya tinggal di storage selamanya, tak tertemukan.
--   3. Barisnya di-set `purged_at`, sehingga cron menyaringnya keluar
--      (`.is("purged_at", null)`) dan tak akan pernah mencoba ulang.
--
-- KENAPA TIDAK TERTANGKAP: fixture pgTAP-nya menulis bentuk STRING
-- (`"coverPhoto":"inv/.../foto/..."`) — bentuk yang sudah tidak pernah ditulis
-- aplikasi sejak editor foto ada. Delapan assert hijau di atas bentuk yang
-- tidak ada di produksi. Fixture-nya ikut ditulis ulang bersama migrasi ini.
--
-- YANG DIPERBAIKI
--
-- `jsonb_typeof`, bukan `coalesce(->'path', ->>'key')`. Keduanya menangani
-- objek + string lama, tetapi `coalesce` masih menghasilkan teks JSON untuk
-- objek RUSAK (tanpa kunci `path`) — persis kelas galat yang sedang dibetulkan.
-- `case` menjawab NULL untuk apa pun yang bukan dua bentuk sah itu.
--
-- Lalu disaring regex bentuk penuh yang TERIKAT pada `p_invitation_id`, cermin
-- persis `isNamedPhotoPath()` di aplikasi. Alasannya: driver R2 tidak
-- memvalidasi path sama sekali (driver `local` punya `segmenObjek`), jadi SQL
-- inilah satu-satunya tempat yang bisa menjamin apa pun yang sampai ke
-- `storage.delete()` berbentuk sah. Mengikat ke id undangan membuat path milik
-- undangan LAIN — apa pun asalnya — tak mungkin ikut terhapus.
--
-- HANYA lengan foto bernama yang disaring. Lengan galeri di atasnya TIDAK
-- boleh ikut: bentuknya `inv/<uuid>/<uuid>` (tanpa segmen `foto`) dan sudah
-- dijamin check constraint `media_storage_path_format`. Regex foto bernama
-- yang diterapkan ke seluruh `v_paths` akan membuang SETIAP prefix galeri —
-- menukar kebocoran foto bernama dengan kebocoran galeri yang jauh lebih luas.
--
-- Sisanya identik migrasi 20261014120000.
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
  'Hapus permanen data pribadi undangan EXPIRED atau SUSPENDED (tamu/RSVP/gift_notes/media/events + Album Momen albums/photos + scrub content), pertahankan baris undangan (kerangka) & orders. Jam retensi tetap active_until. Idempoten via purged_at. Return media_paths (PREFIX 2-varian: galeri DAN foto bernama cover/mempelai/logo yang dipanen dari content sebelum di-scrub — diterima bentuk OBJEK {path,...} maupun STRING lama, lalu disaring ke bentuk inv/<id undangan>/foto/<uuid>) + momen_paths (path OBJEK PENUH foto momen, hapus langsung). HANYA service_role.';
