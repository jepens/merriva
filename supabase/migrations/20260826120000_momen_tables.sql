-- Album Momen (FASE H) — tabel + RLS fail-closed + RPC kuota confirm-gated.
-- MOMEN-SPEC §4–§6, DECISIONS #22. Tamu ANON tak menyentuh DB langsung: server
-- action (verifikasi sesi HMAC + Turnstile + rate-limit) memanggil RPC via
-- service_role. RLS enable + policy owner/admin (defense); anon TANPA policy
-- (fail-closed) — baca publik pra/pasca-reveal ditangani route SSR (service_role
-- + logika album-phase). Model peserta: kuota = count(distinct device_id).

-- -----------------------------------------------------------------------------
-- 1. Tabel
-- -----------------------------------------------------------------------------
create table public.momen_albums (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived')),
  -- Tier dijual per JUMLAH PESERTA (device_id unik). NULL = tak terbatas.
  quota_peserta int check (quota_peserta is null or quota_peserta between 1 and 100000),
  -- Rem darurat storage untuk tier ∞ (tak diiklankan). NULL = tak ada.
  photo_ceiling int check (photo_ceiling is null or photo_ceiling > 0),
  quota_per_guest int not null default 5 check (quota_per_guest between 1 and 20),
  reveal_at timestamptz, -- NULL = instan
  default_filter text not null default 'hangat',
  allow_library_upload boolean not null default false, -- false = hanya kamera
  photo_count int not null default 0, -- counter total foto (dirawat RPC, race-safe)
  created_at timestamptz not null default now()
);
comment on table public.momen_albums is 'Album kamera-sekali-pakai per undangan (add-on). Kuota per PESERTA (quota_peserta; NULL=∞). Foto tersembunyi sampai reveal_at.';

create table public.momen_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.momen_albums (id) on delete cascade,
  guest_name text not null,
  device_id uuid not null, -- identitas perangkat (localStorage) → hitung peserta & jatah
  filter_id text not null,
  -- Path relatif immutable (pola constraint seperti media). Ekstensi webp|jpg
  -- (fallback iOS). Prefix momen/<album>/<photo>/.
  storage_path text not null check (
    storage_path ~ '^momen/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/display\.(webp|jpg)$'
  ),
  thumb_path text not null check (
    thumb_path ~ '^momen/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/thumb\.(webp|jpg)$'
  ),
  width int not null check (width between 1 and 2400),
  height int not null check (height between 1 and 2400),
  bytes int not null check (bytes > 0),
  status text not null default 'visible' check (status in ('visible', 'hidden')), -- hidden = dimoderasi host
  created_at timestamptz not null default now()
);
comment on table public.momen_photos is 'PRIVAT pra-reveal: foto tak boleh dibaca tamu sebelum reveal_at (fail-closed via route/RPC). device_id = identitas peserta.';

create index momen_photos_album_created_idx on public.momen_photos (album_id, created_at);
create index momen_photos_album_device_idx on public.momen_photos (album_id, device_id);

-- -----------------------------------------------------------------------------
-- 2. Grants objek (default-privileges tabel-masa-depan DICABUT di migrasi
--    20260808130000 → WAJIB eksplisit). service_role: penuh. authenticated:
--    SELECT saja (RLS batasi baris ke pemilik). anon: TIDAK ada (fail-closed).
-- -----------------------------------------------------------------------------
grant all on public.momen_albums, public.momen_photos to service_role;
grant select on public.momen_albums, public.momen_photos to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Helper kepemilikan album (SECURITY DEFINER; skema `private` seperti
--    is_admin/owns_invitation — harden_functions). Tak rekursif ke RLS.
-- -----------------------------------------------------------------------------
create or replace function private.owns_momen_album(p_album_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.momen_albums a
    join public.invitations i on i.id = a.invitation_id
    where a.id = p_album_id and i.user_id = auth.uid()
  );
$$;
grant execute on function private.owns_momen_album(uuid)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. RLS — owner SELECT (dashboard defense; jalur utama service_role) + admin ALL.
--    anon TANPA policy → tak bisa baca apa pun langsung (fail-closed). Tulis
--    hanya via service_role (RPC/server action).
-- -----------------------------------------------------------------------------
alter table public.momen_albums enable row level security;
alter table public.momen_photos enable row level security;

create policy momen_albums_select on public.momen_albums
  for select to authenticated
  using (private.owns_invitation(invitation_id) or private.is_admin());
create policy momen_albums_admin_all on public.momen_albums
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy momen_photos_select on public.momen_photos
  for select to authenticated
  using (private.owns_momen_album(album_id) or private.is_admin());
create policy momen_photos_admin_all on public.momen_photos
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- -----------------------------------------------------------------------------
-- 5. RPC create_momen_album — dipanggil saat aktivasi (order add-on lunas ATAU
--    tier gratis). Idempoten (unique invitation_id). service_role only.
-- -----------------------------------------------------------------------------
create or replace function public.create_momen_album(
  p_invitation_id uuid,
  p_quota_peserta int,
  p_photo_ceiling int,
  p_default_filter text default 'hangat'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.momen_albums (invitation_id, quota_peserta, photo_ceiling, default_filter)
  values (p_invitation_id, p_quota_peserta, p_photo_ceiling, coalesce(p_default_filter, 'hangat'))
  on conflict (invitation_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Sudah ada (beli ulang / webhook dobel) → kembalikan album yang ada.
    select id into v_id from public.momen_albums where invitation_id = p_invitation_id;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC momen_claim_upload — PRA-CEK (soft) sebelum unggah: album aktif + jatah
--    per-tamu + peserta + plafon. Kembalikan photo_id (untuk path) + sisa jatah.
--    Penegakan OTORITATIF tetap di confirm (atomik). service_role only.
-- -----------------------------------------------------------------------------
create or replace function public.momen_claim_upload(
  p_album_id uuid,
  p_device_id uuid
) returns table (result text, photo_id uuid, remaining int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.momen_albums%rowtype;
  v_device int;
  v_participants int;
begin
  select * into v from public.momen_albums where id = p_album_id;
  if not found then
    return query select 'not_found'::text, null::uuid, 0;
    return;
  end if;
  if v.status <> 'active' then
    return query select 'not_active'::text, null::uuid, 0;
    return;
  end if;

  select count(*) into v_device
    from public.momen_photos where album_id = p_album_id and device_id = p_device_id;
  if v_device >= v.quota_per_guest then
    return query select 'guest-quota'::text, null::uuid, 0;
    return;
  end if;

  -- Peserta = device_id unik yang pernah memotret. Cek hanya untuk device BARU.
  if v_device = 0 and v.quota_peserta is not null then
    select count(distinct device_id) into v_participants
      from public.momen_photos where album_id = p_album_id;
    if v_participants >= v.quota_peserta then
      return query select 'peserta-penuh'::text, null::uuid, 0;
      return;
    end if;
  end if;

  if v.photo_ceiling is not null and v.photo_count >= v.photo_ceiling then
    return query select 'album-full'::text, null::uuid, 0;
    return;
  end if;

  return query select 'ok'::text, gen_random_uuid(), (v.quota_per_guest - v_device);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC momen_confirm_photo — GERBANG ATOMIK. advisory lock per-album →
--    parallel confirm terserialisasi (kuota tak bisa tembus). Cek ulang lalu
--    sisip baris + naikkan photo_count dalam satu transaksi. service_role only.
--    Path/dimensi/bytes sudah divalidasi server action (skema + magic-byte).
-- -----------------------------------------------------------------------------
create or replace function public.momen_confirm_photo(
  p_album_id uuid,
  p_photo_id uuid,
  p_device_id uuid,
  p_guest_name text,
  p_filter_id text,
  p_storage_path text,
  p_thumb_path text,
  p_width int,
  p_height int,
  p_bytes int
) returns table (result text, remaining int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.momen_albums%rowtype;
  v_device int;
  v_participants int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_album_id::text, 0));

  select * into v from public.momen_albums where id = p_album_id for update;
  if not found then
    return query select 'not_found'::text, 0;
    return;
  end if;
  if v.status <> 'active' then
    return query select 'not_active'::text, 0;
    return;
  end if;

  select count(*) into v_device
    from public.momen_photos where album_id = p_album_id and device_id = p_device_id;
  if v_device >= v.quota_per_guest then
    return query select 'guest-quota'::text, 0;
    return;
  end if;

  if v_device = 0 and v.quota_peserta is not null then
    select count(distinct device_id) into v_participants
      from public.momen_photos where album_id = p_album_id;
    if v_participants >= v.quota_peserta then
      return query select 'peserta-penuh'::text, 0;
      return;
    end if;
  end if;

  if v.photo_ceiling is not null and v.photo_count >= v.photo_ceiling then
    return query select 'album-full'::text, 0;
    return;
  end if;

  insert into public.momen_photos
    (id, album_id, guest_name, device_id, filter_id, storage_path, thumb_path, width, height, bytes)
  values
    (p_photo_id, p_album_id, p_guest_name, p_device_id, p_filter_id, p_storage_path, p_thumb_path, p_width, p_height, p_bytes);

  update public.momen_albums set photo_count = photo_count + 1 where id = p_album_id;

  return query select 'ok'::text, (v.quota_per_guest - v_device - 1);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Hardening execute: HANYA service_role (dipanggil dari server action/route
--    yang sudah memverifikasi sesi & kepemilikan). Cabut dari anon/auth/public.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.create_momen_album(uuid, int, int, text),
  public.momen_claim_upload(uuid, uuid),
  public.momen_confirm_photo(uuid, uuid, uuid, text, text, text, text, int, int, int)
  from anon, authenticated, public;
grant execute on function
  public.create_momen_album(uuid, int, int, text),
  public.momen_claim_upload(uuid, uuid),
  public.momen_confirm_photo(uuid, uuid, uuid, text, text, text, text, int, int, int)
  to service_role;
