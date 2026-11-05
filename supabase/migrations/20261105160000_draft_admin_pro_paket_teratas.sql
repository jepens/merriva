-- Draft milik admin/Pro memakai batas paket TERATAS, bukan lantai Basic
-- (DECISIONS #115, SPEC §4.8).
--
-- TEMUAN (5 Nov 2026): pemilik ber-peran admin membuka Kustomisasi Tampilan
-- draft miliknya dan mendapati fitur Premium terkunci. Admin & Pro tak pernah
-- ditagih (#100), tetapi pembebasan itu baru berlaku SAAT AKTIVASI (order Rp0
-- → paket teratas). Selama draft, undangan mereka jatuh ke lantai Basic yang
-- sama dengan pelanggan: palet & font Premium, galeri 8 foto, video, dan
-- watermark pratinjau terkunci — fitur yang akan mereka dapat gratis begitu
-- menekan "Aktifkan gratis".
--
-- YANG DIUBAH hanya cabang draft (paket NULL) dari resolver ini, dan hanya bila
-- PEMILIK undangan (`invitations.user_id`, bukan pemanggil) ber-peran admin/Pro:
-- `raw` diambil dari paket undangan aktif termahal (seri harga dipecah `code`)
-- — persis paket yang ditawarkan aktivasi gratis. Cermin TypeScript-nya `getEffectiveLimits(...,
-- ownerId)` di `server/limits.ts`; keduanya harus berubah bersama.
--
-- KENAPA INI BUKAN "membebaskan berdasarkan peran saja" yang ditolak #100:
-- penolakan itu soal undangan PELANGGAN yang dibuka admin (Premium gratis tanpa
-- jejak audit). Di sini peran yang dibaca adalah peran PEMILIK, jadi draft
-- pelanggan tetap Basic walau dibuka admin; tak ada yang ditagih maupun
-- dibebaskan, dan aktivasi tetap lewat order Rp0 yang tercatat. Begitu
-- undangan punya paket, paket itulah yang berlaku (cabang tak berubah).
--
-- RLS: fungsi tetap SECURITY INVOKER. `profiles_select` membuka baris sendiri
-- dan semua baris untuk admin — tepat dua pihak yang bisa melihat undangan
-- (`owns_invitation` / admin). Peran yang tak terbaca → NULL → lantai Basic
-- (gagal-aman). `packages_select_public` membuka paket aktif untuk semua.
--
-- Penegak yang ikut tanpa disentuh: `insert_gallery_media`, `insert_guest`,
-- `insert_guests_bulk`, trigger `enforce_guest_limit` / `enforce_media_limit`.
create or replace function public.invitation_effective_limits(inv_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  raw jsonb;
  v_package uuid;
  v_owner uuid;
  v_role text;
begin
  select i.package_id, i.user_id, p.limits
    into v_package, v_owner, raw
    from public.invitations i
    left join public.packages p on p.id = i.package_id
    where i.id = inv_id;

  if not found then
    return null; -- undangan tak terlihat (bukan milik pemanggil) / tak ada
  end if;

  -- Draft milik admin/Pro → paket undangan aktif termahal (aktivasi gratis).
  if v_package is null and v_owner is not null then
    select pr.role::text into v_role
      from public.profiles pr
      where pr.id = v_owner;
    if v_role in ('admin', 'pro') then
      select p.limits into raw
        from public.packages p
        where p.is_active and p.kind = 'invitation'
        -- `code` = pemecah seri yang SAMA dengan halaman aktifkan (harga sama
        -- → urutan tak dijamin Postgres; tanpa ini draft bisa memakai paket A
        -- sementara "Aktifkan gratis" memberi paket B).
        order by p.price_idr desc, p.code desc
        limit 1;
    end if;
  end if;

  -- raw NULL (draft biasa) atau JSONB paket → dinormalkan (lantai Basic per-kunci).
  return public.normalize_package_limits(raw);
end;
$$;

revoke execute on function public.invitation_effective_limits(uuid) from anon, public;
grant execute on function public.invitation_effective_limits(uuid) to authenticated, service_role;

comment on function public.invitation_effective_limits(uuid) is
  'Batas paket efektif (JSONB ternormalkan) untuk sebuah undangan; draft → lantai Basic, KECUALI draft milik admin/Pro (peran PEMILIK, bukan pemanggil) → paket undangan aktif termahal (DECISIONS #115). NULL = bukan milik pemanggil / tak ada. SECURITY INVOKER → RLS owns_invitation + profiles_select. Cermin: getEffectiveLimits di server/limits.ts.';
