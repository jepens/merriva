-- Template pesan Sebar Undangan tersimpan per undangan (DECISIONS #120).
--
-- Sebelumnya template hanya hidup di state halaman: hilang saat dimuat ulang,
-- dan saat Android membuang tab ketika pemilik berada di WhatsApp — pesan
-- berikutnya diam-diam kembali ke bawaan. Penyebaran ke ratusan tamu selalu
-- berlangsung dalam beberapa sesi.
--
-- NULL = pakai template bawaan (lib/copy.ts) — sehingga perbaikan teks bawaan
-- (mis. kalimat "tanpa aplikasi") ikut sampai ke undangan yang belum pernah
-- menyunting templatenya.
--
-- Non-destruktif: dua kolom nullable baru. Tidak dibaca halaman publik (yang
-- memilih kolom secara eksplisit lewat service_role) — template adalah draf
-- pesan milik pemilik. Karena bisa memuat data pribadi, purge retensi ikut
-- mengosongkannya (bagian bawah berkas ini).

alter table public.invitations
  add column if not exists share_template text
    constraint invitations_share_template_len
      check (share_template is null or char_length(share_template) <= 2000),
  add column if not exists share_template_general text
    constraint invitations_share_template_general_len
      check (share_template_general is null or char_length(share_template_general) <= 2000);

comment on column public.invitations.share_template is
  'Template pesan Sebar personal ({nama},{link},{acara},{tanggal}); NULL = bawaan. DECISIONS #120.';
comment on column public.invitations.share_template_general is
  'Template pesan Sebar umum tanpa nama tamu; NULL = bawaan. DECISIONS #120.';

-- GRANT UPDATE pada invitations adalah allowlist kolom (init_schema): kolom
-- baru TIDAK otomatis bisa ditulis pemilik. Kepemilikan tetap ditegakkan RLS
-- `invitations_update` (user_id = auth.uid() atau admin).
grant update (share_template, share_template_general)
  on public.invitations to authenticated;

-- Retensi UU PDP: template bisa memuat data pribadi (nama keluarga, nomor HP
-- pengirim). Purge — juga jalur hapus akun admin_delete_account — WAJIB ikut
-- mengosongkannya, sejalan janji DATA-MODEL §5 bahwa kerangka undangan yang
-- dipertahankan tak memuat data pribadi. Badan fungsi = definisi terakhir
-- (20261105100000_video_undangan.sql) APA ADANYA, hanya UPDATE akhirnya yang
-- menambah dua kolom ini.
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
  'Hapus permanen data pribadi undangan EXPIRED atau SUSPENDED (tamu/RSVP/gift_notes/media/events + Album Momen albums/photos + scrub content & template Sebar share_template/share_template_general), pertahankan baris undangan (kerangka) & orders. Jam retensi tetap active_until. Idempoten via purged_at. Return media_paths (PREFIX 2-varian: galeri DAN foto bernama cover/mempelai/logo yang dipanen dari content sebelum di-scrub — diterima bentuk OBJEK {path,...} maupun STRING lama, lalu disaring ke bentuk inv/<id undangan>/foto/<uuid>) + momen_paths (path OBJEK PENUH, hapus langsung: foto momen DAN video undangan + posternya yang dipanen dari content.video, disaring ke bentuk video/<id undangan>/<uuid>/(video.*|poster.*)). HANYA service_role.';
