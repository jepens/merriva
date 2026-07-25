-- M1.5 (hardening pasca-review) — batasi format `media.storage_path` di DB.
-- Ancaman: RLS media_insert hanya cek kepemilikan, bukan FORMAT path. Insert
-- langsung via PostgREST bisa menyimpan path arbitrer (mis. mengandung tanda
-- kutip) → saat dirender ke CSS `url("…")`/`<img src>` bisa jadi CSS-injection.
-- Path sah dibuat server: `inv/{invitationId-uuid}/{mediaId-uuid}`. Constraint
-- ini menolak apa pun di luar bentuk itu (mengunci karakter berbahaya).
alter table public.media
  add constraint media_storage_path_format
  check (
    storage_path ~ '^inv/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  );
