-- Merriva — id sesi jadwal STABIL lintas simpan (DECISIONS #43).
--
-- Dulu RPC ini menghapus SEMUA sesi lalu menyisipkan ulang, sehingga id setiap
-- sesi berganti pada SETIAP autosave (payload = seluruh form, dari langkah mana
-- pun). Akibatnya:
--   - tautan `/api/ics/{slug}?e={id}` di HTML yang sudah terbuka/ter-cache → 404;
--   - UID kalender `{id}@merriva.id` berganti → tamu yang menambah ulang sesi
--     mendapat entri GANDA, bukan pembaruan;
--   - FK check-in Fase 2 ke sesi akan ikut terhapus (cascade) tiap autosave.
--
-- Kini aplikasi mengirim id tiap sesi (id baru dibuat editor saat kartu
-- ditambah) dan RPC meng-upsert per id: sesi yang masih ada DIPERBARUI di
-- tempat, yang tak dikirim lagi dihapus, yang tanpa id disisipkan dengan id baru.
--
-- Tidak destruktif: hanya mengganti definisi fungsi; tak ada baris/kolom diubah.
-- Kompatibel dua arah: aplikasi lama (tanpa id) → semua sesi lama terhapus dan
-- disisipkan ulang ber-id baru, persis perilaku sebelumnya.
create or replace function public.replace_invitation_events(inv_id uuid, events jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  items jsonb := case when jsonb_typeof(events) = 'array' then events else '[]'::jsonb end;
begin
  -- 0. Serialkan simpanan per undangan. Tanpa kunci ini, dua simpanan bersamaan
  --    (dua tab/perangkat) dengan jadwal bersilang — tab 1 membuang sesi y,
  --    tab 2 membuang sesi x — saling mengunci baris dalam urutan terbalik
  --    (DELETE lalu upsert) dan Postgres membatalkan salah satunya dengan
  --    "deadlock detected" (terbukti di DB lokal). Dengan kunci, simpanan kedua
  --    menunggu lalu berjalan di atas snapshot baru (READ COMMITTED): bersih
  --    "penulis terakhir menang". Kunci transaksional (lepas saat commit) dan
  --    ber-namespace, agar tak saling menunggu dengan kunci galeri & tamu per
  --    undangan yang memakai `hashtextextended(inv_id::text, 0|1)`.
  perform pg_advisory_xact_lock(hashtextextended('replace_invitation_events:' || inv_id::text, 0));

  -- 1. Sesi undangan INI yang tak dikirim lagi = dibuang pemilik.
  delete from public.invitation_events as ev
  where ev.invitation_id = inv_id
    and ev.id <> all (array(
      select (e->>'id')::uuid
      from jsonb_array_elements(items) as e
      where nullif(e->>'id', '') is not null
    ));

  -- 2. Perbarui di tempat / sisipkan. `invitation_id` tak pernah ikut di-SET, dan
  --    id milik undangan LAIN (sengaja dikirim klien nakal) dilewati oleh WHERE
  --    konflik — dievaluasi sebelum cek RLS UPDATE, jadi baris orang lain tak
  --    tersentuh (RLS tetap lapis kedua: SECURITY INVOKER).
  insert into public.invitation_events as ev
    (id, invitation_id, name, start_at, end_at, venue_name, address, maps_url, sort_order)
  select
    coalesce(nullif(e->>'id', '')::uuid, gen_random_uuid()),
    inv_id,
    coalesce(e->>'name', ''),
    nullif(e->>'start_at', '')::timestamptz,
    nullif(e->>'end_at', '')::timestamptz,
    nullif(e->>'venue_name', ''),
    nullif(e->>'address', ''),
    nullif(e->>'maps_url', ''),
    coalesce((e->>'sort_order')::int, 0)
  from jsonb_array_elements(items) as e
  on conflict (id) do update set
    name = excluded.name,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    venue_name = excluded.venue_name,
    address = excluded.address,
    maps_url = excluded.maps_url,
    sort_order = excluded.sort_order
  where ev.invitation_id = excluded.invitation_id;
end;
$$;

revoke execute on function public.replace_invitation_events(uuid, jsonb) from public, anon;
grant execute on function public.replace_invitation_events(uuid, jsonb) to authenticated, service_role;

-- ROLLBACK non-destruktif: jalankan ulang definisi RPC dari
--   20260922120000_events_nullable_start.sql (hapus-semua + sisip-ulang).
