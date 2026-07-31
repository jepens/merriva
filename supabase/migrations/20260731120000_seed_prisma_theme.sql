-- M4.2 (Fase D) — Seed metadata tema BARU `prisma` (corporate, tier Signature).
-- Kode komponen tema ada di repo `src/themes/prisma/`; baris ini = katalog
-- metadata yang diedit admin (M4.1c) agar draft undangan bisa mereferensikan
-- theme_id & tema tampil di katalog. Idempoten: ON CONFLICT (slug) DO UPDATE →
-- aman dijalankan ulang di staging & production. sort_order 80 (setelah lumina 70).
insert into public.themes (slug, name, categories, tier, is_active, sort_order)
values (
  'prisma',
  'Prisma',
  array['corporate']::public.invitation_category[],
  'premium',
  true,
  80
)
on conflict (slug) do update set
  name = excluded.name,
  categories = excluded.categories,
  tier = excluded.tier,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
