# Pustaka Lagu (musik latar undangan)

Musik latar diputar otomatis saat tamu membuka undangan (dapat dimatikan tamu).
Pemilik undangan **memilih** lagu dari pustaka; mereka **tidak** mengunggah audio
sendiri. Pustaka diisi oleh **admin**.

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
adalah tanggung jawab admin (lihat DECISIONS #8 & #18; boundary CLAUDE.md
"jangan musik berhak-cipta"). **Jangan** unggah lagu populer berhak cipta
(risiko takedown/klaim).

Sumber instrumental bebas-royalti yang lazim (verifikasi sendiri syarat lisensi
tiap trek sebelum dipakai):

- **Pixabay Music** — https://pixabay.com/music/ (lisensi Pixabay, bebas komersial)
- **Free Music Archive** — https://freemusicarchive.org/ (saring lisensi CC0/CC-BY)
- **Incompetech (Kevin MacLeod)** — https://incompetech.com/ (CC-BY, wajib atribusi → isi kolom **Artis/kredit**)
- **YouTube Audio Library** — https://studio.youtube.com/ (unduh trek "No attribution required")

Untuk trek CC-BY, isi kredit pada field **Artis** agar atribusi tersimpan &
tampil. Simpan bukti lisensi tiap trek di luar aplikasi (mis. catatan ops).

## Catatan operasional

- Pustaka **mulai kosong** di production — picker menampilkan "Pustaka lagu belum
  tersedia" sampai admin menambah minimal satu lagu.
- Penyimpanan mengikuti `STORAGE_DRIVER` (supabase | r2). Bucket `media` menerima
  audio (migrasi `20260804190000_widen_media_bucket_audio`, batas 8 MB); untuk R2
  set `NEXT_PUBLIC_MEDIA_URL` = `cdn.merriva.id`.
