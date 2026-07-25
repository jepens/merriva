-- M1.6 — Penegakan limit paket sisi server: SATU sumber kebenaran.
--
-- Sebelumnya limit foto dihitung inline di `insert_gallery_media`, watermark
-- dihitung ad-hoc di halaman preview, dan tamu belum ditegakkan sama sekali.
-- Migrasi ini memusatkan resolusi batas paket di DB, lalu:
--   1) memakainya ulang di `insert_gallery_media` (DRY), dan
--   2) menyediakan RPC atomik `insert_guest` (struktur siap untuk CRUD tamu M2).
--
-- Prinsip lantai Basic (SPEC §2): undangan draft belum punya paket → batas Basic
-- (8 foto, 150 tamu, watermark). Batas OTORITATIF selalu dihitung di DB (tak bisa
-- di-override lewat argumen REST). `max_guests` JSON null = tanpa batas (Premium).
--
-- FAIL-SAFE (pasca-review adversarial): `packages.limits` adalah `jsonb not null
-- default '{}'` tanpa CHECK bentuk, dan admin bisa menulis objek limits parsial.
-- Operator `->>` mengembalikan SQL NULL untuk kunci yang ABSEN maupun JSON null
-- eksplisit — tak terbedakan. Bila `insert_guest` hanya melewati pengecekan saat
-- max_guests NULL, paket dengan kunci max_guests HILANG akan gagal-BUKA (tamu tanpa
-- batas), padahal harus jatuh ke lantai Basic 150. Karena itu semua batas
-- DINORMALKAN dulu lewat `normalize_package_limits` yang membedakan absen/malformed
-- (→ lantai Basic) dari JSON null eksplisit (→ tanpa batas). Ini menjaga DB tetap
-- SEPADAN dengan `resolveLimits` di `src/lib/limits.ts`. Kami sengaja TIDAK memasang
-- CHECK bentuk kaku pada `packages.limits` agar paket tetap fleksibel; normalisasi
-- inilah lapisan keamanannya.

-- -----------------------------------------------------------------------------
-- 1. Normalisasi bentuk limits — MURNI (tanpa akses tabel) → IMMUTABLE & mudah
--    diuji langsung atas literal. Cerminan persis `resolveLimits` (lib/limits.ts):
--      max_photos : angka > 0 → nilai; selain itu → 8
--      max_guests : JSON null eksplisit → null (tanpa batas, Premium);
--                   angka > 0 → nilai; ABSEN / malformed (0, negatif, non-angka) → 150
--      youtube/all_themes/watermark : boolean → nilai; selain itu → default Basic
--    Input NULL (draft tanpa paket) → seluruh kunci jatuh ke lantai Basic.
--    Catatan: `jsonb_typeof(raw -> 'k')` = SQL NULL untuk kunci ABSEN, tetapi teks
--    'null' untuk JSON null eksplisit → itulah yang memisahkan keduanya.
-- -----------------------------------------------------------------------------
create or replace function public.normalize_package_limits(raw jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'max_photos',
      case
        when jsonb_typeof(raw -> 'max_photos') = 'number'
             and (raw ->> 'max_photos')::numeric > 0
        then trunc((raw ->> 'max_photos')::numeric)::int
        else 8
      end,
    'max_guests',
      case
        when jsonb_typeof(raw -> 'max_guests') = 'null' then 'null'::jsonb
        when jsonb_typeof(raw -> 'max_guests') = 'number'
             and (raw ->> 'max_guests')::numeric > 0
        then to_jsonb(trunc((raw ->> 'max_guests')::numeric)::int)
        else to_jsonb(150)
      end,
    'youtube',
      case when jsonb_typeof(raw -> 'youtube') = 'boolean'
           then (raw ->> 'youtube')::boolean else false end,
    'all_themes',
      case when jsonb_typeof(raw -> 'all_themes') = 'boolean'
           then (raw ->> 'all_themes')::boolean else false end,
    'watermark',
      case when jsonb_typeof(raw -> 'watermark') = 'boolean'
           then (raw ->> 'watermark')::boolean else true end
  );
$$;

revoke execute on function public.normalize_package_limits(jsonb) from anon, public;
grant execute on function public.normalize_package_limits(jsonb) to authenticated, service_role;

comment on function public.normalize_package_limits(jsonb) is
  'Normalisasi packages.limits ke bentuk baku dengan lantai Basic per-kunci (cerminan resolveLimits di lib/limits.ts). max_guests: JSON null=tanpa batas; absen/malformed=150. MURNI/IMMUTABLE. M1.6.';

-- -----------------------------------------------------------------------------
-- 2. Resolver batas efektif per undangan.
--    SECURITY INVOKER → RLS `owns_invitation` berlaku ke SELECT pemanggil, jadi
--    non-pemilik tak melihat baris → FOUND false → NULL (dipakai pemanggil
--    sebagai sinyal "bukan milik / tak ada"). Undangan tanpa paket → raw NULL →
--    `normalize_package_limits` mengembalikan lantai Basic penuh.
-- -----------------------------------------------------------------------------
create or replace function public.invitation_effective_limits(inv_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  raw jsonb;
begin
  select p.limits
    into raw
    from public.invitations i
    left join public.packages p on p.id = i.package_id
    where i.id = inv_id;

  if not found then
    return null; -- undangan tak terlihat (bukan milik pemanggil) / tak ada
  end if;

  -- raw NULL (draft) atau JSONB paket → dinormalkan (lantai Basic per-kunci).
  return public.normalize_package_limits(raw);
end;
$$;

revoke execute on function public.invitation_effective_limits(uuid) from anon, public;
grant execute on function public.invitation_effective_limits(uuid) to authenticated, service_role;

comment on function public.invitation_effective_limits(uuid) is
  'Batas paket efektif (JSONB ternormalkan) untuk sebuah undangan; lantai Basic bila draft. NULL = bukan milik pemanggil / tak ada. SECURITY INVOKER → RLS owns_invitation. M1.6.';

-- -----------------------------------------------------------------------------
-- 3. Sisip foto galeri atomik — kini memakai resolver bersama (DRY).
--    Perilaku identik dengan M1.4; hanya sumber limit yang dipusatkan.
-- -----------------------------------------------------------------------------
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
  lim jsonb;
  limit_photos int;
  cur int;
  next_sort int;
  result public.media;
begin
  perform pg_advisory_xact_lock(hashtextextended(inv_id::text, 0));

  lim := public.invitation_effective_limits(inv_id);
  if lim is null then
    return null; -- undangan tak terlihat (bukan milik pemanggil)
  end if;
  -- Ternormalkan → selalu angka > 0; coalesce hanya pertahanan tambahan.
  limit_photos := coalesce((lim ->> 'max_photos')::int, 8);

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

comment on function public.insert_gallery_media(uuid, uuid, text, int, int) is
  'Sisip 1 foto galeri atomik; limit paket via invitation_effective_limits + advisory lock per-undangan (seed 0). SECURITY INVOKER → RLS owns_invitation. NULL = bukan pemilik / limit penuh. M1.4→M1.6.';

-- -----------------------------------------------------------------------------
-- 4. Sisip 1 tamu atomik dengan penegakan limit paket — STRUKTUR SIAP M2.
--    Pola identik dengan foto: advisory lock per-undangan (seed 1 → beda ruang
--    dari foto agar tambah-tamu tak memblok tambah-foto), limit dihitung di DB.
--    Karena limit sudah DINORMALKAN, `max_guests` NULL kini HANYA berarti tanpa
--    batas (Premium) — kunci absen/malformed sudah jatuh ke 150 di resolver, jadi
--    tak ada lagi gagal-BUKA. NULL (return) = bukan pemilik / limit penuh.
--    Token unik dibuat pemanggil (nanoid); pelanggaran unik akan menggagalkan tx
--    (ditangani pemanggil M2). Importir massal M2 akan memakai ulang resolver ini
--    di bawah advisory lock yang sama (satu cek batas untuk seluruh batch).
-- -----------------------------------------------------------------------------
create or replace function public.insert_guest(
  inv_id uuid,
  guest_name text,
  guest_token text,
  guest_phone text default null,
  guest_group_label text default null,
  guest_pax int default 2,
  guest_notes text default null
)
returns public.guests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lim jsonb;
  max_g int;
  cur int;
  result public.guests;
begin
  perform pg_advisory_xact_lock(hashtextextended(inv_id::text, 1));

  lim := public.invitation_effective_limits(inv_id);
  if lim is null then
    return null; -- undangan tak terlihat (bukan milik pemanggil)
  end if;

  -- Ternormalkan: max_guests SQL NULL ⇔ JSON null eksplisit = tanpa batas (Premium).
  max_g := (lim ->> 'max_guests')::int;
  if max_g is not null then
    select count(*) into cur
      from public.guests
      where invitation_id = inv_id;
    if cur >= max_g then
      return null; -- batas paket tamu tercapai
    end if;
  end if;

  insert into public.guests
    (invitation_id, name, phone, group_label, pax_allocated, token, notes)
  values
    (inv_id, guest_name, guest_phone, guest_group_label,
     coalesce(guest_pax, 2), guest_token, guest_notes)
  returning * into result;

  return result;
end;
$$;

revoke execute on function
  public.insert_guest(uuid, text, text, text, text, int, text)
  from anon, public;
grant execute on function
  public.insert_guest(uuid, text, text, text, text, int, text)
  to authenticated, service_role;

comment on function public.insert_guest(uuid, text, text, text, text, int, text) is
  'Sisip 1 tamu atomik dengan limit paket (max_guests ternormalkan; null=tanpa batas) via invitation_effective_limits + advisory lock per-undangan (seed 1). SECURITY INVOKER → RLS owns_invitation. NULL = bukan pemilik / limit penuh. Struktur siap CRUD tamu M2. M1.6.';
