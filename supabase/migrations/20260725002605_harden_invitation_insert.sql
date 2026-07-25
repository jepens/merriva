-- Merriva — Migrasi v4: hardening privilege KOLOM pada INSERT invitations.
--
-- Temuan (M1.3): migrasi v1 §6b hanya mengeraskan UPDATE. INSERT tabel-level
-- masih terbuka penuh → client bisa `insert ... (status) values ('active')`
-- untuk aktivasi tanpa bayar (bypass pembayaran), analog lubang UPDATE yang
-- ditutup di M0. Postgres mengabaikan grant kolom bila grant tabel-level ada,
-- jadi kita cabut INSERT tabel-level lalu grant ULANG hanya kolom aman.
--
-- Kolom lifecycle (status, active_until, package_id, published_at) TIDAK diberikan
-- → tetap default (status='draft', sisanya null); hanya ditulis service_role
-- (server action pembayaran).
revoke insert on public.invitations from anon, authenticated;
grant insert (user_id, theme_id, slug, category, content, settings, event_date)
  on public.invitations to authenticated;
