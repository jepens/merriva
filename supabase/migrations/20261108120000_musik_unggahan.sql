-- Musik unggahan klien (DECISIONS #121) — membalik #8 dengan pengaman.
--
-- Pemilik undangan Premium boleh mengunggah SATU lagu MP3 sendiri (≤ 8 MB,
-- 10 dtk–7 menit) sebagai pengganti lagu pustaka. Rujukannya tetap hidup di
-- `content.customMusic` dan disimpan autosave (pola video FASE J). Migrasi ini
-- menambah tiga hal yang TIDAK bisa diserahkan ke `content`, karena `content`
-- ditulis klien dan dikosongkan purge:
--
--  1. `music_uploads` — catatan setiap unggahan, ditulis route unggah lewat
--     service_role. Satu-satunya sumber yang tahu SEMUA objek audio milik
--     sebuah undangan (termasuk yang diunggah lalu tak pernah tersimpan atau
--     sudah diganti), jadi dipakai cron penyapu, purge, takedown, dan kuota
--     harian. Sekaligus catatan pernyataan hak (versi teks yang dicentang,
--     waktu server, sidik berkas) yang tak bisa diubah pemilik dan TETAP ada
--     sesudah takedown/purge — baris tak memuat isi berkas.
--  2. `invitations.music_locked_at` — kunci unggah sesudah takedown admin.
--     Pemilik tak punya hak UPDATE kolom ini (GRANT UPDATE invitations adalah
--     allowlist kolom), jadi kunci hanya bisa dibuka admin.
--  3. `purge_invitation_data` ikut memanen objek audio dari `music_uploads`,
--     serta RPC takedown/buka kunci yang mencatat admin_logs secara atomik.
--
-- Non-destruktif: satu tabel baru + satu kolom nullable + fungsi.

-- -----------------------------------------------------------------------------
-- 1) Kunci unggah musik per undangan
-- -----------------------------------------------------------------------------
alter table public.invitations
  add column if not exists music_locked_at timestamptz;

comment on column public.invitations.music_locked_at is
  'Diisi saat admin menghapus musik unggahan karena laporan (admin_takedown_custom_music). Selama terisi: unggah musik ditolak & musik unggahan tak diputar. Hanya admin yang bisa mengosongkan. DECISIONS #121.';

-- -----------------------------------------------------------------------------
-- 2) Catatan unggah musik
-- -----------------------------------------------------------------------------
create table public.music_uploads (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null
    references public.invitations (id) on delete cascade,
  -- SET NULL: hapus akun memutus tautan ke identitas (janji /privasi), catatan
  -- lainnya (sidik berkas, waktu, versi pernyataan) tetap sebagai jejak.
  user_id uuid references public.profiles (id) on delete set null,
  path text not null unique,
  sha256 text not null,
  bytes integer not null,
  duration_ms integer not null,
  attest_version smallint not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_reason text,
  -- Path TERIKAT pada undangannya: bentuk penuh, cermin `isCustomMusicPath()`
  -- di `lib/media.ts` (keduanya harus berubah bersama).
  constraint music_uploads_path_format check (
    path ~ ('^audio/' || invitation_id::text ||
            '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp3$')
  ),
  constraint music_uploads_sha256_format check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint music_uploads_bytes_positive check (bytes > 0),
  constraint music_uploads_duration_positive check (duration_ms > 0),
  constraint music_uploads_attest_positive check (attest_version > 0),
  constraint music_uploads_removed_pair check (
    (removed_at is null) = (removed_reason is null)
  ),
  constraint music_uploads_removed_reason check (
    removed_reason in ('replaced', 'purge', 'takedown')
  )
);

-- Kuota harian & daftar per undangan (route unggah, takedown, purge).
create index music_uploads_invitation_idx
  on public.music_uploads (invitation_id, created_at desc);
-- Cron penyapu: hanya baris yang objeknya masih hidup.
create index music_uploads_live_idx
  on public.music_uploads (created_at) where removed_at is null;

comment on table public.music_uploads is
  'Catatan setiap unggahan musik klien (DECISIONS #121): objek audio/<undangan>/<uuid>.mp3 + sidik sha256 byte yang disimpan + versi pernyataan hak yang dicentang. Ditulis route unggah lewat service_role; dibaca cron penyapu, purge, takedown admin, dan kuota harian. Baris TIDAK dihapus saat objeknya dihapus — removed_at/removed_reason mencatat sebabnya. HANYA service_role.';
comment on column public.music_uploads.removed_reason is
  'replaced = disapu cron (tak lagi dirujuk content) · purge = retensi/hapus akun · takedown = dihapus admin karena laporan. (Draft yang dihapus pemilik ikut menghapus barisnya lewat FK cascade; objeknya dihapus aksi hapus draft.)';

-- RLS wajib (CLAUDE.md). TANPA policy: hanya service_role (bypass RLS) yang
-- menyentuh tabel ini. Pemilik undangan tak boleh membaca/menulis catatannya
-- sendiri — justru itu yang membuatnya bisa dipercaya sebagai catatan.
alter table public.music_uploads enable row level security;

-- `revoke all` juga dari service_role: default privileges Supabase memberinya
-- DELETE/TRUNCATE/REFERENCES/TRIGGER pada tabel baru. Catatan unggah tak
-- pernah dihapus aplikasi (hanya ditandai removed_*); baris draft yang dihapus
-- ikut FK cascade, yang tak butuh hak DELETE pemanggil.
revoke all on table public.music_uploads from anon, authenticated, service_role;
grant select, insert, update on table public.music_uploads to service_role;

-- -----------------------------------------------------------------------------
-- 3) Retensi: purge ikut memanen objek musik
-- -----------------------------------------------------------------------------
-- Badan fungsi = definisi terakhir (20261108100000_sebar_template_tersimpan.sql)
-- APA ADANYA, ditambah satu blok pemanenan musik dan penandaan barisnya.
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
  'Hapus permanen data pribadi undangan EXPIRED atau SUSPENDED (tamu/RSVP/gift_notes/media/events + Album Momen albums/photos + scrub content & template Sebar share_template/share_template_general), pertahankan baris undangan (kerangka) & orders. Jam retensi tetap active_until. Idempoten via purged_at. Return media_paths (PREFIX 2-varian: galeri DAN foto bernama cover/mempelai/logo yang dipanen dari content sebelum di-scrub — diterima bentuk OBJEK {path,...} maupun STRING lama, lalu disaring ke bentuk inv/<id undangan>/foto/<uuid>) + momen_paths (path OBJEK PENUH, hapus langsung: foto momen, video undangan + posternya yang dipanen dari content.video dan disaring ke bentuk video/<id undangan>/<uuid>/(video.*|poster.*), serta SEMUA musik unggahan yang masih hidup menurut music_uploads, disaring ke bentuk audio/<id undangan>/<uuid>.mp3 lalu barisnya ditandai removed_reason=purge). HANYA service_role.';

-- -----------------------------------------------------------------------------
-- 4) Takedown & buka kunci oleh admin — atomik dengan admin_logs
-- -----------------------------------------------------------------------------
-- Pola `admin_suspend_invitation` (20260730150000): catatan audit ditulis di
-- transaksi yang sama dengan tindakannya, bukan best-effort sesudahnya —
-- inilah bukti tindakan atas laporan pelanggaran. Objek storage dihapus
-- PEMANGGIL sesudah RPC sukses (SQL tak bisa menyentuh bucket).
--
-- `content - 'customMusic'` adalah operasi JSONB di dalam UPDATE, jadi tak ada
-- lost update terhadap autosave pemilik yang berjalan bersamaan (berbeda
-- dengan membaca content lalu menulis ulang seluruhnya dari aplikasi). Tab
-- editor lama yang masih terbuka bisa menulis rujukannya kembali — tak apa:
-- objeknya sudah dihapus dan kunci membuat perakit render mengabaikannya.
create or replace function public.admin_takedown_custom_music(
  p_invitation_id uuid,
  p_admin_id uuid,
  p_reason text,
  p_public_reason text
) returns table (result text, slug text, owner_id uuid, paths text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_paths text[];
  v_files jsonb;
begin
  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text, null::text, null::uuid, null::text[];
    return;
  end if;

  select coalesce(array_agg(m.path order by m.created_at), '{}'),
         coalesce(jsonb_agg(jsonb_build_object(
           'path', m.path,
           'sha256', m.sha256,
           'bytes', m.bytes,
           'duration_ms', m.duration_ms,
           'attest_version', m.attest_version,
           'uploaded_by', m.user_id,
           'uploaded_at', m.created_at
         ) order by m.created_at), '[]'::jsonb)
    into v_paths, v_files
    from public.music_uploads m
    where m.invitation_id = p_invitation_id and m.removed_at is null;

  update public.music_uploads
    set removed_at = now(), removed_reason = 'takedown'
    where invitation_id = p_invitation_id and removed_at is null;

  update public.invitations
    set content = content - 'customMusic',
        music_locked_at = now(),
        updated_at = now()
    where id = p_invitation_id;

  insert into public.admin_logs (
    admin_id, action, target_type, target_id, detail
  ) values (
    p_admin_id, 'invitation.music_takedown', 'invitation', p_invitation_id,
    jsonb_build_object(
      'reason', p_reason,
      'public_reason', p_public_reason,
      'owner_id', v_inv.user_id,
      'files', v_files
    )
  );

  return query select 'removed'::text, v_inv.slug, v_inv.user_id, v_paths;
end;
$$;

create or replace function public.admin_unlock_custom_music(
  p_invitation_id uuid,
  p_admin_id uuid
) returns table (result text, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
begin
  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;
  if v_inv.music_locked_at is null then
    return query select 'not_locked'::text, v_inv.slug;
    return;
  end if;

  update public.invitations
    set music_locked_at = null, updated_at = now()
    where id = p_invitation_id;

  insert into public.admin_logs (
    admin_id, action, target_type, target_id, detail
  ) values (
    p_admin_id, 'invitation.music_unlock', 'invitation', p_invitation_id,
    jsonb_build_object('locked_at', v_inv.music_locked_at)
  );

  return query select 'unlocked'::text, v_inv.slug;
end;
$$;

revoke execute on function
  public.admin_takedown_custom_music(uuid, uuid, text, text),
  public.admin_unlock_custom_music(uuid, uuid)
  from anon, authenticated, public;
grant execute on function
  public.admin_takedown_custom_music(uuid, uuid, text, text),
  public.admin_unlock_custom_music(uuid, uuid)
  to service_role;

comment on function public.admin_takedown_custom_music(uuid, uuid, text, text) is
  'Takedown musik unggahan (DECISIONS #121): tandai SEMUA baris music_uploads hidup milik undangan sebagai takedown, buang content.customMusic, kunci unggah (music_locked_at), dan catat admin_logs (alasan internal + publik + sidik setiap berkas) dalam satu transaksi. Mengembalikan path objek untuk dihapus pemanggil. HANYA service_role.';
comment on function public.admin_unlock_custom_music(uuid, uuid) is
  'Buka kunci unggah musik sesudah takedown (DECISIONS #121), tercatat di admin_logs. HANYA service_role.';

-- -----------------------------------------------------------------------------
-- 5) Kandidat penyapu — saringan "tak lagi dirujuk" DI DB
-- -----------------------------------------------------------------------------
-- Cron penyapu (`server/cron/music-sweep.ts`) dulu membaca baris hidup > 24 jam
-- berhalaman lalu menyaring rujukan di aplikasi, dengan plafon pindai. Rujukan
-- yang sedang dipakai juga baris hidup > 24 jam dan TAK PERNAH keluar dari
-- saringan itu, jadi begitu jumlahnya melewati plafon, setiap jalankan habis
-- membaca rujukan lama dan objek usang di belakangnya tak pernah tersentuh.
-- Di sini rujukan saat ini tak pernah muncul sama sekali, sehingga `limit`
-- hanya terisi kandidat sungguhan.
--
-- Bukan SECURITY DEFINER: pemanggilnya service_role (bypass RLS, punya SELECT
-- di kedua tabel); EXECUTE dicabut dari peran lain.
create or replace function public.music_uploads_usang(
  p_sebelum timestamptz,
  p_batas integer
) returns table (id uuid, path text)
language sql
stable
set search_path = ''
as $$
  select m.id, m.path
  from public.music_uploads m
  join public.invitations i on i.id = m.invitation_id
  where m.removed_at is null
    and m.created_at < p_sebelum
    and (
      i.purged_at is not null
      or (i.content #>> '{customMusic,path}') is distinct from m.path
    )
  order by m.created_at, m.id
  limit greatest(p_batas, 0)
$$;

revoke execute on function public.music_uploads_usang(timestamptz, integer)
  from anon, authenticated, public;
grant execute on function public.music_uploads_usang(timestamptz, integer)
  to service_role;

comment on function public.music_uploads_usang(timestamptz, integer) is
  'Kandidat cron penyapu musik unggahan (DECISIONS #121): baris music_uploads HIDUP yang dibuat sebelum p_sebelum dan TIDAK dirujuk content.customMusic.path undangannya, urut (created_at, id), maks. p_batas baris. Rujukan saat ini tak pernah muncul, jadi limit tak bisa dipenuhi rujukan lama yang menutupi objek usang di belakangnya. Undangan yang sudah di-purge dianggap TAK merujuk apa pun walau content-nya berisi rujukan — menutup jendela TOCTOU unggah-vs-purge (baris yang tercatat SESUDAH purge menandai baris hidup lolos dari penandaan itu) dan sisa jalur hapus akun yang menjawab already_purged. customMusic yang bukan objek → #>> NULL → dianggap tak merujuk. Pemanggil menghapus objeknya lalu menandai baris removed_reason=replaced. HANYA service_role.';
