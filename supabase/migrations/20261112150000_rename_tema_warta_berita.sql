-- Nama tampilan tema `warta` menjadi "Berita" (permintaan pemilik 12 Nov 2026,
-- DECISIONS #136). HANYA nama katalog yang berubah: slug `warta` tetap — ia
-- kunci registry kode (`src/themes/registry.ts`), aset CSS, dan alamat pratinjau
-- `/preview/tema/warta`; undangan merujuk tema lewat `theme_id`, jadi tak ada
-- baris undangan yang tersentuh.
--
-- Seed 20261110123134 menulis 'Warta' lewat ON CONFLICT; migrasi ini berjalan
-- sesudahnya, jadi `supabase db reset` lokal/CI berakhir di 'Berita'. Admin
-- tetap bisa mengganti nama lagi lewat /admin/tema.
update public.themes
set name = 'Berita'
where slug = 'warta';
