-- Perketat DEFAULT PRIVILEGES schema public (temuan security review pra-launch).
--
-- init_schema (baris 314-317) menetapkan default: SELECT→anon + DML→authenticated
-- untuk tabel yang DIBUAT SETELAH statement itu. Efeknya: tabel baru di migrasi
-- masa depan yang lupa `enable row level security` bisa world-readable oleh anon
-- (kunci publishable ada di klien) / world-DML oleh authenticated — footgun laten
-- yang melemahkan doktrin "RLS-by-default".
--
-- Aman: 12 tabel yang ADA dibuat SEBELUM default-privileges di init_schema dan
-- menerima grant EKSPLISIT (init_schema baris 305/309) → TIDAK terpengaruh (default
-- hanya berlaku ke tabel yang dibuat setelah statement ini). Katalog publik tetap
-- punya grant anon eksplisit (themes/packages/songs). Sejak kini, tabel baru WAJIB
-- diberi grant + RLS secara eksplisit (secure-by-default).
--
-- Default service_role (akses penuh) & execute-on-functions DIBIARKAN: dipakai
-- RPC SECURITY INVOKER; fungsi sensitif (pembayaran/admin) sudah REVOKE EXECUTE
-- eksplisit di migrasinya masing-masing.
alter default privileges in schema public revoke select on tables from anon;
alter default privileges in schema public
  revoke select, insert, update, delete on tables from authenticated;
