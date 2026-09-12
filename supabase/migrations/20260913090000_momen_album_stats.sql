-- Statistik agregat Album Momen dalam SATU query (AUDIT-2026-09-04 PER-4).
--
-- Sebelumnya halaman tamu `/{slug}/momen` dan dashboard menarik SELURUH baris
-- foto album hanya untuk menghitung jumlah foto, jumlah fotografer, dan jumlah
-- peserta — di route publik `force-dynamic` yang tak pernah ter-cache. Album 500
-- foto ≈ 150 KB payload per pembukaan; 200 tamu membuka bersamaan ≈ 100.000
-- baris terbaca dari satu instance.
--
-- Dengan paginasi kursor, daftar foto tak lagi utuh — sehingga angka ringkasan
-- TIDAK BOLEH lagi diturunkan dari daftar yang termuat. Fungsi ini menyediakan
-- angkanya dengan biaya konstan di sisi klien.
--
-- Semantik sengaja dibedakan:
--   * `photographer_count` = fotografer yang KARYANYA TERLIHAT (status visible)
--     → dipakai subjudul galeri tamu; foto yang disembunyikan host tak boleh
--     menambah hitungan yang dilihat tamu.
--   * `participant_count`  = device_id unik tanpa memandang status → UNIT YANG
--     DIJUAL, selaras persis dengan `momen_claim_upload` yang menegakkan
--     `quota_peserta` (menyembunyikan foto tidak mengembalikan jatah peserta).
--
-- Memakai index `momen_photos_album_created_idx (album_id, created_at)` untuk
-- mempersempit ke album; agregasi berjalan di server DB, bukan lewat kabel.

create or replace function public.momen_album_stats(p_album_id uuid)
returns table (
  visible_count int,
  hidden_count int,
  photographer_count int,
  participant_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where status = 'visible')::int,
    count(*) filter (where status = 'hidden')::int,
    count(distinct guest_name) filter (where status = 'visible')::int,
    count(distinct device_id)::int
  from public.momen_photos
  where album_id = p_album_id;
$$;

comment on function public.momen_album_stats(uuid) is
  'Ringkasan album dalam satu agregat (PER-4): visible/hidden, fotografer terlihat, peserta unik. photographer_count = visible saja; participant_count = semua status (unit yang dijual).';

-- Hardening execute: HANYA service_role — dipanggil dari route SSR / server
-- action yang sudah memverifikasi kepemilikan atau fase reveal. Sejalan dengan
-- RPC momen lain (migrasi 20260826120000 §8).
revoke execute on function public.momen_album_stats(uuid)
  from anon, authenticated, public;
grant execute on function public.momen_album_stats(uuid) to service_role;
