-- M1.4 — bucket storage untuk foto galeri.
-- Publik (galeri memang tampil ke semua tamu; path memakai UUID tak tertebak).
-- Hanya WebP (kompresi 2 varian dilakukan di klien) & dibatasi 2MB/berkas
-- sebagai pertahanan berlapis di sisi storage. Tulis HANYA via service_role
-- (driver lib/storage); tanpa policy write untuk anon/authenticated → RLS
-- storage.objects menolak tulis langsung dari browser secara default.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/webp']::text[])
on conflict (id) do nothing;
