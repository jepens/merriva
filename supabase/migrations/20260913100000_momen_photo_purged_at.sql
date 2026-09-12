-- Moderasi sadar-fase Album Momen (AUDIT-2026-09-04 KEA-3).
--
-- MASALAH: bucket `media` publik dan objek diunggah ber-`cacheControl` 1 tahun.
-- Setelah reveal, URL foto dipancarkan ke SETIAP pengunjung tanpa autentikasi.
-- Saat host memoderasi foto sensitif dengan "Sembunyikan", barisnya hilang dari
-- galeri tetapi OBJEKNYA TETAP MELAYANI 200 selamanya. UI memberi kesan foto
-- sudah tak terjangkau — itu tidak benar.
--
-- KEPUTUSAN (DECISIONS #33): pencabutan bergantung FASE.
--   * Pra-reveal  — URL belum pernah publik → "Sembunyikan" cukup penanda
--     status, objek dipertahankan, bisa ditampilkan lagi.
--   * Pasca-reveal — URL sudah tersebar → "Sembunyikan" IKUT menghapus objek
--     storage. Permanen; "Tampilkan" tak lagi ditawarkan untuk foto itu.
--
-- Kolom ini merekam kejadian tersebut SECARA EKSPLISIT. Menebaknya dari fase
-- album akan SALAH: foto yang disembunyikan pra-reveal masih punya objek utuh,
-- dan album yang kemudian ter-reveal tidak boleh membuatnya tampak terhapus.
--
-- Baris sengaja DIPERTAHANKAN (bukan dihapus) agar metadata, jatah per tamu, dan
-- hitungan peserta tetap konsisten — menyembunyikan foto tidak mengembalikan
-- jatah jepret tamu maupun slot peserta yang sudah terpakai.

alter table public.momen_photos
  add column if not exists purged_at timestamptz;

comment on column public.momen_photos.purged_at is
  'Waktu objek storage dihapus saat moderasi pasca-reveal (KEA-3). NULL = objek masih ada & foto boleh ditampilkan lagi.';
