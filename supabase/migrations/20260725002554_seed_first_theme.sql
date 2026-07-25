-- Merriva — Migrasi v3: seed metadata tema pertama (eternal-rose).
-- Kode komponen tema ada di repo (src/themes/) dan diisi pada M1.5; baris ini
-- hanya metadata agar draft undangan bisa mereferensikan theme_id.
-- Idempoten (on conflict do nothing) — aman di semua environment.
insert into public.themes (slug, name, categories, tier, is_active, sort_order)
values (
  'eternal-rose',
  'Eternal Rose',
  '{wedding}'::public.invitation_category[],
  'standard',
  true,
  1
)
on conflict (slug) do nothing;
