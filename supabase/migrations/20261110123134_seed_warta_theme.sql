-- Seed metadata tema `warta` — koran retro "The Wedding Post" (wedding, tier
-- Craft, paket standard; DECISIONS #123). Dihasilkan `pnpm theme:new`.
-- Kode temanya ada di `src/themes/warta/`; baris ini = katalog metadata yang
-- diedit admin, agar draft undangan bisa mereferensikan theme_id dan temanya
-- tampil di katalog. Idempoten lewat ON CONFLICT (slug).
--
-- `is_active = TRUE`: diaktifkan atas permintaan pemilik (10 Nov 2026) agar
-- tampil di pemilih tema `/dashboard/undangan/baru` dan katalog `/tema` — lolos
-- tinjauan DoD (DECISIONS #123). Template `pnpm theme:new` tetap FALSE.
-- ON CONFLICT sengaja tak menyentuh `is_active`: status yang sudah diatur admin
-- tak ditimpa saat migrasi dijalankan ulang.
insert into public.themes (slug, name, categories, tier, is_active, sort_order)
values (
  'warta',
  'Warta',
  array['wedding']::public.invitation_category[],
  'standard',
  true,
  100
)
on conflict (slug) do update set
  name = excluded.name,
  categories = excluded.categories,
  tier = excluded.tier,
  sort_order = excluded.sort_order;
