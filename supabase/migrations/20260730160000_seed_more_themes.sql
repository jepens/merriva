-- M4.2 — Seed metadata 7 tema baru ke `themes` (kode tema ada di repo
-- `src/themes/{slug}/`; baris ini = katalog metadata yang diedit admin M4.1c).
-- Idempoten: ON CONFLICT (slug) DO UPDATE → aman dijalankan ulang. sort_order
-- di atas eternal-rose (tema pertama M1.5, sort_order 1). preview_image/demo_slug
-- null: pratinjau dilayani route `/preview/tema/{slug}` (pakai slug tema langsung).

insert into public.themes (slug, name, categories, tier, is_active, sort_order)
values
  ('meridian', 'Meridian', array['corporate']::public.invitation_category[], 'standard', true, 10),
  ('barakah',  'Barakah',  array['wedding']::public.invitation_category[],   'premium',  true, 20),
  ('aria',     'Aria',     array['wedding']::public.invitation_category[],   'standard', true, 30),
  ('verdant',  'Verdant',  array['wedding']::public.invitation_category[],   'standard', true, 40),
  ('noir',     'Noir',     array['wedding']::public.invitation_category[],   'premium',  true, 50),
  ('festa',    'Festa',    array['family']::public.invitation_category[],    'standard', true, 60),
  ('lumina',   'Lumina',
    array['wedding','corporate','family']::public.invitation_category[], 'premium', true, 70)
on conflict (slug) do update set
  name = excluded.name,
  categories = excluded.categories,
  tier = excluded.tier,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
