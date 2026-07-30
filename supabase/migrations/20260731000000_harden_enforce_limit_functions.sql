-- Hardening — cabut EXECUTE default (PUBLIC) pada fungsi trigger SECURITY DEFINER
-- `enforce_guest_limit` / `enforce_media_limit` (M3.6). Keduanya HANYA dipanggil
-- oleh trigger BEFORE INSERT (trigger berjalan tanpa butuh EXECUTE pemanggil),
-- jadi mencabut grant TIDAK memengaruhi penegakan limit — hanya menutup paparan
-- sebagai RPC `/rest/v1/rpc/...` ke anon/authenticated (fungsi trigger tak bisa
-- dipanggil langsung, tetapi ini menyelaraskan dengan pola harden_functions +
-- membersihkan advisor keamanan Supabase 0028/0029).
revoke execute on function
  public.enforce_guest_limit(),
  public.enforce_media_limit()
  from anon, authenticated, public;
