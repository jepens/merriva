-- M2.3b — Impor tamu massal: SATU advisory lock + SATU cek limit untuk seluruh
-- batch (seperti diisyaratkan komentar M1.6 pada `insert_guest`).
--
-- Menyisipkan tamu berurutan sampai kuota paket habis: baris ke-`ord` disisipkan
-- hanya bila `(jumlah_sekarang + ord) <= max_guests` (max_guests NULL = tanpa
-- batas / Premium). Baris di luar kuota DILEWATI diam-diam; pemanggil menghitung
-- selisih (dikirim − tersisip) sebagai "dilewati karena limit" untuk laporan.
--
-- Token dibuat pemanggil (server action, `randomToken`) dan disertakan per baris;
-- pelanggaran unik (23505; nyaris mustahil) menggagalkan seluruh tx → pemanggil
-- mengulang dengan token baru. SECURITY INVOKER → RLS `guests_insert`
-- (`owns_invitation`) + resolver `invitation_effective_limits` (NULL = bukan
-- pemilik → set kosong) menjaga isolasi antar-pemilik.

create or replace function public.insert_guests_bulk(inv_id uuid, guests jsonb)
returns setof public.guests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lim jsonb;
  max_g int;
  cur int;
begin
  -- Ruang lock sama dengan insert_guest (seed 1) → tambah-tamu tunggal & massal
  -- saling serialize (cek limit tak balapan).
  perform pg_advisory_xact_lock(hashtextextended(inv_id::text, 1));

  lim := public.invitation_effective_limits(inv_id);
  if lim is null then
    return; -- undangan tak terlihat (bukan milik pemanggil) → set kosong
  end if;

  max_g := (lim ->> 'max_guests')::int; -- NULL = tanpa batas (Premium)

  select count(*) into cur
    from public.guests
    where invitation_id = inv_id;

  return query
  insert into public.guests
    (invitation_id, name, phone, group_label, pax_allocated, token, notes)
  select
    inv_id,
    g ->> 'name',
    nullif(g ->> 'phone', ''),
    nullif(g ->> 'group_label', ''),
    coalesce((g ->> 'pax')::int, 2),
    g ->> 'token',
    nullif(g ->> 'notes', '')
  from jsonb_array_elements(guests) with ordinality as t(g, ord)
  -- Sisipkan hanya dalam sisa kuota; urutan array = urutan prioritas.
  where max_g is null or (cur + ord) <= max_g
  order by ord
  returning *;
end;
$$;

revoke execute on function public.insert_guests_bulk(uuid, jsonb) from anon, public;
grant execute on function public.insert_guests_bulk(uuid, jsonb)
  to authenticated, service_role;

comment on function public.insert_guests_bulk(uuid, jsonb) is
  'Impor tamu massal atomik: 1 advisory lock (seed 1) + 1 cek limit untuk seluruh batch; sisip berurutan sampai max_guests (null=tanpa batas). SECURITY INVOKER → RLS owns_invitation. Baris di luar kuota dilewati. M2.3b.';
