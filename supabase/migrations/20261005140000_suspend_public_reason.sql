-- =============================================================================
-- Suspend: alasan untuk PELANGGAN, terpisah dari catatan internal
-- (AUDIT-2026-10-01 B7, DECISIONS #68)
--
-- Kenapa dua kolom, bukan satu yang dipakai dua kali:
--   `p_reason` sejak awal ditulis admin UNTUK admin dan hanya pernah mendarat di
--   `admin_logs.detail`. Isinya wajar memuat hal yang tak boleh dibaca pelanggan
--   — nama pelapor, nomor telepon pihak ketiga, dugaan yang belum pasti. Begitu
--   teks itu dikirim sebagai email, satu kolom berarti satu-satunya pengaman
--   adalah kehati-hatian admin saat mengetik.
--
--   `p_public_reason` karena itu berdiri sendiri: ia yang masuk email. Ia TETAP
--   dicatat di `admin_logs` — tindakan penegakan harus meninggalkan rekam jejak
--   tentang apa yang dikatakan kepada pelanggan, bukan hanya apa yang diputuskan
--   secara internal. Nullable: admin boleh menangguhkan tanpa penjelasan publik,
--   dan emailnya akan mengarahkan ke jalur banding saja.
--
-- Urutan deploy: migrasi ini HARUS lebih dulu dari aplikasinya. `p_public_reason`
-- punya default, jadi kode lama yang memanggil dengan tiga argumen tetap jalan
-- (DB baru + app lama aman); sebaliknya tidak.
-- =============================================================================

-- Di-drop lebih dulu, bukan `create or replace`: menambah parameter mengubah
-- signature, dan membiarkan versi 3-argumen hidup berdampingan membuat panggilan
-- 3-argumen menjadi ambigu. Grant-nya ikut terhapus dan dipasang ulang di bawah.
drop function if exists public.admin_suspend_invitation(uuid, uuid, text);

create or replace function public.admin_suspend_invitation(
  p_invitation_id uuid,
  p_admin_id uuid,
  p_reason text,
  p_public_reason text default null
) returns table (result text, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
begin
  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;
  if v_inv.status = 'suspended' then
    return query select 'already_suspended'::text, v_inv.slug;
    return;
  end if;

  update public.invitations
    set status = 'suspended', updated_at = now()
    where id = p_invitation_id;

  insert into public.admin_logs (
    admin_id, action, target_type, target_id, detail
  ) values (
    p_admin_id, 'invitation.suspend', 'invitation', p_invitation_id,
    jsonb_build_object(
      'reason', p_reason,
      -- Dicatat APA ADANYA, termasuk saat kosong: "tak ada penjelasan publik"
      -- adalah fakta yang kelak dipertanyakan kalau pelanggan membantah.
      'public_reason', p_public_reason,
      'prev_status', v_inv.status
    )
  );

  return query select 'suspended'::text, v_inv.slug;
end;
$$;

-- Hardening execute dipasang ulang untuk signature yang baru.
revoke execute on function
  public.admin_suspend_invitation(uuid, uuid, text, text)
  from anon, authenticated, public;

grant execute on function
  public.admin_suspend_invitation(uuid, uuid, text, text)
  to service_role;
