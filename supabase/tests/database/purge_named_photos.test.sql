-- Test DB (pgTAP) — foto bernama ikut terhapus saat retensi.
-- Jalankan: `pnpm test:db` (butuh stack Supabase lokal: `supabase start`).
-- Mandiri: fixture dibuat di dalam transaksi ini dan di-ROLLBACK di akhir.
--
-- KENAPA BERKAS INI ADA: foto sampul, foto mempelai, dan logo perusahaan tidak
-- punya baris tabel — pathnya hidup di dalam `invitations.content`. Fungsi yang
-- sama yang mengembalikan daftar objek untuk dihapus juga menimpa `content`
-- menjadi `'{}'`. Jadi sebelum migrasi 20261014120000, urutannya adalah:
-- satu-satunya rujukan ke objek itu dihapus, objeknya sendiri tidak. Foto wajah
-- mempelai tertinggal di storage selamanya, dan cron melaporkan "purged" dengan
-- jujur — tak ada apa pun yang terlihat salah dari luar.
--
-- KENAPA FIXTURE-NYA DITULIS ULANG (16 Okt 2026, migrasi
-- 20261016111713). Versi pertama berkas ini menulis foto sebagai STRING
-- telanjang. Aplikasi tidak pernah menulis bentuk itu lagi sejak editor foto
-- non-destruktif ada: `photoSchema` menormalkan setiap foto menjadi OBJEK
-- `{path,x,y,zoom}`. Jadi delapan assert di sini hijau selama dua hari di atas
-- bentuk yang tidak ada di produksi, sementara bentuk yang NYATA membuat
-- `content->>'coverPhoto'` mengembalikan TEKS JSON objeknya — yang lalu
-- diperlakukan sebagai path dan diserahkan ke storage.
--
-- Karena itu undangan A kini memakai bentuk OBJEK (yang benar-benar ditulis
-- aplikasi), B tetap memakai bentuk STRING (data lama yang sengaja masih
-- diterima), dan D menguji bentuk-bentuk RUSAK yang harus tersaring — bukan
-- diteruskan sebagai teks JSON.
--
-- Yang dijaga: keempat jenis foto ikut terpanen pada KEDUA bentuk, prefix
-- galeri TETAP ikut (regex foto bernama tak boleh membuangnya), content kosong
-- tidak menyisipkan baris NULL ke daftar (satu NULL di sana membuat
-- penghapusan di sisi aplikasi melempar untuk SELURUH undangan itu), dan tak
-- ada teks JSON yang pernah lolos sebagai path.
--
-- FOTO PER ENTRI CERITA (DECISIONS #127, migrasi 20261111090000):
-- `content.story[i].photo` memakai `photoSchema` yang sama, jadi A juga
-- membawa cerita bentuk editor — foto OBJEK, foto STRING lama, entri TANPA
-- foto, entri yang merujuk foto undangan LAIN, dan satu rujukan ganda. D
-- menyimpan `story` yang BUKAN array (tak boleh menggagalkan purge), E menyimpan
-- array berisi elemen rusak yang harus tersaring seluruhnya.
--
-- Hasil ditangkap ke tabel sementara karena panggilan kedua pada undangan yang
-- sama menjawab `already_purged` — daftar pathnya hanya ada di panggilan
-- PERTAMA.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Fixture ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('0d810000-0000-4000-8000-00000000000a', 'pgtap-foto@merriva.test');
insert into public.themes (id, slug, name, categories) values
  ('0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-tema', 'pgTAP', '{wedding,corporate}');

-- A: wedding — sampul + kedua mempelai dalam bentuk OBJEK (bentuk yang ditulis
--    aplikasi hari ini), ditambah satu prefix galeri, ditambah cerita
--    (`story`) berfoto: OBJEK (c5), STRING lama (c6), entri tanpa foto, entri
--    berisi foto undangan LAIN (a2/c7), dan entri yang merujuk c5 lagi.
-- B: corporate — logo dalam bentuk STRING (data lama, masih sah tanpa migrasi).
-- C: content kosong (penjaga regresi).
-- D: bentuk-bentuk RUSAK yang harus tersaring seluruhnya.
-- E: wedding — `story` array berisi elemen RUSAK, harus tersaring seluruhnya.
insert into public.invitations
  (id, user_id, theme_id, slug, category, status, active_until, content)
values
  ('0d810000-0000-4000-8000-0000000000a1', '0d810000-0000-4000-8000-00000000000a',
   '0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-a', 'wedding', 'expired',
   '2026-01-01 00:00:00+00',
   '{"coverPhoto":{"path":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c1","x":0.5,"y":0.5,"zoom":1},
     "groom":{"name":"A","photo":{"path":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c2","x":0.3,"y":0.7,"zoom":1.4}},
     "bride":{"name":"B","photo":{"path":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c3","x":0.5,"y":0.5,"zoom":1}},
     "story":[
       {"title":"Pertama bertemu","date":"Maret 2019","narrative":"Di kampus.",
        "photo":{"path":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c5","x":0.5,"y":0.4,"zoom":1.2}},
       {"title":"Lamaran","date":"Juni 2025","narrative":"Bersama keluarga."},
       {"title":"Menikah","date":"Januari 2026",
        "photo":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c6"},
       {"title":"Asing","photo":{"path":"inv/0d810000-0000-4000-8000-0000000000a2/foto/0d810000-0000-4000-8000-0000000000c7","x":0.5,"y":0.5,"zoom":1}},
       {"title":"Ganda","photo":{"path":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c5","x":0.5,"y":0.5,"zoom":1}}
     ]}'::jsonb),
  ('0d810000-0000-4000-8000-0000000000a2', '0d810000-0000-4000-8000-00000000000a',
   '0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-b', 'corporate', 'expired',
   '2026-01-01 00:00:00+00', '{"logo":"inv/0d810000-0000-4000-8000-0000000000a2/foto/0d810000-0000-4000-8000-0000000000c4"}'::jsonb),
  ('0d810000-0000-4000-8000-0000000000a3', '0d810000-0000-4000-8000-00000000000a',
   '0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-c', 'wedding', 'expired',
   '2026-01-01 00:00:00+00', '{}'::jsonb),
  -- coverPhoto: objek TANPA kunci `path` — inilah yang membuat `coalesce`
  --   ditolak sebagai obat: ia akan jatuh ke `->>'coverPhoto'` dan kembali
  --   menghasilkan teks JSON.
  -- groom.photo: path milik UNDANGAN LAIN (a1), bentuknya sah sempurna.
  -- bride.photo: percobaan traversal.
  -- logo: tipe yang bukan objek maupun string.
  -- story: OBJEK, bukan array — `jsonb_array_elements` padanya melempar dan
  --   menggagalkan SELURUH purge bila penjaga `jsonb_typeof` hilang.
  ('0d810000-0000-4000-8000-0000000000a4', '0d810000-0000-4000-8000-00000000000a',
   '0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-d', 'wedding', 'expired',
   '2026-01-01 00:00:00+00',
   '{"coverPhoto":{"x":0.5,"y":0.5,"zoom":1},
     "groom":{"photo":{"path":"inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c1"}},
     "bride":{"photo":"inv/0d810000-0000-4000-8000-0000000000a4/foto/../../lain"},
     "logo":42,
     "story":{"photo":"inv/0d810000-0000-4000-8000-0000000000a4/foto/0d810000-0000-4000-8000-0000000000c8"}}'::jsonb),
  -- story array berisi: angka, path telanjang SEBAGAI entri (bukan `photo`),
  -- null, `photo` angka, `photo` objek tanpa `path`, dan traversal.
  ('0d810000-0000-4000-8000-0000000000a5', '0d810000-0000-4000-8000-00000000000a',
   '0d810000-0000-4000-8000-0000000000e0', 'pgtap-foto-e', 'wedding', 'expired',
   '2026-01-01 00:00:00+00',
   '{"story":[
       42,
       "inv/0d810000-0000-4000-8000-0000000000a5/foto/0d810000-0000-4000-8000-0000000000c9",
       null,
       {"title":"x","photo":42},
       {"title":"y","photo":{"x":0.5,"y":0.5,"zoom":1}},
       {"title":"z","photo":"inv/0d810000-0000-4000-8000-0000000000a5/foto/../../lain"}
     ]}'::jsonb);

-- `media.storage_path` dibatasi check constraint `media_storage_path_format`
-- ke `inv/<invitation_id>/<id>` barisnya sendiri PERSIS (20261103045611), jadi
-- `id` wajib ditulis. Prefix foto bernama sengaja berbeda
-- (`inv/<uuid>/foto/<uuid>`) dan memang tak pernah masuk tabel ini.
insert into public.media (id, invitation_id, storage_path, width, height) values
  ('0d810000-0000-4000-8000-0000000000f1', '0d810000-0000-4000-8000-0000000000a1', 'inv/0d810000-0000-4000-8000-0000000000a1/0d810000-0000-4000-8000-0000000000f1', 1600, 1200);

create temporary table hasil_a on commit drop as
  select * from public.purge_invitation_data('0d810000-0000-4000-8000-0000000000a1');
create temporary table hasil_b on commit drop as
  select * from public.purge_invitation_data('0d810000-0000-4000-8000-0000000000a2');
create temporary table hasil_c on commit drop as
  select * from public.purge_invitation_data('0d810000-0000-4000-8000-0000000000a3');
create temporary table hasil_d on commit drop as
  select * from public.purge_invitation_data('0d810000-0000-4000-8000-0000000000a4');
create temporary table hasil_e on commit drop as
  select * from public.purge_invitation_data('0d810000-0000-4000-8000-0000000000a5');

-- Assert ----------------------------------------------------------------------
select is((select result from hasil_a), 'purged',
  'undangan wedding berfoto terpurge');

select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c1' = any(media_paths) from hasil_a),
  'foto SAMPUL bentuk OBJEK ikut daftar hapus');
select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c2' = any(media_paths) from hasil_a),
  'foto MEMPELAI PRIA bentuk OBJEK ikut daftar hapus');
select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c3' = any(media_paths) from hasil_a),
  'foto MEMPELAI WANITA bentuk OBJEK ikut daftar hapus');

-- Assert yang langsung membunuh bug aslinya: dengan `->>` pada objek, ketiga
-- entri di atas berisi teks JSON `{"x": 0.5, ...}`, bukan path.
select ok(
  (select not exists (
     select 1 from unnest((select media_paths from hasil_a)) as p
     where p like '%{%' or p like '%"%'
   )),
  'tak ada teks JSON yang lolos sebagai path');

select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/0d810000-0000-4000-8000-0000000000f1' = any(media_paths) from hasil_a),
  'prefix galeri TETAP ikut — regex foto bernama tak boleh membuangnya');

select ok((select 'inv/0d810000-0000-4000-8000-0000000000a2/foto/0d810000-0000-4000-8000-0000000000c4' = any(media_paths) from hasil_b),
  'LOGO bentuk STRING lama ikut daftar hapus');

select is((select result from hasil_c), 'purged',
  'content kosong tetap terpurge tanpa galat');
select is(
  (select coalesce(array_length(media_paths, 1), 0) from hasil_c), 0,
  'content kosong menghasilkan daftar kosong, bukan baris NULL');

select is((select result from hasil_d), 'purged',
  'content rusak tetap terpurge tanpa galat');
select is(
  (select coalesce(array_length(media_paths, 1), 0) from hasil_d), 0,
  'bentuk rusak tersaring seluruhnya, bukan diteruskan sebagai teks JSON');
select ok(
  (select not exists (
     select 1 from unnest((select media_paths from hasil_d)) as p
     where p like '%0000000000a1%'
   )),
  'path milik undangan LAIN tak pernah ikut terhapus');

-- Foto per entri cerita (DECISIONS #127) ----------------------------------------
select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c5' = any(media_paths) from hasil_a),
  'foto CERITA bentuk OBJEK ikut daftar hapus');
select ok((select 'inv/0d810000-0000-4000-8000-0000000000a1/foto/0d810000-0000-4000-8000-0000000000c6' = any(media_paths) from hasil_a),
  'foto CERITA bentuk STRING lama ikut daftar hapus');
select ok(
  (select not exists (
     select 1 from unnest((select media_paths from hasil_a)) as p
     where p like 'inv/0d810000-0000-4000-8000-0000000000a2/%'
   )),
  'foto cerita yang merujuk undangan LAIN tak ikut terhapus');
-- 1 galeri + 3 foto bernama + 2 foto cerita: entri tanpa foto tak menyisipkan
-- NULL, dan c5 yang dirujuk dua entri hanya muncul sekali.
select is(
  (select array_length(media_paths, 1) from hasil_a), 6,
  'daftar A tepat 6 path — tanpa NULL, tanpa duplikat');

select is((select result from hasil_e), 'purged',
  'story berisi elemen rusak tetap terpurge tanpa galat');
select is(
  (select coalesce(array_length(media_paths, 1), 0) from hasil_e), 0,
  'elemen story rusak tersaring seluruhnya');

select * from finish();
rollback;
