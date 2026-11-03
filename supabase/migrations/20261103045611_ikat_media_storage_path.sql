-- Ikat `media.storage_path` ke barisnya sendiri: path WAJIB persis
-- `inv/<invitation_id>/<id>`.
--
-- Celah yang ditutup (audit 3 Nov 2026). `media_storage_path_format`
-- (20260725184802) hanya mengunci BENTUK `inv/<uuid>/<uuid>`; kedua UUID-nya
-- tidak diikat ke baris yang memuatnya. Padahal `authenticated` boleh INSERT
-- dan UPDATE seluruh kolom `media` lewat Data API, dan policy-nya hanya
-- memeriksa kepemilikan `invitation_id`. Pemilik undangan mana pun — cukup akun
-- gratis dengan satu draft — bisa menulis path foto undangan ORANG LAIN ke
-- barisnya sendiri (UUID korban terbaca di HTML undangan publik,
-- `/media/inv/<undangan>/<foto>/…`), lalu menekan "hapus foto" atau menghapus
-- draftnya. Kelima jalur hapus memercayai kolom ini dan menghapus objek KORBAN
-- dengan driver storage server: hapus foto galeri, hapus draft, purge oleh
-- pemilik, cron purge-expired, dan hapus akun (tiga yang terakhir lewat
-- `purge_invitation_data`). Volume media belum punya backup.
--
-- Kenapa di DB, bukan penjaga prefix di kelima jalur itu: semuanya membaca
-- kolom yang sama, dan `purge_invitation_data` (20261016111713) memang sudah
-- bersandar pada constraint ini sebagai jaminan bentuk. Satu CHECK menutup
-- INSERT dan UPDATE untuk role apa pun, termasuk kode service_role. Mencabut
-- hak UPDATE saja tidak cukup: INSERT langsung dengan path korban tetap lolos.
--
-- Larangan lama ikut terjaga: `uuid::text` hanya berisi hex huruf kecil dan
-- tanda hubung, jadi karakter berbahaya (CSS-injection, alasan constraint
-- aslinya) tetap tertolak. Semua baris yang ada sudah memenuhi bentuk ini:
-- path dibuat server lewat `mediaPrefix(invitationId, mediaId)`, dan
-- `insert_gallery_media` menyisipkan `media_id` yang sama sebagai `id`
-- (diperiksa 3 Nov: 9 baris produksi, 0 menyimpang). Nama constraint sengaja
-- dipertahankan supaya rujukan di migrasi purge tetap benar.
alter table public.media
  drop constraint if exists media_storage_path_format,
  add constraint media_storage_path_format
    check (storage_path = 'inv/' || invitation_id::text || '/' || id::text);
