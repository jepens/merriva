-- M3.6 — Penegakan limit paket OTORITATIF di lantai tabel (BUKAN hanya di RPC).
--
-- MASALAH: cek limit tamu/foto sebelumnya hanya ada di RPC (insert_guest /
-- insert_guests_bulk / insert_gallery_media) yang SECURITY INVOKER. Namun role
-- `authenticated` masih memegang INSERT tabel pada `guests`/`media`, dan policy
-- RLS INSERT hanya menjaga KEPEMILIKAN (`owns_invitation`), bukan jumlah baris.
-- Akibatnya pemilik yang login bisa MELEWATI RPC dan INSERT langsung via PostgREST
-- untuk menembus kuota paketnya (mis. 5000 tamu pada Basic 150) — melanggar
-- boundary "batasi server-side, jangan hanya di UI" (CLAUDE.md).
--
-- SOLUSI: trigger BEFORE INSERT (SECURITY DEFINER) — TIDAK bisa dipanggil via
-- REST, jadi menegakkan batas di SEMUA jalur tulis (RPC maupun insert langsung).
-- Batas dihitung dari `invitation_effective_limits` (sumber otoritatif sama).
-- RPC yang benar menyisip <= kuota → trigger tak pernah menolak alur sah; hanya
-- insert langsung yang melampaui kuota yang ditolak.
--
-- Catatan: pengecekan per-baris memakai COUNT saat ini; dalam SATU statement
-- multi-baris (bulk), baris ke-(N+1) yang melampaui batas → exception → seluruh
-- statement rollback. Sisa mikro-ras antar-transaksi direct-insert paralel tak
-- ter-serialisasi di sini (jalur RPC sudah advisory-lock); dampak terbatas &
-- eksploit bulk (ancaman utama) tertutup penuh.

-- Tamu: max_guests JSON null (ternormalkan) = tanpa batas (Premium) → lewati.
create or replace function public.enforce_guest_limit()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_max int;
  v_count int;
begin
  v_max := (public.invitation_effective_limits(new.invitation_id) ->> 'max_guests')::int;
  if v_max is null then
    return new; -- tanpa batas (Premium)
  end if;
  select count(*) into v_count
    from public.guests
    where invitation_id = new.invitation_id;
  if v_count >= v_max then
    raise exception 'Batas tamu paket tercapai (maks %).', v_max
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger enforce_guest_limit_before_insert
  before insert on public.guests
  for each row execute function public.enforce_guest_limit();

-- Foto: max_photos selalu angka positif (ternormalkan; tak ada "tanpa batas").
create or replace function public.enforce_media_limit()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_max int;
  v_count int;
begin
  v_max := (public.invitation_effective_limits(new.invitation_id) ->> 'max_photos')::int;
  select count(*) into v_count
    from public.media
    where invitation_id = new.invitation_id;
  if v_count >= v_max then
    raise exception 'Batas foto paket tercapai (maks %).', v_max
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger enforce_media_limit_before_insert
  before insert on public.media
  for each row execute function public.enforce_media_limit();

comment on function public.enforce_guest_limit() is
  'Trigger BEFORE INSERT public.guests: tolak bila jumlah tamu >= max_guests paket (invitation_effective_limits; null=tanpa batas). Menegakkan kuota di SEMUA jalur tulis termasuk PostgREST langsung (bukan hanya RPC). M3.6.';
comment on function public.enforce_media_limit() is
  'Trigger BEFORE INSERT public.media: tolak bila jumlah foto >= max_photos paket (invitation_effective_limits). Menegakkan kuota di SEMUA jalur tulis termasuk PostgREST langsung. M3.6.';
