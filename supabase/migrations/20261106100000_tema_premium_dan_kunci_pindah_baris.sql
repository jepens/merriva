-- Penegakan paket di DB (DECISIONS #116, SPEC §2 "Penegakan paket" & §4.8
-- langkah 0): tema premium mengikuti paket, dan tamu/foto tak bisa dipindah
-- antar-undangan untuk melewati kuota.
--
-- 1) TEMA PREMIUM. Tema bertier `premium` wajib paket ber-`all_themes`
--    (Premium) saat DIBAYAR — dijaga aksi checkout (`packageAllowsTheme`).
--    Tetapi kolom `theme_id` bisa ditulis pemilik langsung lewat PostgREST
--    (grant kolom init_schema §6b + RLS kepemilikan), dan tak ada aksi aplikasi
--    yang mengubah tema sesudah undangan dibuat (`theme_id` hanya ditulis saat
--    INSERT). Tanpa trigger ini, undangan Basic yang sudah dibayar bisa
--    dipindah ke tema premium sesudahnya — atau ke tema nonaktif / berkategori
--    lain, yang tak pernah lolos pemilih tema aplikasi.
--
--    Order undangan yang masih `pending` ikut diperiksa: gerbang checkout
--    membaca tema SAAT order dibuat, sedangkan aktivasi sesudah bayar tak
--    memeriksa tema (uang yang sudah masuk tak boleh tertahan).
--
--    Hanya PENGGANTIAN tema yang diperiksa (BEFORE UPDATE OF theme_id dengan
--    nilai berbeda): draft yang DIBUAT dengan tema premium tetap sah (rasakan
--    dulu — SPEC §4.8), dan menonaktifkan tema di katalog tak pernah memblokir
--    undangan yang sudah memakainya.
--
-- 2) PINDAH BARIS. `guests` & `media` diberi UPDATE tingkat tabel untuk
--    `authenticated`, dan policy-nya hanya menuntut undangan baru juga milik
--    pemanggil. Trigger kuota hanya BEFORE INSERT. Dibuktikan empiris di DB
--    lokal (5 Nov 2026) sebagai pengguna login: undangan B berisi 500 tamu,
--    lalu `UPDATE guests SET invitation_id = B WHERE invitation_id = X` →
--    B berisi 501 tamu, tautan personalnya berfungsi. Tak ada jalur aplikasi
--    yang memindahkan baris antar-undangan (ganti kepemilikan memindah
--    UNDANGAN, bukan barisnya), jadi pemindahan ditolak seluruhnya.
--    Foto ikut demi simetri; render sudah membatasinya ke N pertama (#116) dan
--    constraint `storage_path` membuat foto pindahan tak bergambar.

create or replace function public.enforce_theme_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier text;
  v_active boolean;
  v_categories public.invitation_category[];
  v_all_themes boolean;
begin
  if new.theme_id is not distinct from old.theme_id then
    return new;
  end if;

  select t.tier::text, t.is_active, t.categories
    into v_tier, v_active, v_categories
    from public.themes t
    where t.id = new.theme_id;

  if not found or not v_active or not (new.category = any (v_categories)) then
    raise exception 'Tema tidak tersedia untuk undangan ini.'
      using errcode = 'check_violation';
  end if;

  if v_tier = 'premium' then
    -- Batas efektif undangan ini (paket, atau paket teratas untuk draft
    -- admin/Pro — #115). Dibaca dari baris LAMA: paket tak ikut berubah di
    -- UPDATE ini (kolom `package_id` tak bisa ditulis klien).
    v_all_themes := coalesce(
      (public.invitation_effective_limits(new.id) ->> 'all_themes')::boolean,
      false
    );
    if not v_all_themes then
      raise exception 'Tema premium hanya untuk paket Premium.'
        using errcode = 'check_violation';
    end if;

    -- Order undangan yang masih MENUNGGU bayar juga wajib mencakup tema baru.
    -- Tanpa ini: undangan Premium yang KEDALUWARSA membuat order perpanjangan
    -- Basic (tema standar lolos gerbang checkout), lalu berganti ke tema
    -- premium sebelum membayar — batas efektifnya masih paket Premium lama, dan
    -- `activate_paid_order` tak memeriksa tema. Order add-on (kind lain)
    -- tak relevan.
    if exists (
      select 1
        from public.orders o
        join public.packages p on p.id = o.package_id
        where o.invitation_id = new.id
          and o.status = 'pending'
          and p.kind = 'invitation'
          and not coalesce((p.limits ->> 'all_themes')::boolean, false)
    ) then
      raise exception 'Tema premium hanya untuk paket Premium.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_theme_change() from anon, authenticated, public;

drop trigger if exists enforce_theme_change_before_update on public.invitations;
create trigger enforce_theme_change_before_update
  before update of theme_id on public.invitations
  for each row execute function public.enforce_theme_change();

comment on function public.enforce_theme_change() is
  'Trigger BEFORE UPDATE OF theme_id public.invitations: tema baru wajib aktif, sekategori, dan — bila tier premium — undangan ber-all_themes (invitation_effective_limits) serta tanpa order undangan pending berpaket non-all_themes. INSERT tak diperiksa (draft boleh mencoba tema apa pun). DECISIONS #116.';

create or replace function public.forbid_invitation_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.invitation_id is distinct from old.invitation_id then
    raise exception 'Baris % tak bisa dipindah ke undangan lain.', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.forbid_invitation_move() from anon, authenticated, public;

drop trigger if exists forbid_invitation_move_guests on public.guests;
create trigger forbid_invitation_move_guests
  before update of invitation_id on public.guests
  for each row execute function public.forbid_invitation_move();

drop trigger if exists forbid_invitation_move_media on public.media;
create trigger forbid_invitation_move_media
  before update of invitation_id on public.media
  for each row execute function public.forbid_invitation_move();

comment on function public.forbid_invitation_move() is
  'Trigger BEFORE UPDATE OF invitation_id (guests, media): tolak pemindahan baris antar-undangan — trigger kuota hanya BEFORE INSERT, jadi pemindahan melewati batas paket. DECISIONS #116.';
