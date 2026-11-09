# Pustaka Lagu (musik latar undangan)

Musik latar diputar otomatis saat tamu membuka undangan (dapat dimatikan tamu).
Pemilik undangan **memilih** lagu dari pustaka, yang menjadi bawaan semua paket
dan diisi oleh **admin**. Sejak 9 Nov 2026, undangan **Premium** juga boleh
mengunggah **satu lagu MP3 sendiri** dengan pernyataan hak (DECISIONS #121;
bagian "Musik unggahan klien" di bawah). Pustaka tetap ada, tetap bawaan, dan
tetap hanya berisi trek berlisensi.

## Cara kerja (rantai teknis)

1. **Admin mengunggah** audio di `/admin/lagu` → disimpan via `lib/storage`
   (`songs/<sha256>.<ext>`, content-addressed) → baris di tabel `songs`
   (`title`, `artist`, `storage_path`, `is_active`).
2. **Pemilik memilih** lagu di editor undangan → langkah **Pengaturan** →
   tersimpan sebagai `settings.songId` (autosave).
3. **Halaman publik & pratinjau** me-resolve `songId` → URL domain sendiri via
   `resolveMusic()` (`src/server/invitation-data.ts`) → diputar oleh `cover-gate`.

Lagu yang **dinonaktifkan** admin hilang dari picker & tak diputar. Menghapus
lagu yang sudah dipilih sebuah undangan aman: `resolveMusic` mengembalikan null
(undangan jadi senyap, tidak error).

**Nonaktif ≠ tak tersaji.** Objek `songs/<sha256>.<ext>` tetap bisa diunduh
lewat URL langsung dan di-cache `immutable` setahun di Cloudflare. Trek yang
dilaporkan melanggar hak cipta harus dinonaktifkan, **dihapus** (objek ikut
terhapus bila tak dipakai baris lain), lalu URL-nya di-purge di Cloudflare:
`docs/RUNBOOK.md` → "Lagu pustaka yang dilaporkan".

## Menambah lagu (admin)

1. Masuk sebagai admin → menu **Lagu** (`/admin/lagu`).
2. Isi **Judul** (+ **Artis/kredit** opsional), pilih **berkas audio**, klik
   **Unggah lagu**.
3. Format: `mp3` / `m4a` / `aac` / `ogg` / `opus` / `wav` / `webm`, **maks 8 MB**.
   Untuk WebView WhatsApp, **MP3** paling kompatibel; rekomendasi ~128 kbps mono
   agar ringan (LCP halaman undangan).

## ⚠️ Lisensi — WAJIB dibaca

Hanya unggah audio yang **bebas-royalti / berlisensi** dan boleh Anda pakai untuk
undangan komersial. **Sistem tidak memverifikasi lisensi** — hak pakai tiap trek
adalah tanggung jawab admin (lihat DECISIONS #8 & #18). **Jangan** unggah lagu
populer berhak cipta ke pustaka (risiko takedown/klaim). Pustaka disajikan ke
undangan SEMUA pelanggan atas nama Merriva, jadi standarnya lebih ketat daripada
musik unggahan klien: tidak ada pernyataan pengguna yang menanggungnya.

Sumber instrumental bebas-royalti yang lazim (verifikasi sendiri syarat lisensi
tiap trek sebelum dipakai):

- **Pixabay Music** — https://pixabay.com/music/ (lisensi Pixabay, bebas komersial)
- **Free Music Archive** — https://freemusicarchive.org/ (saring lisensi CC0/CC-BY)
- **Incompetech (Kevin MacLeod)** — https://incompetech.com/ (CC-BY, wajib atribusi → isi kolom **Artis/kredit**)
- **YouTube Audio Library** — https://studio.youtube.com/ (unduh trek "No attribution required")

Untuk trek CC-BY, isi kredit pada field **Artis** agar atribusi tersimpan &
tampil. Simpan bukti lisensi tiap trek di luar aplikasi (mis. catatan ops).

## Musik unggahan klien (Premium) — DECISIONS #121

Aturan lengkap dan kriteria terimanya ada di SPEC §4.4 "Musik unggahan".
Ringkasnya:

- Hanya undangan Premium (draft milik admin/Pro ikut paket teratas). Formatnya
  MP3 saja, berkas ≤ 8 MB, durasi 10 detik–7 menit yang dihitung server.
- Pernyataan hak wajib dicentang di setiap unggahan. Server menyimpan HANYA
  rantai frame audio (tag ID3, sampul, depan & ekor dibuang; isi badan frame
  tidak diperiksa) ke `audio/<id undangan>/<uuid>.mp3` dan mencatat
  unggahannya di tabel `music_uploads`.
- Lagu unggahan menggantikan lagu pustaka **saat diputar**, hanya bila barisnya
  masih hidup di `music_uploads`; pilihan pustaka (`settings.songId`) tidak
  dihapus. Menghapus lagu unggahan, turun paket, takedown, atau rujukan basi
  mengembalikan lagu pustaka. Judul yang tampil ke tamu generik, bukan nama
  berkas.
- Laporan pelanggaran ditangani lewat tombol admin "Hapus musik & kunci
  unggah" di `/admin/undangan/<id>`. Undangannya tetap tayang, dan unggah
  terkunci sampai admin membukanya. Prosedurnya:
  `docs/RUNBOOK.md` bagian "Laporan pelanggaran hak cipta (musik unggahan)".

Rantai teknis pustaka di atas tidak berubah. Musik unggahan dirakit di
`buildInvitationData` menjadi `InvitationData.music {url, title}` yang sama,
jadi `cover-gate` dan tema tidak membedakan keduanya.

## Catatan operasional

- Pustaka **mulai kosong** di production — picker menampilkan "Pustaka lagu belum
  tersedia" sampai admin menambah minimal satu lagu.
- Penyimpanan mengikuti `STORAGE_DRIVER` (supabase | r2). Bucket `media` menerima
  audio (migrasi `20260804190000_widen_media_bucket_audio`, batas 8 MB); untuk R2
  set `NEXT_PUBLIC_MEDIA_URL` = `https://cdn.merriva.id` — **dengan skema**.
  Tanpa `https://`, peramban menyelesaikannya relatif terhadap halaman undangan
  (`https://merriva.id/cdn.merriva.id/...`) dan setiap foto, lagu, serta gambar
  OG menjawab 404. Sejak 17 Okt 2026 `/api/health` menolak bentuk itu
  (`media-url-tak-sah`), tetapi nilainya dipanggang saat BUILD — jadi
  memperbaikinya menuntut bangun ulang image, bukan sekadar restart.
