-- =============================================================================
-- Merriva — Migrasi v1 (skema awal MVP Fase 1)
-- Sumber kebenaran: docs/DATA-MODEL.md (tabel §1, transisi §2, RLS §3, index §4).
--
-- Prinsip:
--  * RLS AKTIF di SEMUA tabel (boundary wajib).
--  * `service_role` (server) bypass RLS by default → tidak butuh policy.
--  * anon/authenticated diatur eksplisit; admin dibedakan via public.is_admin().
--  * Data sensitif (guests/gift_notes/orders) TIDAK pernah punya policy anon.
--
-- Urutan: enum → tabel → fungsi → trigger → index → RLS/policy → seed.
-- (Fungsi `language sql` di-parse-check body-nya saat CREATE, jadi harus SETELAH
--  tabel yang direferensikannya ada.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum
-- -----------------------------------------------------------------------------
create type public.profile_role as enum ('client', 'admin');
create type public.theme_tier as enum ('standard', 'premium');
create type public.invitation_category as enum ('wedding', 'corporate', 'family');
create type public.invitation_status as enum (
  'draft', 'pending_payment', 'active', 'expired', 'suspended'
);
create type public.order_status as enum (
  'pending', 'paid', 'expired', 'failed', 'refunded'
);
create type public.rsvp_attendance as enum ('yes', 'no');
create type public.gift_note_type as enum ('transfer', 'gift');
create type public.media_type as enum ('photo');

-- -----------------------------------------------------------------------------
-- 2. Tabel
-- -----------------------------------------------------------------------------

-- profiles (1:1 dengan auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text, -- WhatsApp, format E.164
  role public.profile_role not null default 'client',
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Profil user; role admin di-set manual via SQL (tanpa UI).';

-- themes (katalog metadata; kode tema ada di repo)
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, -- = folder src/themes/{slug}
  name text not null,
  categories public.invitation_category[] not null default '{}',
  tier public.theme_tier not null default 'standard',
  preview_image text,
  demo_slug text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- packages (DB-driven agar harga bisa diubah tanpa deploy)
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, -- 'basic' | 'premium'
  name text not null,
  price_idr int not null check (price_idr >= 0), -- integer IDR, tanpa float
  duration_months int not null check (duration_months > 0),
  limits jsonb not null default '{}'::jsonb, -- {max_photos,max_guests,youtube,all_themes,watermark}
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- invitations (inti)
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  theme_id uuid not null references public.themes (id) on delete restrict,
  package_id uuid references public.packages (id) on delete set null, -- terisi saat paid
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,60}$'),
  category public.invitation_category not null,
  status public.invitation_status not null default 'draft',
  content jsonb not null default '{}'::jsonb, -- data form (skema Zod per kategori)
  settings jsonb not null default '{}'::jsonb, -- varian warna, toggle section, moderasi
  event_date date,
  active_until timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- invitation_events (jadwal ternormalisasi — fondasi check-in Fase 2)
create table public.invitation_events (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  name text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  venue_name text,
  address text,
  maps_url text,
  sort_order int not null default 0
);

-- media (foto per undangan; hanya storage_path relatif, TANPA URL vendor)
create table public.media (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  type public.media_type not null default 'photo',
  storage_path text not null, -- relatif, immutable hash
  width int,
  height int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- guests (identitas tamu; token = calon QR check-in Fase 2). PRIVAT.
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  name text not null,
  phone text,
  group_label text,
  pax_allocated int not null default 2 check (pax_allocated >= 0),
  token text unique not null check (char_length(token) >= 10), -- nanoid >= 10 char
  wa_clicked_at timestamptz,
  first_viewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
comment on table public.guests is 'PRIVAT: tidak pernah diserve ke publik selain nama pemilik token bersangkutan.';

-- rsvps (kehadiran + ucapan, satu form gabungan)
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  guest_id uuid references public.guests (id) on delete set null, -- null = tamu tanpa token
  guest_name text not null,
  attendance public.rsvp_attendance not null,
  pax int not null default 1 check (pax >= 0),
  message text,
  is_hidden boolean not null default false,
  is_approved boolean not null default true, -- false bila moderasi aktif
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- gift_notes (konfirmasi amplop/kado). PRIVAT untuk pemilik.
create table public.gift_notes (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  guest_name text not null,
  type public.gift_note_type not null,
  amount int check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);
comment on table public.gift_notes is 'PRIVAT: hanya pemilik/admin. Tidak pernah diserve ke publik.';

-- orders (pembayaran). PRIVAT.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  package_id uuid not null references public.packages (id) on delete restrict,
  amount_idr int not null check (amount_idr >= 0),
  status public.order_status not null default 'pending',
  order_code text unique not null, -- dikirim sebagai order_id ke Pakasir (mis. MRV-8F3K2)
  payment_method text,
  paid_at timestamptz,
  raw_notification jsonb, -- payload webhook untuk rekonsiliasi (retensi >= 2 tahun)
  created_at timestamptz not null default now()
);
comment on table public.orders is 'PRIVAT: hanya pemilik/admin. Tidak pernah diserve ke publik.';

-- songs (library musik royalty-free)
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  storage_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- admin_logs (audit aksi admin)
create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. Fungsi helper (SETELAH tabel — body SQL divalidasi saat CREATE)
-- -----------------------------------------------------------------------------

-- Apakah user saat ini admin? SECURITY DEFINER agar tidak rekursif ke RLS profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Apakah user saat ini pemilik undangan tsb? Dipakai policy tabel anak.
create or replace function public.owns_invitation(inv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invitations i
    where i.id = inv_id and i.user_id = auth.uid()
  );
$$;

-- Trigger generik untuk memperbarui updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Buat baris profiles otomatis saat user baru terdaftar di auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Trigger
-- -----------------------------------------------------------------------------
create trigger set_invitations_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

create trigger set_rsvps_updated_at
  before update on public.rsvps
  for each row execute function public.set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 5. Index (DATA-MODEL §4)
-- -----------------------------------------------------------------------------
-- (slug, token, order_code unik → index otomatis dari UNIQUE constraint)
create index invitations_user_status_idx on public.invitations (user_id, status);
create index invitations_status_active_until_idx on public.invitations (status, active_until);
create index invitation_events_invitation_sort_idx on public.invitation_events (invitation_id, sort_order);
create index media_invitation_sort_idx on public.media (invitation_id, sort_order);
create index guests_invitation_idx on public.guests (invitation_id);
create index rsvps_invitation_created_idx on public.rsvps (invitation_id, created_at desc);
create unique index rsvps_invitation_guest_uniq on public.rsvps (invitation_id, guest_id)
  where guest_id is not null; -- kiriman ulang tamu bertoken = UPDATE, bukan duplikat
create index gift_notes_invitation_idx on public.gift_notes (invitation_id);
create index orders_user_idx on public.orders (user_id);
create index orders_status_created_idx on public.orders (status, created_at); -- cron expiry
create index admin_logs_created_idx on public.admin_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- 5b. Grants peran Supabase (privilege dasar objek — RLS membatasi BARIS)
--     RLS tidak berguna tanpa privilege objek. Eksplisit + default-privileges
--     agar PORTABLE (Supabase lokal & hosted) tanpa bergantung konfigurasi
--     default-privileges environment.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- service_role (server): akses penuh (bypass RLS + tetap butuh privilege objek).
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- authenticated (klien login): DML dasar; RLS + hardening kolom (§6b) yang membatasi.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- anon (publik): hanya SELECT katalog; RLS membatasi ke is_active. Tak pernah menulis.
grant select on public.themes, public.packages, public.songs to anon;

-- Default privileges untuk objek yang dibuat migrasi berikutnya (dibuat oleh postgres).
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security (RLS matrix — DATA-MODEL §3)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.themes enable row level security;
alter table public.packages enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_events enable row level security;
alter table public.media enable row level security;
alter table public.guests enable row level security;
alter table public.rsvps enable row level security;
alter table public.gift_notes enable row level security;
alter table public.orders enable row level security;
alter table public.songs enable row level security;
alter table public.admin_logs enable row level security;

-- profiles: client SELECT/UPDATE baris sendiri; admin ALL. Insert via trigger (definer).
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin());
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- themes/packages/songs: anon & client SELECT is_active; admin ALL.
create policy themes_select_public on public.themes
  for select to anon, authenticated
  using (is_active or public.is_admin());
create policy themes_admin_write on public.themes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy packages_select_public on public.packages
  for select to anon, authenticated
  using (is_active or public.is_admin());
create policy packages_admin_write on public.packages
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy songs_select_public on public.songs
  for select to anon, authenticated
  using (is_active or public.is_admin());
create policy songs_admin_write on public.songs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- invitations: client CRUD miliknya (DELETE hanya saat draft); admin ALL. anon: none.
create policy invitations_select on public.invitations
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
create policy invitations_update on public.invitations
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy invitations_delete on public.invitations
  for delete to authenticated
  using ((user_id = auth.uid() and status = 'draft') or public.is_admin());

-- invitation_events: CRUD via kepemilikan undangan; admin ALL. anon: none.
create policy invitation_events_select on public.invitation_events
  for select to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin());
create policy invitation_events_insert on public.invitation_events
  for insert to authenticated
  with check (public.owns_invitation(invitation_id) or public.is_admin());
create policy invitation_events_update on public.invitation_events
  for update to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin())
  with check (public.owns_invitation(invitation_id) or public.is_admin());
create policy invitation_events_delete on public.invitation_events
  for delete to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin());

-- media: CRUD via kepemilikan undangan; admin ALL. anon: none.
create policy media_select on public.media
  for select to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin());
create policy media_insert on public.media
  for insert to authenticated
  with check (public.owns_invitation(invitation_id) or public.is_admin());
create policy media_update on public.media
  for update to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin())
  with check (public.owns_invitation(invitation_id) or public.is_admin());
create policy media_delete on public.media
  for delete to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin());

-- guests: CRUD via kepemilikan undangan; admin ALL. anon: none.
create policy guests_select on public.guests
  for select to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin());
create policy guests_insert on public.guests
  for insert to authenticated
  with check (public.owns_invitation(invitation_id) or public.is_admin());
create policy guests_update on public.guests
  for update to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin())
  with check (public.owns_invitation(invitation_id) or public.is_admin());
create policy guests_delete on public.guests
  for delete to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin());

-- rsvps: client SELECT + UPDATE(is_hidden/approve) via kepemilikan; admin ALL.
-- INSERT publik HANYA lewat server action + service_role (bypass RLS). anon: none.
create policy rsvps_select on public.rsvps
  for select to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin());
create policy rsvps_update on public.rsvps
  for update to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin())
  with check (public.owns_invitation(invitation_id) or public.is_admin());
create policy rsvps_admin_insert on public.rsvps
  for insert to authenticated
  with check (public.is_admin());
create policy rsvps_admin_delete on public.rsvps
  for delete to authenticated
  using (public.is_admin());

-- gift_notes: client SELECT via kepemilikan; admin ALL. INSERT publik via service_role.
create policy gift_notes_select on public.gift_notes
  for select to authenticated
  using (public.owns_invitation(invitation_id) or public.is_admin());
create policy gift_notes_admin_insert on public.gift_notes
  for insert to authenticated
  with check (public.is_admin());
create policy gift_notes_admin_update on public.gift_notes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy gift_notes_admin_delete on public.gift_notes
  for delete to authenticated
  using (public.is_admin());

-- orders: client SELECT miliknya; admin ALL. Lifecycle order dikelola server (service_role).
create policy orders_select on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_insert on public.orders
  for insert to authenticated
  with check (public.is_admin());
create policy orders_admin_update on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy orders_admin_delete on public.orders
  for delete to authenticated
  using (public.is_admin());

-- admin_logs: admin SELECT + INSERT; tanpa update/delete (audit imutabel). anon/client: none.
create policy admin_logs_select on public.admin_logs
  for select to authenticated
  using (public.is_admin());
create policy admin_logs_insert on public.admin_logs
  for insert to authenticated
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6b. Hardening privilege KOLOM (defense-in-depth di atas RLS)
--
--     RLS membatasi BARIS mana yang boleh diubah, tapi TIDAK membatasi KOLOM.
--     Di Postgres, grant UPDATE tabel-level menutupi semua kolom (column-level
--     REVOKE diabaikan bila grant tabel-level masih ada). Karena itu kita cabut
--     UPDATE tabel-level dari anon/authenticated lalu grant ULANG hanya kolom
--     yang boleh ditulis client. Kolom sensitif hanya ditulis service_role
--     (server action) — sesuai prinsip "semua mutasi lewat server".
-- -----------------------------------------------------------------------------

-- profiles: client hanya boleh ubah full_name & phone.
-- Kolom `role` TIDAK diberikan → cegah eskalasi privilege menjadi admin
-- (role di-set manual via SQL/service_role, tanpa UI — DATA-MODEL §1).
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- invitations: client ubah konten/tema/slug/kategori/jadwal.
-- Kolom lifecycle (status, active_until, package_id, published_at) TIDAK diberikan
-- → cegah self-activation tanpa pembayaran; transisi status hanya via service_role.
revoke update on public.invitations from anon, authenticated;
grant update (theme_id, slug, category, content, settings, event_date)
  on public.invitations to authenticated;

-- rsvps: owner hanya boleh moderasi (is_hidden, is_approved).
-- Data kiriman tamu (guest_name, attendance, pax, message) TIDAK bisa ditulis ulang.
revoke update on public.rsvps from anon, authenticated;
grant update (is_hidden, is_approved) on public.rsvps to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Seed config esensial: packages (harus ada di semua environment)
--    Idempoten agar aman bila migrasi diterapkan ke DB yang sudah punya baris.
-- -----------------------------------------------------------------------------
insert into public.packages (code, name, price_idr, duration_months, limits, is_active)
values
  (
    'basic', 'Basic', 99000, 6,
    '{"max_photos": 8, "max_guests": 150, "youtube": false, "all_themes": false, "watermark": true}'::jsonb,
    true
  ),
  (
    'premium', 'Premium', 199000, 12,
    '{"max_photos": 20, "max_guests": null, "youtube": true, "all_themes": true, "watermark": false}'::jsonb,
    true
  )
on conflict (code) do nothing;
