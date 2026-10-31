-- Seed metadata tema `sakinah` (dihasilkan `pnpm theme:new`).
-- Kode temanya ada di `src/themes/sakinah/`; baris ini = katalog metadata yang
-- diedit admin, agar draft undangan bisa mereferensikan theme_id dan temanya
-- tampil di katalog. Idempoten lewat ON CONFLICT (slug).
--
-- PERIKSA SEBELUM PUSH: `is_active` sengaja FALSE. Tema baru tak boleh muncul
-- di katalog sebelum art direction & DoD-nya selesai (THEME-PORTING §5).
insert into public.themes (slug, name, categories, tier, is_active, sort_order)
values (
  'sakinah',
  'Sakinah',
  array['wedding']::public.invitation_category[],
  'standard',
  false,
  100
)
on conflict (slug) do update set
  name = excluded.name,
  categories = excluded.categories,
  tier = excluded.tier,
  sort_order = excluded.sort_order;
