-- Peringatan pra-purge (AUDIT-2026-10-01 B7): penanda dua tahap.
--
-- `docs/DATA-MODEL.md` sudah MENJANJIKAN "email pengingat sebelum penghapusan"
-- yang tak pernah dibuat, dan `/syarat` menyuruh pelanggan mengunduh datanya
-- sebelum tenggat — tanpa pernah memberi tahu kapan tenggat itu tiba. Kolom ini
-- yang membuat janji itu bisa ditepati.
--
-- DUA kolom, bukan satu: satu kolom hanya bisa menandai satu kiriman, sehingga
-- begitu H-30 menulisnya, H-7 secara struktural tak akan pernah terkirim — dan
-- tak ada yang akan menyadarinya karena `cron_runs.stats` tetap hijau.
--
-- TIDAK ADA kolom "siklus", dan TIDAK ADA satu pun RPC yang perlu me-resetnya.
-- Penanda dianggap milik siklus berjalan bila nilainya LEBIH BARU daripada
-- `active_until`; perpanjangan selalu memajukan `active_until`, jadi penanda
-- lama otomatis basi dengan sendirinya. Itu disengaja: reset yang harus diingat
-- di banyak tempat sudah terbukti membusuk di repo ini — `reminder_sent_at`
-- hilang dua kali saat `activate_paid_order` dibuat ulang (DECISIONS #65).
--
-- Tak perlu grant baru: GRANT UPDATE pada `invitations` adalah allowlist kolom,
-- jadi kolom baru otomatis tak bisa ditulis `authenticated`. RLS tabel sudah
-- aktif; hanya service_role (cron) yang menulis ini.
alter table public.invitations
  add column if not exists purge_warned_at timestamptz,
  add column if not exists purge_final_warned_at timestamptz;

comment on column public.invitations.purge_warned_at is
  'Peringatan pra-purge TAHAP PERTAMA (~30 hari sebelum penghapusan permanen) terakhir dikirim. Dianggap milik siklus berjalan hanya bila > active_until — perpanjangan memajukan active_until sehingga penanda lama basi sendiri, tanpa RPC mana pun perlu me-resetnya (B7).';
comment on column public.invitations.purge_final_warned_at is
  'Peringatan pra-purge TERAKHIR (~7 hari) terakhir dikirim. Gerbang purge menuntut penanda ini segar DAN sudah lewat jedanya — data pribadi tak dihapus tanpa peringatan yang benar-benar terkirim; backstop tetap ada agar pipeline email yang rusak tak menahan kewajiban retensi selamanya (B7).';
