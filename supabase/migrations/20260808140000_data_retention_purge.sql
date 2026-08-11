-- Retensi data — purge data pribadi 6 bulan pasca-expired (UU PDP 27/2022).
-- Sumber kebenaran: DATA-MODEL §5. Undangan `expired` + datanya (tamu, RSVP,
-- media, gift_notes) dipertahankan 6 bulan setelah `active_until` (grace period
-- perpanjangan), lalu DIHAPUS PERMANEN. Baris `invitations` tinggal sebagai
-- KERANGKA statistik tanpa data pribadi; `orders` (incl. raw_notification)
-- DIPERTAHANKAN (retensi keuangan >= 2 tahun).
--
-- Sebelum migrasi ini, cron `expire-invitations` HANYA membalik status → tak ada
-- purge sama sekali (celah kepatuhan: janji /privasi & LAUNCH-CHECKLIST tak
-- ditegakkan). Migrasi ini menyediakan kolom penanda + RPC purge yang dipakai
-- bersama oleh cron retensi DAN aksi "hapus undangan" self-service (owner).

-- -----------------------------------------------------------------------------
-- 1) Penanda purge — idempotensi cron + audit kapan data pribadi dihapus.
-- -----------------------------------------------------------------------------
alter table public.invitations
  add column if not exists purged_at timestamptz;

comment on column public.invitations.purged_at is
  'Waktu data pribadi (tamu/RSVP/gift_notes/media + content) dihapus permanen (retensi UU PDP). NULL = belum dipurge. Baris undangan tetap ada sebagai kerangka statistik + tautan orders (retensi keuangan).';

-- -----------------------------------------------------------------------------
-- 2) Index parsial — scan cron hanya menyentuh baris yang MASIH perlu dipurge.
--    (Baris yang sudah dipurge / belum expired tak masuk index → scan murah
--    meski jumlah undangan expired menumpuk.)
-- -----------------------------------------------------------------------------
create index if not exists invitations_purge_scan_idx
  on public.invitations (active_until)
  where status = 'expired' and purged_at is null;

-- -----------------------------------------------------------------------------
-- 3) RPC purge — hapus data pribadi anak + scrub content, PERTAHANKAN baris
--    undangan (kerangka) & orders. SECURITY DEFINER + search_path='' (pola
--    harden_functions; nama dikualifikasi). Kunci baris undangan → aman-ras vs
--    perpanjangan/aktivasi. Idempoten via purged_at. TIDAK ada gate waktu di
--    sini — cron menyaring 6 bulan di query; user "hapus undangan" minta lebih
--    cepat. HANYA `expired` yang jadi kerangka (draft dihapus penuh via jalur
--    hard-delete cascade; active/pending/suspended dilindungi).
--
--    Mengembalikan `storage_path` media yang dihapus agar PEMANGGIL membersihkan
--    objek storage (SQL tak bisa menyentuh bucket). Best-effort di sisi pemanggil;
--    orphan storage tak berbahaya & tak tertebak.
-- -----------------------------------------------------------------------------
create or replace function public.purge_invitation_data(p_invitation_id uuid)
  returns table (result text, media_paths text[])
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
  v_paths text[];
begin
  select * into v_inv from public.invitations
    where id = p_invitation_id for update;
  if not found then
    return query select 'not_found'::text, null::text[];
    return;
  end if;

  if v_inv.status <> 'expired' then
    return query select 'not_expired'::text, null::text[];
    return;
  end if;

  -- Idempoten: sudah dipurge → no-op (aman dipanggil ulang cron).
  if v_inv.purged_at is not null then
    return query select 'already_purged'::text, null::text[];
    return;
  end if;

  -- Kumpulkan path media DULU (untuk pembersihan storage oleh pemanggil).
  select coalesce(array_agg(storage_path), '{}') into v_paths
    from public.media where invitation_id = p_invitation_id;

  -- Hapus permanen data pribadi. invitation_events (venue/alamat = data acara)
  -- ikut dihapus agar kerangka benar-benar tanpa data pribadi.
  delete from public.rsvps where invitation_id = p_invitation_id;
  delete from public.gift_notes where invitation_id = p_invitation_id;
  delete from public.guests where invitation_id = p_invitation_id;
  delete from public.media where invitation_id = p_invitation_id;
  delete from public.invitation_events where invitation_id = p_invitation_id;

  -- Scrub konten pribadi; tandai purged. settings (varian warna/toggle) bukan
  -- data pribadi → dibiarkan. Trigger set_invitations_updated_at urus updated_at.
  update public.invitations
    set content = '{}'::jsonb, purged_at = now()
    where id = p_invitation_id;

  return query select 'purged'::text, v_paths;
end;
$$;

revoke execute on function public.purge_invitation_data(uuid)
  from anon, authenticated, public;
grant execute on function public.purge_invitation_data(uuid)
  to service_role;

comment on function public.purge_invitation_data(uuid) is
  'Hapus permanen data pribadi undangan EXPIRED (tamu/RSVP/gift_notes/media/events + scrub content), pertahankan baris undangan (kerangka) & orders (retensi keuangan). Idempoten via purged_at. Return media storage_path utk pembersihan storage. HANYA service_role (cron retensi / server action hapus undangan owner-expired).';
