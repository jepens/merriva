-- Add-on Album Momen sebagai baris `packages` (reuse alur order teruji;
-- `orders.package_id` NOT NULL FK TAK berubah — hindari sentuh tabel uang).
-- Kolom `kind` memisahkan paket masa-aktif undangan vs add-on; query harga/
-- checkout UNDANGAN wajib filter `kind='invitation'` (DECISIONS #22).
alter table public.packages
  add column if not exists kind text not null default 'invitation'
    check (kind in ('invitation', 'addon_momen'));

comment on column public.packages.kind is
  'invitation = paket masa aktif undangan (basic/premium); addon_momen = add-on Album Momen (dibeli untuk undangan AKTIF). Query harga/checkout undangan WAJIB filter kind=invitation agar add-on tak bocor ke pemilih paket undangan.';

-- Seed 5 tier PESERTA (model satualbum, DECISIONS #22). limits.quota_peserta:
-- jumlah tamu maksimal (null = tak terbatas); photo_ceiling = rem darurat storage
-- untuk tier ∞. duration_months nominal (album ikut RETENSI undangan, bukan durasi
-- paket → tak dipakai jalur aktivasi add-on). price 0 (tier gratis) sah (check >= 0).
insert into public.packages
  (code, name, price_idr, duration_months, limits, is_active, kind)
values
  ('momen_5',   'Album Momen — 5 Peserta',   0,       12,
     '{"quota_peserta": 5}'::jsonb,   true, 'addon_momen'),
  ('momen_50',  'Album Momen — 50 Peserta',  199000,  12,
     '{"quota_peserta": 50}'::jsonb,  true, 'addon_momen'),
  ('momen_100', 'Album Momen — 100 Peserta', 349000,  12,
     '{"quota_peserta": 100}'::jsonb, true, 'addon_momen'),
  ('momen_200', 'Album Momen — 200 Peserta', 649000,  12,
     '{"quota_peserta": 200}'::jsonb, true, 'addon_momen'),
  ('momen_unlimited', 'Album Momen — Tak Terbatas', 1099000, 12,
     '{"quota_peserta": null, "photo_ceiling": 8000}'::jsonb, true, 'addon_momen')
on conflict (code) do nothing;
