-- Kuota tamu Basic 150 → 500 (keputusan pemilik 5 Nov 2026).
--
-- Dua tempat yang HARUS bergerak bersama, karena keduanya menjawab pertanyaan
-- yang sama ("berapa tamu boleh dimasukkan undangan ini?") untuk populasi yang
-- berbeda:
--
--   1. Baris `packages` Basic — undangan yang SUDAH dibayar dengan paket Basic.
--   2. Lantai `normalize_package_limits` — undangan DRAFT (belum berpaket) dan
--      `limits` yang kuncinya hilang/rusak. `invitation_effective_limits`
--      menormalkan `raw NULL` lewat fungsi ini, jadi seluruh penegak kuota
--      (`insert_guest`, `insert_guests_bulk`, trigger `enforce_guest_limit`)
--      membaca angka dari sini.
--
-- Bila hanya (1) yang diubah, draft tetap tertahan di 150 (keadaan yang memicu
-- perubahan ini: undangan draft berisi 150 tamu, tombol Tambah mati) lalu
-- "naik" ke 500 begitu dibayar — dua angka untuk satu paket. Bila hanya (2),
-- pembeli Basic justru turun dari draft-nya. Cermin TypeScript-nya
-- `BASIC_LIMITS.maxGuests` di `lib/limits.ts` (tampilan "x tamu dari y").
--
-- Premium tak tersentuh (`max_guests` JSON null = tanpa batas). Tak ada data
-- tamu yang diubah: menaikkan batas tak pernah membuat baris yang ada melanggar.
-- Sisanya identik migrasi 20260726101500.
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
        else to_jsonb(500)
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
  'Normalisasi packages.limits ke bentuk baku dengan lantai Basic per-kunci (cerminan resolveLimits di lib/limits.ts). max_guests: JSON null=tanpa batas; absen/malformed=500 (Basic, sejak 20261105140000; sebelumnya 150). MURNI/IMMUTABLE. M1.6.';

update public.packages
  set limits = jsonb_set(limits, '{max_guests}', '500'::jsonb)
  where code = 'basic';
