-- AUDIT-2026-10-01 — jejak eksekusi scheduled job.
--
-- Empat cron memegang kewajiban hukum (retensi UU PDP), komersial (aktivasi
-- order lunas), dan kontraktual (pengingat H-14), tetapi tak ada satu pun cara
-- mengetahui mereka berhenti jalan: kegagalan dijawab `{ok:false}` 503 yang
-- hanya jadi exit code curl di panel Easypanel, dan NON-EKSEKUSI (job dihapus,
-- salah ketik, mati setelah redeploy) sama sekali tak meninggalkan sinyal.
-- `/api/health` pun hanya memprobe PostgREST, tak pernah menyentuh cron.
--
-- Keputusan pemilik (2026-10-03): tabel jejak + tampil di panel admin, bukan
-- layanan dead-man switch eksternal. Batasnya diterima sadar dan dicatat: ini
-- terlihat bila DILIHAT, ia tidak mendorong notifikasi.
--
-- SATU BARIS PER JOB (upsert), bukan riwayat: yang dibutuhkan adalah "kapan
-- terakhir jalan dan apakah berhasil". Riwayat penuh akan tumbuh tanpa batas
-- dan menuntut cron pembersih sendiri — cron untuk menjaga cron.
create table public.cron_runs (
  name text primary key,
  last_run_at timestamptz not null default now(),
  last_ok_at timestamptz,
  ok boolean not null,
  -- Ringkasan hasil (mis. {"expired":3}) — untuk diagnosis, bukan audit.
  stats jsonb not null default '{}'::jsonb,
  -- Pesan galat terakhir. TANPA PII: cron menyentuh data tamu, dan pesan
  -- Postgres bisa memuat nilai baris.
  last_error text,
  runs int not null default 0,
  failures int not null default 0
);

comment on table public.cron_runs is
  'Jejak eksekusi scheduled job: satu baris per job, di-upsert tiap jalan (AUDIT-2026-10-01). Dibaca panel admin untuk menandai job yang berhenti jalan. HANYA service_role.';
comment on column public.cron_runs.last_ok_at is
  'Jalan SUKSES terakhir. Dibedakan dari last_run_at supaya job yang jalan tetapi selalu gagal tidak tampak sehat.';

-- RLS wajib untuk setiap tabel baru (CLAUDE.md). TANPA policy sama sekali:
-- tabel ini hanya disentuh service_role, yang mem-bypass RLS. anon &
-- authenticated karena itu tak melihat apa pun — termasuk nama job dan pesan
-- galat, yang tak ada gunanya bagi mereka.
alter table public.cron_runs enable row level security;

revoke all on table public.cron_runs from anon, authenticated;
grant select, insert, update on table public.cron_runs to service_role;
