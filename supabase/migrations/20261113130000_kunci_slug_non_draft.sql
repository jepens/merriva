-- Kunci slug undangan yang sudah keluar dari draft — DI DATABASE (DECISIONS #138).
--
-- Aplikasi hanya mengizinkan ganti slug saat draft (`updateInvitationSlugAction`
-- memfilter `status = 'draft'`): slug adalah alamat yang sudah tersebar lewat
-- WhatsApp dan tercetak di QR. Tetapi database tidak menegakkannya:
--   - init_schema memberi `authenticated` UPDATE kolom `slug`;
--   - policy `invitations_update` hanya memeriksa kepemilikan;
--   - tak ada trigger pada `slug`.
-- Pemilik undangan AKTIF bisa mengubah slug-nya langsung lewat PostgREST
-- (PATCH /rest/v1/invitations dengan JWT-nya sendiri + anon key). Akibatnya:
-- tautan & QR yang sudah tersebar mati, dan slug lama BEBAS diklaim pelanggan
-- lain — tamu yang membuka tautan lama mendarat di undangan orang lain.
--
-- Aturannya meniru policy `invitations_delete`: pemilik hanya bisa mengubah
-- slug saat `status = 'draft'`; admin bebas. Hanya peran KLIEN (authenticated/
-- anon) yang dikunci — jalur server tepercaya (service_role, pemilik DB di SQL
-- Editor, fungsi security definer) tetap bisa, untuk perbaikan darurat.
--
-- SECURITY INVOKER disengaja: `current_user` harus peran PEMANGGIL (PostgREST
-- menjalankan `SET ROLE authenticated`); pada security definer ia selalu
-- pemilik fungsi. `private.is_admin()` dapat dieksekusi `authenticated` (dipakai
-- policy RLS). EXECUTE fungsi trigger tak diperiksa saat trigger menyala, jadi
-- dicabut dari klien agar tak terekspos sebagai RPC.
--
-- Status dibaca dari baris LAMA: klien tak punya hak UPDATE `status`, dan slug
-- yang berganti bersamaan dengan transisi status hanya mungkin dari jalur
-- server. Mengisi slug yang SAMA (no-op) tetap lolos.
--
-- Idempoten: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.

create or replace function public.enforce_slug_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.slug is not distinct from old.slug or old.status = 'draft' then
    return new;
  end if;

  if current_user in ('authenticated', 'anon') and not private.is_admin() then
    raise exception 'Alamat undangan tidak bisa diubah setelah undangan keluar dari draft.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_slug_lock() from anon, authenticated, public;

comment on function public.enforce_slug_lock() is
  'Trigger BEFORE UPDATE OF slug public.invitations: peran klien (authenticated/anon) non-admin hanya boleh mengganti slug saat status lama = draft — meniru policy invitations_delete. Jalur server (service_role, pemilik DB) tak dibatasi. DECISIONS #138.';

drop trigger if exists enforce_slug_lock_before_update on public.invitations;
create trigger enforce_slug_lock_before_update
  before update of slug on public.invitations
  for each row
  execute function public.enforce_slug_lock();
