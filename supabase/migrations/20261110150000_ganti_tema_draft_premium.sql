-- Ganti tema (SPEC §4.4 "Ganti tema", §4.8 langkah 0; DECISIONS #124).
--
-- Keputusan pemilik 10 Nov 2026: undangan yang BELUM PERNAH dibayar boleh
-- berganti ke tema premium — sama seperti saat MEMBUAT undangan (INSERT tak
-- pernah diperiksa; "rasakan dulu, bayar belakangan"). Sebelumnya trigger
-- #116 menilai draft pelanggan dengan lantai Basic sehingga draft yang dibuat
-- dengan tema standar tak bisa mencoba tema premium sesudahnya, padahal draft
-- yang langsung dibuat dengan tema premium sah.
--
-- Yang TIDAK berubah:
--   - tema wajib aktif & sekategori (semua undangan);
--   - undangan yang SUDAH berpaket wajib `all_themes` untuk tema premium;
--   - order undangan `pending` berpaket non-`all_themes` menolak tema premium
--     untuk SEMUA undangan, termasuk yang belum pernah dibayar — tanpa ini draft
--     bisa membuat order Basic dengan tema standar (lolos gerbang checkout),
--     berganti ke tema premium, lalu membayar Basic (`activate_paid_order` tak
--     memeriksa tema).
--
-- "Belum pernah dibayar" = `package_id IS NULL` DAN status `draft` /
-- `pending_payment`. Status lain tanpa paket (mis. aktivasi khusus) tetap
-- melewati `invitation_effective_limits` seperti sebelumnya. Dibaca dari baris
-- LAMA: kolom `package_id` & `status` tak bisa ditulis klien.
--
-- Pemeriksaan order `pending` dipersempit ke status yang MEMANG bisa diaktifkan
-- oleh order itu (`draft`/`pending_payment`/`expired`). Pada undangan `active`
-- membayar order purchase hanya berakhir `held` (paket tak berubah), jadi order
-- Basic basi yang belum kedaluwarsa tak boleh memblokir tema premium milik
-- undangan yang SUDAH membayar Premium.
--
-- BALAPAN checkout ↔ ganti tema (tinjauan 10 Nov 2026): checkout membaca tema,
-- memeriksa tier, lalu baru meng-INSERT order — beberapa round-trip tanpa
-- kunci. Ganti tema ke premium yang tiba DI ANTARA keduanya lolos trigger
-- (order belum ada), lalu order Basic masuk dan dibayar. Ditutup di sisi
-- INSERT order secara atomik: `enforce_order_theme` mengunci baris undangan
-- (FOR NO KEY UPDATE — bentrok dengan UPDATE theme_id, tak menahan sisipan FK
-- tamu/RSVP) di pernyataan TERSENDIRI, lalu membaca temanya di pernyataan
-- berikutnya (snapshot baru, READ COMMITTED). JANGAN digabung menjadi satu
-- SELECT join … FOR UPDATE OF i: sesudah menunggu kunci, EvalPlanQual memakai
-- versi undangan baru dengan baris tema LAMA, syarat join gagal, tier NULL, dan
-- order lolos (terbukti uji dua sesi). Kedua arah kini serial:
--   - ganti tema dulu → INSERT menunggu kunci, lalu membaca tema premium → tolak;
--   - order dulu → UPDATE tema menunggu, lalu trigger tema melihat order → tolak.
-- Order `manual` (aktivasi manual admin) dikecualikan: SPEC §4.8 — aktivasi
-- manual admin tak memeriksa tema.
--
-- Idempoten: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.

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
    -- Undangan yang belum pernah dibayar boleh mencoba tema premium (#124);
    -- checkout tetap mewajibkan paket ber-`all_themes`.
    if not (
      old.package_id is null
      and old.status in ('draft', 'pending_payment')
    ) then
      -- Batas efektif undangan ini (paket, atau paket teratas untuk draft
      -- admin/Pro — #115).
      v_all_themes := coalesce(
        (public.invitation_effective_limits(new.id) ->> 'all_themes')::boolean,
        false
      );
      if not v_all_themes then
        raise exception 'Tema premium hanya untuk paket Premium.'
          using errcode = 'check_violation';
      end if;
    end if;

    -- Order undangan yang masih MENUNGGU bayar wajib mencakup tema baru —
    -- berlaku juga untuk undangan yang belum pernah dibayar (lihat atas), tapi
    -- hanya pada status yang bisa DIAKTIFKAN oleh order itu.
    if old.status in ('draft', 'pending_payment', 'expired') and exists (
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

comment on function public.enforce_theme_change() is
  'Trigger BEFORE UPDATE OF theme_id public.invitations: tema baru wajib aktif & sekategori; bila tier premium — undangan berpaket wajib all_themes (invitation_effective_limits), undangan yang belum pernah dibayar (package_id null, draft/pending_payment) boleh (#124), dan order undangan pending berpaket non-all_themes menolak pada status draft/pending_payment/expired. INSERT tak diperiksa. Pasangannya: enforce_order_theme. DECISIONS #116, #124.';

-- Sisi INSERT order: order undangan `pending` berpaket non-`all_themes` (bukan
-- manual admin) ditolak bila tema undangannya premium — atomik terhadap ganti
-- tema (lihat kepala berkas).
create or replace function public.enforce_order_theme()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_all_themes boolean;
  v_tier text;
begin
  if new.status <> 'pending'
     or new.invitation_id is null
     or coalesce(new.payment_method, '') = 'manual' then
    return new;
  end if;

  select p.kind::text, coalesce((p.limits ->> 'all_themes')::boolean, false)
    into v_kind, v_all_themes
    from public.packages p
    where p.id = new.package_id;
  if not found or v_kind <> 'invitation' or v_all_themes then
    return new;
  end if;

  -- Kunci dulu (pernyataan sendiri), baca sesudahnya — lihat kepala berkas.
  perform 1
    from public.invitations
    where id = new.invitation_id
    for no key update;

  select t.tier::text
    into v_tier
    from public.invitations i
    join public.themes t on t.id = i.theme_id
    where i.id = new.invitation_id;
  -- Gagal-tertutup: tema tak terbaca diperlakukan seperti premium.
  if not found or v_tier is null or v_tier = 'premium' then
    raise exception 'Tema premium hanya untuk paket Premium.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_order_theme() from anon, authenticated, public;

drop trigger if exists enforce_order_theme_before_insert on public.orders;
create trigger enforce_order_theme_before_insert
  before insert on public.orders
  for each row execute function public.enforce_order_theme();

comment on function public.enforce_order_theme() is
  'Trigger BEFORE INSERT public.orders: order undangan pending berpaket non-all_themes (bukan payment_method manual) ditolak bila tema undangannya premium. Mengunci baris undangan (FOR NO KEY UPDATE) di pernyataan tersendiri sebelum membaca tema → serial terhadap enforce_theme_change. DECISIONS #124.';
