# MOMEN-SPEC — Album Momen: Kamera Sekali Pakai Digital (Add-on Undangan)

**Versi:** 1.0 — 26 Agustus 2026 · **Status:** disepakati (diskusi 26 Agu 2026), implementasi = PROMPT FASE H (`MOMEN-PROMPT.md`)
**Referensi pasar:** satualbum.id (kamera sekali pakai per-acara, gratis ≤5 tamu, berbayar mulai ±Rp199rb; QR → kamera browser → jatah jepret → foto tersembunyi sampai *reveal*) · kategori global: POV (pov.camera), Lense, Disposable.app — pola yang sama.
**Prototipe UX teruji:** `prototypes/momen-album.html` (buka di HP; mode host lewat tombol ⚙; tombol `</>` menampilkan bentuk data) · **Modul inti teruji:** `handoff/momen/`

---

## 1. Konsep & keputusan produk

Tamu memotret momen acara lewat **kamera di browser** (tanpa install aplikasi): scan QR di meja / tap menu di undangan → tulis nama → dapat **jatah jepretan terbatas** (ala kamera film sekali pakai) dengan **filter film** → foto **tersembunyi sampai waktu reveal** → semua tamu membukanya bersama-sama → album bisa diunduh. Nostalgia "nunggu cuci film" adalah gimmick-nya; kelangkaan jatah membuat tamu memotret dengan niat.

Keputusan (26 Agu 2026):

1. **Posisi: add-on undangan** — bukan produk standalone. Menempel pada undangan aktif; dibeli dari dashboard. Sinergi: tamu sudah memegang link undangan (menu "Momen" muncul di undangan + QR cetak per meja), funnel & pembayaran Pakasir sudah ada. Diferensiasi vs satualbum: mereka jual kamera saja — Merriva menjual **satu QR untuk seluruh acara** (undangan → RSVP → ucapan → momen).
2. **Mekanik penuh**: filter film + jatah per tamu + hidden-until-reveal (paritas satualbum), plus atribusi nama di tiap foto.
3. **Media: foto saja** di versi pertama. Video = biaya storage/transcoding besar → backlog.
4. **Timing**: spec + prototipe + modul inti sekarang; implementasi FASE H setelah Fase G (Fase G terverifikasi selesai per survei kode 26 Agu 2026).

## 2. Alur pengguna

**Tamu:** buka `merriva.id/{slug}/momen` (dari QR meja atau tombol "Album Momen" di undangan) → isi nama (sekali; Turnstile) → layar kamera: live preview + pilih filter + sisa jatah → jepret (atau pilih dari galeri, bila host mengizinkan) → foto dibake filter + dikompres **di HP tamu**, diunggah, lalu berstatus *tersembunyi* → setelah jatah habis: layar "terima kasih" + hitung mundur reveal → saat reveal: galeri terbuka untuk semua, foto ber-atribusi nama, unduh per foto.

**Host (pembeli):** dashboard undangan → beli add-on Momen (Pakasir, alur order yang sama) → atur: jatah/tamu, mode reveal, filter default, izinkan-upload-galeri → unduh/cetak QR (halaman cetak A6 per meja) → selama acara: pantau jumlah foto & **moderasi** (host selalu bisa melihat semua foto sebelum reveal; sembunyikan/hapus yang tak pantas) → setelah reveal: unduh **ZIP** seluruh album.

**Reveal:** disimpan sebagai satu nilai `reveal_at` (NULL = instan). UI host menawarkan 3 mode yang semuanya bermuara ke nilai itu: *Langsung tampil* (NULL) · *Usai acara* (diisi otomatis = akhir hari acara terakhir, 23:59 WIB, bisa digeser) · *Jadwal sendiri* (datetime picker). Host dapat menggeser `reveal_at` kapan pun, termasuk mempercepat ("reveal sekarang").

## 3. Filter film (6 preset — nama sendiri, bukan merek)

satualbum memakai nama stok film asli (Kodak/Fujifilm/Ilford) — itu merek dagang pihak ketiga; Merriva **tidak meniru namanya**, hanya karakter visualnya:

| id | Nama | Karakter (inspirasi) |
|---|---|---|
| `polos` | Polos | tanpa efek (baseline) |
| `hangat` | Hangat | portra-like: hangat, kontras lembut, hitam terangkat, grain halus |
| `vivid` | Vivid | ektar-like: saturasi & kontras berani |
| `pesta` | Pesta | disposable-flash: terang, kontras, vignette kuat, grain kasar |
| `mono` | Mono | HP5-like: hitam-putih kontras, grain jelas |
| `senja` | Senja | cinestill-like: highlight dingin, *halation* merah di area terang, grain |

**Implementasi dua lapis** (kontrak di `handoff/momen/film-presets.ts`): (a) **preview live** = string CSS `filter` di elemen `<video>` + overlay grain/vignette CSS — jalan di semua browser termasuk iOS Safari; (b) **bake saat jepret** = pipeline piksel murni (`film-render.ts`) di atas `ImageData` — **tanpa `ctx.filter`**: per caniuse (diverifikasi 26 Agu 2026) `CanvasRenderingContext2D.filter` masih *disabled by default* di Safari/iOS 18–26.x, jadi pipeline piksel bukan sekadar hati-hati melainkan wajib; matematika per-piksel memberikan hasil identik lintas browser dan teruji unit. Bake terjadi **sebelum** kompresi, di HP tamu, menyatu dengan pola `lib/image/compress.ts` yang ada (server tidak pernah memproses gambar — boundary CLAUDE.md dipertahankan). Bonus privasi: re-encode canvas otomatis membuang EXIF termasuk GPS.

**Format hasil encode — WAJIB fallback JPEG:** `canvas.toBlob('image/webp')` **tidak didukung Safari/iOS sama sekali** (caniuse, s/d 26.x) dan fallback diam-diam browser adalah **PNG lossless raksasa**. Kontrak klien: coba WebP → cek `blob.type` → bila bukan `image/webp`, encode ulang `image/jpeg` q0.82. Server hanya menerima `format ∈ {webp, jpeg}` (skema `momenUploadMetaSchema`); PNG ditolak. ⚠️ Temuan sampingan: `compress.ts` yang ada saat ini TIDAK memeriksa `blob.type` — upload galeri undangan dari iPhone hari ini menyimpan PNG bernama `1600.webp`; perbaiki dengan fallback yang sama di FASE H (lihat MOMEN-PROMPT langkah 0).

## 4. Data model (mengikuti konvensi migrasi repo)

```sql
create table public.momen_albums (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  status text not null default 'active' check (status in ('active','archived')),
  -- Tier dijual per JUMLAH PESERTA (model satualbum), bukan total foto — revisi
  -- 12 Agu (DECISIONS Album Momen). quota_peserta NULL = tak terbatas (tier ∞).
  quota_peserta int check (quota_peserta is null or quota_peserta between 1 and 100000),
  -- Rem darurat storage untuk tier tak-terbatas (tak diiklankan). NULL = tak ada.
  photo_ceiling int check (photo_ceiling is null or photo_ceiling > 0),
  quota_per_guest int not null default 5 check (quota_per_guest between 1 and 20),
  reveal_at timestamptz,                     -- NULL = instan
  default_filter text not null default 'hangat',
  allow_library_upload boolean not null default false,  -- false = hanya kamera
  photo_count int not null default 0,        -- counter total foto (race-safe RPC)
  created_at timestamptz not null default now()
);

create table public.momen_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.momen_albums(id) on delete cascade,
  guest_name text not null,
  device_id uuid not null,                   -- identitas perangkat (localStorage)
  filter_id text not null,
  storage_path text not null,                -- relatif, pola constraint spt media
  thumb_path text not null,
  width int not null, height int not null, bytes int not null,
  status text not null default 'visible' check (status in ('visible','hidden')),  -- hidden = dimoderasi host
  created_at timestamptz not null default now()
);
create index on public.momen_photos (album_id, created_at);
create index on public.momen_photos (album_id, device_id);
```

**RLS & akses** (ikuti preseden `insert_gallery_media_rpc` + `harden_enforce_limit_functions`): tamu anonim TIDAK insert langsung — semua lewat **RPC `security definer`**. Model **confirm-gated** (keputusan FASE H): `momen_claim_upload(...)` memvalidasi album aktif + sesi + **pra-cek** kuota (UX) lalu mengembalikan `photo_id`+path; penegakan OTORITATIF ada di `momen_confirm_photo(...)` yang, di dalam **satu transaksi** ber-`advisory lock` album, mengecek ulang & menyisip baris:
- **kuota per tamu**: `count(*) foto device_id < quota_per_guest`;
- **kuota peserta**: bila device_id BARU (belum punya foto) & `quota_peserta` not null → `count(distinct device_id) < quota_peserta` (peserta = device_id unik yang pernah memotret; `quota_peserta` NULL = ∞);
- **plafon foto** (tier ∞): bila `photo_ceiling` not null → `photo_count < photo_ceiling`.

Upload yang ditolak confirm = objek storage yatim → dibersihkan **langsung di server action** (best-effort `storage.delete` kedua varian), jadi tak ada kebocoran kuota. Sisa yang lolos (proses mati di antara unggah dan pembersihan) **TIDAK** dienumerasi purge harian: tak ada baris DB dan path-nya UUID acak sehingga tak terjangkau — sikap yang sama dengan orphan galeri; membersihkannya butuh scan storage by-prefix, di luar lingkup retensi (lihat `supabase/migrations/20260904120000_purge_momen.sql`). Select publik hanya mengembalikan foto `visible` **dan** hanya bila reveal sudah lewat — gerbang fail-closed `canGuestViewPhotos(resolveAlbumPhase(...))`, SATU-SATUNYA tempat aturan itu tinggal; kedua jalur baca tamu (render awal halaman + aksi "muat lebih") wajib melewatinya. Akses pemilik dipisahkan **secara struktural, bukan lewat flag**: dashboard adalah route terautentikasi yang memverifikasi kepemilikan lalu membaca via service_role TANPA gerbang fase (host memang harus bisa memoderasi pra-reveal), dan boleh update `status`/delete. **Pencabutan akses SADAR-FASE (DECISIONS #33):** bucket media publik + cache 1 tahun, jadi pasca-reveal URL foto sudah tersebar ke setiap tamu — "Sembunyikan" di sana IKUT menghapus objek storage dan mencatat `momen_photos.purged_at` (permanen; "Tampilkan" tak lagi ditawarkan). Pra-reveal objek belum pernah publik → cukup penanda status dan tetap dapat dipulihkan. Baris selalu dipertahankan: moderasi TIDAK mengembalikan jatah jepret tamu maupun slot peserta yang sudah terpakai. **Add-on = baris `packages` ber-`kind='addon_momen'`** (orders.package_id FK tak berubah); aktivasi bercabang di `activate_paid_order` (add-on → buat album, tak sentuh undangan); tier gratis = server action langsung tanpa order/Pakasir.

## 5. Arsitektur & storage

- **Route publik:** `src/app/[slug]/momen/page.tsx` (halaman kamera + galeri; SSR ringan, kamera = client component). QR cetak: `/dashboard/undangan/[id]/momen/qr` (layout A6, `window.print()`).
- **Upload:** klien bake+kompres (2 varian, WebP atau JPEG fallback iOS — §3: display 1600px ~250–450KB, thumb 400px ~25–40KB — reuse util `compress.ts` yang sudah diberi fallback) → minta izin via RPC → unggah ke storage driver aktif (`lib/storage`, path `momen/{album_id}/{photo_id}/display.{webp|jpg}` + thumb, ekstensi & content-type sesuai `format` aktual, immutable) → konfirmasi RPC. Gagal konfirmasi → objek yatim dibersihkan purge harian.
- **Biaya (R2):** 300 foto ≈ 0,12GB ≈ **Rp30/bulan/album**; 1.000 foto ≈ 0,4GB ≈ Rp100/bulan; egress Rp0 (R2+Cloudflare). Supabase free (1GB) hanya muat ±7 album penuh → **jual add-on setelah media pindah R2** (checklist M4 SPEC §12 — prasyarat rilis fitur ini).
- **Unduh:** tamu = per foto (display.webp). Host = **ZIP streaming** route handler (auth pemilik; stream dari storage, jangan buffer penuh di memori VPS).
- **Reveal di klien:** halaman galeri men-cache `reveal_at`; hitung mundur murni klien; sumber kebenaran tetap server (query foto tak akan mengembalikan apa pun sebelum waktunya).

## 6. Anti-abuse, privasi, retensi

Turnstile di form nama (komponen `turnstile-field` yang ada) → server set **cookie sesi ber-tanda-tangan** scoped ke album (berisi `device_id`, nama) — RPC upload menolak tanpa sesi valid. Rate limit upload per device & per album (pola rate limit ucapan). Batas server: bytes display ≤ 1,5MB, thumb ≤ 200KB, dimensi ≤ 2400px, magic bytes cocok dengan `format` yang dideklarasikan (RIFF/WEBP atau JPEG SOI; PNG ditolak — cek header byte, bukan pemrosesan gambar). Jatah per tamu ditegakkan **di server** per `device_id` (klien hanya UX; ganti perangkat = jatah baru — diterima, ini gimmick pesta bukan benteng). Konten: host adalah moderator albumnya (sembunyikan/hapus); tombol "laporkan" tamu = backlog. **Retensi (UU PDP, selaras SPEC §13):** foto momen ikut siklus undangan — purge otomatis yang ada (`data_retention_purge`) diperluas menghapus `momen_*` + objek storage 6 bulan setelah undangan expired; host diberi tahu agar unduh ZIP sebelum itu.

## 7. Paket & harga (proposal — final = keputusan owner)

Add-on per undangan, dibeli dari dashboard. Tier dijual per **jumlah peserta** (tamu yang bergabung), selaras model satualbum — bukan per total foto (revisi 12 Agu, keputusan owner). Tiap tamu ambil hingga `quota_per_guest` foto (default 5, host atur 1–20). Semua tier: semua filter, reveal & moderasi penuh, QR cetak.

| Tier | Maks peserta (`quota_peserta`) | Harga | Aktivasi |
|---|---|---|---|
| Gratis | 5 | **Gratis** | server action langsung (tanpa order/Pakasir) |
| 50 peserta | 50 | Rp199.000 | order Pakasir (webhook 2 lapis) |
| 100 peserta | 100 | Rp349.000 | order Pakasir |
| 200 peserta | 200 | Rp649.000 | order Pakasir |
| Tak terbatas | ∞ (`NULL`) | Rp1.099.000 | order Pakasir |

Tier ∞ punya **plafon foto internal** (`photo_ceiling`, mis. 8.000 ≈ 3GB) sebagai rem darurat storage — tak diiklankan, praktis tak tercapai di acara wajar. Margin tebal (biaya storage < Rp1rb/album 6 bln sampai purge). Tier gratis 5 peserta = paritas satualbum + funnel. Upgrade kapasitas di tengah acara = backlog (§9).

## 8. Definition of Done (FASE H)

Modul `handoff/momen/` dipindah tanpa ditulis ulang, seluruh test tetap hijau + tsc strict · RPC kuota teruji (unit/integrasi: kuota total & per-device tak bisa dilampaui walau request paralel; nilai liar ditolak oleh skema Zod) · foto sebelum reveal tidak bocor lewat API publik (uji langsung query anon) · alur tamu teruji di HP nyata (Android Chrome + iOS Safari + WebView WA): kamera, filter identik dgn preview, upload di jaringan lambat, offline-retry sederhana · moderasi host berfungsi pra-reveal · ZIP host berhasil utk album ≥100 foto tanpa lonjakan memori VPS · Lighthouse halaman momen ≥90 · purge retensi mencakup momen · undangan tanpa add-on: tombol/menu Momen tidak muncul & route mengembalikan halaman "belum aktif".

## 9. Di luar scope versi ini

Video pendek (tier "Momen Video" kelak — butuh batas durasi + kompresi klien MediaRecorder) · slideshow live layar venue (nyambung dgn "layar sapa" Fase 2 — reveal mode `instan` + layar TV) · produk standalone tanpa undangan (arsitektur sudah siap: `momen_albums` berdiri sendiri, hanya aktivasinya yang via undangan) · filter tambahan/frame bertema · cetak foto fisik (partner percetakan) · **upgrade kapasitas tier di tengah acara** ("tambah pax" ala satualbum — beli selisih ke tier lebih tinggi; v1 beli satu tier).
