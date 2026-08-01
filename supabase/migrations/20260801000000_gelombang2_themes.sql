-- Fase F (Gelombang 2) — metadata tema:
--  (1) `meridian` pivot kategori corporate → WEDDING. Redesign meridian-story.html
--      adalah gala pernikahan Art Deco; corporate kini dipegang `prisma` (Fase D)
--      + `lumina` (universal). Kode tema di repo src/themes/meridian/.
--  (2) Seed tema BARU `kirana` (pernikahan adat Jawa, tier premium). Kode di
--      src/themes/kirana/. Pola sama seperti seed prisma (idempoten).
-- Idempoten: aman dijalankan ulang di staging & production.

update public.themes
set categories = array['wedding']::public.invitation_category[]
where slug = 'meridian';

insert into public.themes (slug, name, categories, tier, is_active, sort_order)
values (
  'kirana',
  'Kirana',
  array['wedding']::public.invitation_category[],
  'premium',
  true,
  90
)
on conflict (slug) do update set
  name = excluded.name,
  categories = excluded.categories,
  tier = excluded.tier,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
