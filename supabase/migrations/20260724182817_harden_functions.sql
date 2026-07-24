-- =============================================================================
-- Merriva — Migrasi v2: hardening advisor Supabase
--
-- Menutup lints Supabase database linter:
--  * function_search_path_mutable (set_updated_at)
--  * anon/authenticated_security_definer_function_executable (is_admin,
--    owns_invitation, handle_new_user) — fungsi SECURITY DEFINER tak perlu
--    terekspos sebagai RPC PostgREST.
--
-- Policy & trigger tetap jalan: `ALTER FUNCTION ... SET SCHEMA` menjaga referensi
-- via OID, jadi policy yang menyebut fungsi tetap valid (kini me-resolve ke private.*).
-- =============================================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- Fungsi trigger: fire otomatis (tak butuh EXECUTE oleh peran). Kunci search_path
-- + cabut EXECUTE agar tidak terekspos sebagai RPC PostgREST.
alter function public.set_updated_at() set search_path = '';
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Fungsi helper RLS (dipakai policy → butuh EXECUTE+USAGE oleh peran, tapi TIDAK
-- perlu terekspos sebagai RPC). Pindah ke skema `private` yang tak diekspos PostgREST.
alter function public.is_admin() set schema private;
alter function public.owns_invitation(uuid) set schema private;
