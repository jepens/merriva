-- Merriva — sesi jadwal tanpa jam mulai ikut tersimpan (DECISIONS #42).
--
-- Dulu `start_at NOT NULL` membuat autosave MEMBUANG sesi yang jam mulainya
-- belum lengkap (disaring di aplikasi dan di RPC ini), sementara indikator
-- editor menulis "Tersimpan". Setelah muat ulang, sesi itu hilang beserta
-- nama/gedung/alamat/peta yang sudah diketik (melanggar SPEC §4.4 "refresh
-- browser tidak menghilangkan data").
--
-- Tidak destruktif: hanya melonggarkan constraint; tak ada baris yang diubah.
-- NULL = sesi draft belum berjam: tersimpan, tetapi TIDAK PERNAH tampil di
-- halaman publik, pratinjau, .ics, maupun OG (disaring di `lib/schedule.ts`),
-- dan bukan target check-in Fase 2.
--
-- Pra-cek production (baca-saja; aplikasi kini menolak waktu < 1900):
--   select count(*) from public.invitation_events where start_at < '1900-01-01';

alter table public.invitation_events alter column start_at drop not null;

comment on column public.invitation_events.start_at is
  'UTC. NULL = sesi draft yang jam mulainya belum diisi: tersimpan agar isian tak hilang, TIDAK tampil di halaman publik/pratinjau/.ics/OG; bukan target check-in.';

-- Ganti sesi atomik. Semua sesi yang dikirim aplikasi disimpan (aplikasi sudah
-- melewati kartu kosong total). Nama kosong tetap kosong — dulu diganti diam-
-- diam menjadi 'Acara', sehingga editor memuat nama yang tak pernah diketik
-- pemilik; label cadangan kini hanya urusan tampilan publik.
create or replace function public.replace_invitation_events(inv_id uuid, events jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.invitation_events where invitation_id = inv_id;

  if jsonb_typeof(events) = 'array' then
    insert into public.invitation_events
      (invitation_id, name, start_at, end_at, venue_name, address, maps_url, sort_order)
    select
      inv_id,
      coalesce(e->>'name', ''),
      nullif(e->>'start_at', '')::timestamptz,
      nullif(e->>'end_at', '')::timestamptz,
      nullif(e->>'venue_name', ''),
      nullif(e->>'address', ''),
      nullif(e->>'maps_url', ''),
      coalesce((e->>'sort_order')::int, 0)
    from jsonb_array_elements(events) as e;
  end if;
end;
$$;

-- SECURITY INVOKER + RLS sudah menahan pemanggil anonim; hak eksekusi publik
-- tetap dicabut agar permukaan serangannya nol.
revoke execute on function public.replace_invitation_events(uuid, jsonb) from public, anon;
grant execute on function public.replace_invitation_events(uuid, jsonb) to authenticated, service_role;

-- ROLLBACK non-destruktif: jalankan ulang definisi RPC dari
--   20260725133609_replace_invitation_events_rpc.sql (ber-WHERE start_at);
--   kolom boleh tetap nullable, dan aplikasi baru (saringan) tetap aman.
-- ROLLBACK penuh (DESTRUKTIF — butuh persetujuan pemilik):
--   delete from public.invitation_events where start_at is null;
--   alter table public.invitation_events alter column start_at set not null;
