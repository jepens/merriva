-- Cabut hak TULIS `anon` (dan TRUNCATE `authenticated`) di skema public.
--
-- Temuan verifikasi 3 Nov 2026 (DECISIONS #109): di produksi `anon` masih
-- memegang INSERT/UPDATE/DELETE/TRUNCATE di hampir setiap tabel public, sisa
-- grant bawaan Supabase saat tabelnya dibuat. `20260808130000` hanya mengubah
-- DEFAULT untuk tabel BARU dan tak pernah mencabut grant yang sudah ada,
-- sehingga produksi menyimpang dari lokal (di lokal anon tanpa hak tulis).
--
-- Hari ini tak ada yang bisa memakainya: tak satu pun policy tulis berlaku untuk
-- anon (yang ada hanya SELECT katalog themes/packages/songs), dan semua tulis
-- tamu (RSVP, ucapan, Album Momen) berjalan lewat service_role di server. Tetapi
-- satu policy `to public` yang keliru kelak langsung menjadi celah tulis anon —
-- dan hanya di produksi, tempat test lokal tak bisa melihatnya. TRUNCATE lebih
-- buruk lagi: ia TIDAK tunduk pada RLS sama sekali, termasuk bagi pengguna login.
--
-- Hanya grant tingkat tabel yang ada (diperiksa: anon tak punya grant per kolom
-- di luar itu). Hak SELECT anon sengaja tak disentuh; itu lingkup terpisah.
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke truncate on all tables in schema public from authenticated;

-- Tabel baru tak boleh mewarisinya lagi (secure-by-default, melanjutkan
-- 20260808130000).
alter default privileges in schema public
  revoke insert, update, delete, truncate on tables from anon;
alter default privileges in schema public
  revoke truncate on tables from authenticated;
