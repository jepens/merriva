-- Merriva — Migrasi v5: RPC atomik ganti seluruh sesi acara sebuah undangan.
--
-- Dipakai autosave editor (jadwal). Delete-all + insert dalam SATU fungsi →
-- atomik & bebas race (dua autosave beruntun tak menggandakan baris).
-- SECURITY INVOKER: RLS invitation_events (owns_invitation) berlaku ke pemanggil,
-- jadi hanya bisa mengubah sesi undangan miliknya sendiri. search_path dikunci.
create or replace function public.replace_invitation_events(inv_id uuid, events jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.invitation_events where invitation_id = inv_id;

  if jsonb_typeof(events) = 'array' then
    insert into public.invitation_events
      (invitation_id, name, start_at, end_at, venue_name, address, maps_url, sort_order)
    select
      inv_id,
      coalesce(nullif(e->>'name', ''), 'Acara'),
      (e->>'start_at')::timestamptz,
      nullif(e->>'end_at', '')::timestamptz,
      nullif(e->>'venue_name', ''),
      nullif(e->>'address', ''),
      nullif(e->>'maps_url', ''),
      coalesce((e->>'sort_order')::int, 0)
    from jsonb_array_elements(events) as e
    where nullif(e->>'start_at', '') is not null;
  end if;
end;
$$;

-- Hanya untuk klien login (editor). anon tak boleh memanggil.
revoke execute on function public.replace_invitation_events(uuid, jsonb) from anon;
grant execute on function public.replace_invitation_events(uuid, jsonb) to authenticated, service_role;
