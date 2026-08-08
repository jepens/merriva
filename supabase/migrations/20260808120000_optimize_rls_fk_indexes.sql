-- Optimasi performa DB (advisor Supabase, 2026-08-08). NON-destruktif; tak
-- mengubah semantik akses — hanya bentuk evaluasi & indeks pendukung.
--
-- (1) auth_rls_initplan: `auth.uid()` di policy RLS dievaluasi ULANG per baris.
--     Dibungkus `(select auth.uid())` → Postgres menjadikannya InitPlan (dihitung
--     SEKALI per query). Nilainya identik, jadi keputusan izin per baris TAK
--     berubah; hanya lebih cepat pada query berbaris banyak (dinding ucapan,
--     daftar undangan/order). `private.is_admin()` TIDAK diubah (bukan pemanggilan
--     `auth.<fn>()` langsung; tak masuk temuan advisor).
-- (2) unindexed_foreign_keys: index penutup untuk FK yang dipakai join/lookup &
--     cascade (`on delete`). `if not exists` → aman diulang.
--
-- Memakai `ALTER POLICY` (bukan DROP/CREATE) agar policy tak pernah absen di
-- tengah migrasi. Ekspresi mereproduksi definisi berjalan (lihat pg_policies),
-- termasuk `private.is_admin()` (harden_functions memindahkan is_admin ke skema
-- private) — hanya `auth.uid()` yang dibungkus.

-- (1) RLS InitPlan — bungkus auth.uid()
alter policy profiles_select on public.profiles
  using ((id = (select auth.uid())) or private.is_admin());

alter policy profiles_update on public.profiles
  using ((id = (select auth.uid())) or private.is_admin())
  with check ((id = (select auth.uid())) or private.is_admin());

alter policy invitations_select on public.invitations
  using ((user_id = (select auth.uid())) or private.is_admin());

alter policy invitations_insert on public.invitations
  with check ((user_id = (select auth.uid())) or private.is_admin());

alter policy invitations_update on public.invitations
  using ((user_id = (select auth.uid())) or private.is_admin())
  with check ((user_id = (select auth.uid())) or private.is_admin());

alter policy invitations_delete on public.invitations
  using (
    ((user_id = (select auth.uid())) and status = 'draft'::public.invitation_status)
    or private.is_admin()
  );

alter policy orders_select on public.orders
  using ((user_id = (select auth.uid())) or private.is_admin());

-- (2) Index penutup foreign key
create index if not exists admin_logs_admin_id_idx on public.admin_logs (admin_id);
create index if not exists invitations_package_id_idx on public.invitations (package_id);
create index if not exists invitations_theme_id_idx on public.invitations (theme_id);
create index if not exists orders_invitation_id_idx on public.orders (invitation_id);
create index if not exists orders_package_id_idx on public.orders (package_id);
create index if not exists rsvps_guest_id_idx on public.rsvps (guest_id);
