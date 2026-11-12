# SPEC.md — Platform Undangan Digital & Digital Guestbook

**Proyek:** **Merriva** — merriva.id
**Fase:** MVP Fase 1 — Undangan Digital Self-Service
**Versi dokumen:** 1.4 — 30 Juli 2026 *(revisi: sistem desain & motion tema — lihat `docs/THEME-DESIGN.md` dan DECISIONS #10)*
**Dokumen terkait:** `CLAUDE.md` (instruksi agen coding) · `docs/PRD.md` · `docs/ARCHITECTURE.md` · `docs/DATA-MODEL.md` · `docs/ROADMAP.md` · `docs/DECISIONS.md` · `KICKOFF-PROMPT.md`
**Pemilik:** Sailendra Organizer
**Referensi:** `riset-website-undangan-digital-guestbook.md` (riset pasar, 24 Juli 2026)

---

## Keputusan yang Sudah Diambil

| Keputusan | Pilihan |
|---|---|
| Model layanan | **Self-service penuh** — klien daftar, isi data, bayar, undangan aktif otomatis. Admin bisa membuatkan untuk klien EO lewat dashboard yang sama. |
| Pembayaran | **Gateway otomatis via BinderPay** (binderpay.id — API SNAP, QRIS saja; DECISIONS #99, 25 Okt 2026), menggantikan Pakasir (pakasir.com, diputuskan 24 Jul 2026) yang akan tutup. Pakasir tetap jalur bayar sampai peralihan — `BINDERPAY_PARTNER_ID` diisi (DECISIONS #102) |
| Editor | **Form isian terstruktur** per bagian, bukan drag-and-drop |
| Stack | **Next.js + Supabase cloud (supabase.com)**, deploy di **VPS sendiri via Easypanel** (build Dockerfile) |
| Nama & domain | **Merriva — merriva.id** (dikunci 24 Jul 2026) |
| Storage media | **Bertahap:** Supabase Storage free tier (development & klien awal) → `local` disk VPS (jembatan sejak 14 Okt 2026) → **Cloudflare R2** menjelang launch komersial; lihat §6.4 |

---

## 1. Tujuan (Objective)

### 1.1 Visi produk

Platform SaaS "satu QR untuk semua acara": undangan digital → RSVP → check-in di lokasi → kenangan foto/video. Fase 1 membangun fondasinya: **platform undangan digital self-service** yang menghasilkan pendapatan secepat mungkin dan memvalidasi pasar, dengan arsitektur yang siap ditumbuhi buku tamu QR (Fase 2) dan fitur kenangan (Fase 3) tanpa perombakan.

### 1.2 Masalah yang diselesaikan

Klien (pengantin, keluarga, PIC corporate) butuh undangan digital yang cepat jadi, terlihat premium, dan datanya rapi (siapa hadir, berapa pax) — tanpa harus chat bolak-balik dengan penyedia jasa. Pemilik platform butuh sistem yang berjalan otomatis: order masuk → bayar → undangan aktif, tanpa kerja manual per order.

### 1.3 Target pengguna

**Klien (pembeli):** pasangan pengantin (segmen utama, ±80% pasar), keluarga penyelenggara acara (khitanan, ulang tahun, syukuran), dan PIC corporate event (gathering, seminar). Profil: usia 23–40, mengoperasikan semuanya dari HP, terbiasa bayar QRIS.

**Tamu (pengguna akhir):** menerima link via WhatsApp, membuka di WebView WhatsApp/browser HP. Tidak mau install apapun dan tidak mau menunggu loading lama.

**Admin (internal):** tim Sailendra — mengelola tema, paket, order bermasalah, dan membuatkan undangan untuk klien jasa EO.

### 1.4 Metrik sukses MVP

Platform dianggap berhasil bila dalam 60 hari setelah launch: minimal **10 undangan terbayar** (di luar klien EO sendiri), klien bisa menyelesaikan undangan pertamanya dalam **< 30 menit** tanpa bantuan, halaman undangan mencapai **Lighthouse mobile ≥ 90** dan terbuka **< 3 detik di 4G**, serta **nol insiden downtime** pada hari-H event klien.

### 1.5 Non-goals Fase 1 (secara eksplisit TIDAK dikerjakan sekarang)

QR check-in di lokasi & layar sapa (Fase 2) · denah meja, souvenir, doorprize (Fase 2) · upload kenangan foto/video/suara (Fase 3) · program reseller/white-label (Fase 4) · WhatsApp Business API resmi (Fase 4 — MVP pakai generator link `wa.me` gratis) · editor drag-and-drop · custom domain otomatis (bisa dilayani manual bila ada yang minta) · aplikasi mobile native · multi-bahasa (UI Indonesia dulu).

**Prinsip arsitektur untuk masa depan:** meski fiturnya tidak dibangun sekarang, skema data Fase 1 harus tidak menghalangi Fase 2 — karena itu tamu sudah punya `token` unik (kelak jadi QR check-in) dan jadwal acara disimpan ternormalisasi (kelak dipakai check-in per sesi).

---

## 2. Paket & Harga (konfigurasi awal — nilai disimpan di database, mudah diubah)

| | **Basic — Rp99.000** | **Premium — Rp199.000** |
|---|---|---|
| Tema | Tema kategori standar | Semua tema termasuk premium |
| Galeri foto | Maks. 8 foto | Maks. 20 foto |
| Video | — | Unggah klip (≤60 dtk, ≤40 MB, landscape) atau embed YouTube |
| Love story / agenda | ✓ | ✓ |
| RSVP + ucapan & doa | ✓ | ✓ |
| Amplop digital | ✓ | ✓ |
| Daftar tamu + link WA personal | Maks. 500 tamu | Tanpa batas |
| Info live streaming (tautan; di tema Berita boleh tulisan biasa) | — | ✓ |
| Masa aktif | 6 bulan | 12 bulan |
| Watermark footer | Ada (kecil) | Tanpa watermark |

**Penegakan paket (keputusan pemilik 6 Nov 2026, DECISIONS #116):** batas paket ditegakkan saat MENYIMPAN/MENAMBAH (foto, tamu, kustomisasi, unggah video, unggah musik) DAN saat MENAMPILKAN. Halaman tamu & pratinjau hanya menampilkan apa yang dicakup paket yang berlaku sekarang — bila paket undangan lebih rendah dari isinya (refund upgrade, perpanjangan dengan paket lebih rendah, alih kepemilikan, peran Pro dicabut, atau data ditulis di luar aplikasi), font/gaya/aksen kembali ke bawaan tema, galeri menampilkan N foto pertama sesuai batas, video & live streaming tidak tampil, dan musik unggahan tidak diputar (lagu pustaka pilihan pemilik yang diputar). Data TIDAK dihapus: naik paket mengembalikan semuanya. Tema bertier premium wajib paket Premium saat dibayar (§4.8 langkah 0).

**Foto di luar galeri (keputusan pemilik 11 Nov 2026, DECISIONS #127):** batas "Galeri foto" hanya menghitung galeri. Foto sampul, foto mempelai, dan foto per entri cerita (§4.4 "Foto cerita") tidak dihitung dan boleh diunggah di semua paket.

**Musik latar (DECISIONS #121):** semua paket memilih lagu dari pustaka bebas royalti bawaan platform. Undangan **Premium** — dan draft milik admin/Pro, yang memakai paket teratas (§4.8) — juga boleh mengunggah **satu lagu MP3 sendiri** (aturan & kriteria terima: §4.4 "Musik unggahan"). Fitur ini sengaja **tidak** dijadikan baris di tabel di atas maupun di halaman Harga, dan editor tidak memakainya sebagai ajakan membeli: musik milik pihak lain tidak dijadikan nilai jual paket. Undangan yang turun paket tidak memutar musik unggahannya, tetapi rujukan dan berkasnya tetap tersimpan dan diputar lagi saat naik paket. Undangan yang musiknya di-takedown admin kehilangan berkasnya dan tidak bisa mengunggah lagi sampai admin membuka kuncinya.

Posisi harga: di atas pemain perang-harga (Rp39–49rb) karena target kualitas premium, masih jauh di bawah tier Gold–Platinum pasar (Rp150–400rb+). Undangan **gratis dibuat dan di-preview** — pembayaran baru diminta saat klien ingin mengaktifkan/menyebarkan (freemium funnel: rasakan dulu, bayar belakangan). Add-on menyusul setelah launch: perpanjangan masa aktif, custom domain (proses manual), undangan video.

---

## 3. Alur Pengguna (User Flows)

### Flow A — Klien membuat undangan (jalur utama pendapatan)

1. Pengunjung membuka landing page → melihat katalog tema → membuka **demo tema** (undangan contoh berisi data fiktif).
2. Klik "Buat Undangan" → daftar/login (email+password atau Google).
3. Pilih kategori acara (pernikahan / corporate / keluarga) → pilih tema → sistem membuat undangan berstatus `draft`.
4. Mengisi **form multi-step** (lihat §4.4), draft tersimpan otomatis tiap step; tombol preview menampilkan hasil nyata dalam frame HP.
5. Menentukan **slug** (alamat undangan, mis. `merriva.id/rina-dan-bima`) — dicek ketersediaannya real-time.
6. Klik "Aktifkan" (dari kartu dashboard atau bar pratinjau pemilik) → pilih paket → halaman bayar Merriva menampilkan QRIS → klien memindainya dari aplikasi e-wallet/m-banking (jalur lama sampai peralihan: diarahkan ke halaman pembayaran Pakasir → bayar QRIS/VA — §4.8).
7. Callback pembayaran diterima, diverifikasi ulang ke API status gateway → status `active`, email kuitansi + link undangan terkirim; halaman bayar yang masih terbuka mendeteksinya sendiri lewat poll (jalur lama: klien kembali dari Pakasir via `redirect`).
8. Klien masuk menu **Tamu**: menambah/mengimpor daftar tamu → menyalin/mengirim pesan WA personal per tamu.

### Flow B — Tamu menerima & merespons undangan

1. Menerima pesan WA berisi link personal: `merriva.id/rina-dan-bima?g=abc123`.
2. Halaman cover terbuka **di WebView WhatsApp**: "Kepada Yth. **[Nama Tamu]**" + tombol "Buka Undangan" (musik mulai setelah tombol ditekan — kebijakan autoplay browser).
3. Menggulir isi: hero, detail acara + countdown, jadwal + tombol Maps & "Simpan ke Kalender", galeri, love story, amplop digital, ucapan & doa.
4. Mengisi RSVP (nama sudah terisi otomatis dari token): hadir/tidak hadir, jumlah pax (dibatasi alokasi), ucapan → ucapan tampil di dinding doa.
5. (Opsional) Membuka amplop digital → salin nomor rekening → tandai "saya sudah mengirim" (catatan privat untuk pemilik).

### Flow C — Admin

Login sebagai admin → dashboard metrik (undangan baru, konversi bayar, revenue) → kelola order bermasalah (aktivasi manual, perpanjang masa aktif) → kelola katalog tema & paket/harga → buatkan undangan atas nama klien EO (impersonate/assign ke akun klien).

### Edge cases yang harus ditangani

Pembayaran expired/gagal (order bisa dibuat ulang, draft tidak hilang) · klien mengedit undangan setelah aktif (boleh, kecuali slug — ganti slug maks. 1× setelah aktif) · undangan melewati masa aktif (halaman menampilkan pesan "undangan berakhir" + CTA perpanjang, data tidak dihapus hingga 6 bulan setelah expired) · slug bentrok/kata terlarang (blocklist) · dua orang mengedit bersamaan (last-write-wins + peringatan) · tamu membuka link tanpa token `?g=` (tetap bisa lihat & RSVP manual, nama diketik sendiri).

---

## 4. Spesifikasi Fitur & Kriteria Terima

### 4.1 Landing page & katalog tema

Halaman publik berisi value proposition, katalog tema (filter per kategori acara), harga paket, FAQ, dan CTA "Buat Undangan". Setiap tema punya halaman **demo hidup** — undangan sungguhan berisi data fiktif — bukan sekadar screenshot.

**Kriteria terima:** semua tema aktif tampil di katalog dengan preview → demo bisa dibuka tanpa login → Lighthouse mobile landing ≥ 90 → meta SEO lengkap (title, description, OG image) → harga di halaman selalu sinkron dengan tabel `packages` di database.

### 4.2 Autentikasi & akun

Supabase Auth: email+password (dengan verifikasi email) dan Google OAuth. Reset password via email, dan ganti kata sandi dari dalam akun di halaman profil (wajib memasukkan kata sandi saat ini). Setiap field kata sandi punya tombol lihat/sembunyikan (bukan kolom konfirmasi — mayoritas pengguna mendaftar dari HP, tempat mengetik dua kali justru disiasati salin-tempel), dan syarat panjang ditampilkan sebelum submit, bukan sebagai pesan penolakan. Profil minimal: nama, no. WhatsApp. Role: `client` (default), `pro`, dan `admin` — diubah admin dari `/admin/pengguna` (tidak ada pendaftaran mandiri sebagai admin/Pro). **Admin & Pro tidak pernah ditagih** (§4.8).

**Kriteria terima:** register→verifikasi→login berjalan di HP → kata sandi yang diketik bisa diperiksa pengguna sebelum dikirim, dan tombol pemeriksanya tidak ikut mengirim formulir → ganti kata sandi dari dalam akun menolak kata sandi saat ini yang salah, dan gerbang rate limit-nya dievaluasi sebelum verifikasi sehingga form itu tak bisa dipakai menebak kata sandi → halaman atur-ulang kata sandi hanya menerima sesi yang baru lahir dari klik tautan email, sehingga sesi yang sudah lama masuk di sebuah perangkat tidak bisa mengambil alih akun → Google OAuth berjalan → reset password berjalan → user tidak bisa mengakses data user lain (diverifikasi lewat test RLS) → sesi bertahan (refresh token) sehingga klien tidak sering dipaksa login ulang.

### 4.3 Dashboard klien

Daftar undangan milik user dengan status berwarna (`draft` / `pending_payment` / `active` / `expired`) dan aksi lanjutan yang relevan per status (Lanjutkan mengisi / Bayar / Kelola tamu / Perpanjang / **Tema** — ganti tema, §4.4 "Ganti tema" / **Pratinjau** — membuka pratinjau pemilik `/preview/{id}` di semua status, DECISIONS #129). Ringkasan per undangan aktif: jumlah tamu, RSVP hadir/tidak, total pax, jumlah ucapan.

**Kriteria terima:** klien baru diarahkan langsung ke pembuatan undangan pertama → statistik RSVP akurat dan diperbarui saat halaman dimuat → semua halaman dashboard nyaman dipakai di layar 360px → setiap kartu undangan punya tombol Pratinjau yang membuka pratinjau pemilik undangan itu.

### 4.4 Pembuat undangan (form multi-step)

Form terstruktur per bagian; skema field **berbeda per kategori acara** namun disimpan dalam satu struktur `content` (JSONB) dengan validasi Zod per kategori:

| Step | Pernikahan | Corporate | Keluarga |
|---|---|---|---|
| 1. Info dasar | Nama panggilan pasangan, judul, slug, tanggal utama | Nama acara, penyelenggara, slug, tanggal | Nama acara & anak, slug, tanggal |
| 2. Detail pihak | Mempelai pria & wanita + nama orang tua, urutan anak, foto masing-masing | Deskripsi acara, logo perusahaan, kontak PIC | Nama lengkap anak, orang tua |
| 3. Jadwal | Akad, resepsi (multi-sesi) — masing-masing: nama, tanggal-jam mulai/selesai, nama gedung, alamat, link Google Maps | Sesi/rundown (multi) | Sesi acara |
| 4. Galeri & media | Upload foto (limit per paket), video — unggah klip atau embed YouTube (Premium; klip menang bila keduanya diisi), musik latar — pilih dari pustaka, atau unggah satu MP3 sendiri (Premium; lagu unggahan menang saat diputar) | Sama | Sama |
| 5. Cerita | Love story timeline (judul-tanggal-narasi, multi-entri; foto opsional per entri bila tema menampilkannya — "Foto cerita" di bawah; narasi love story opsional — entri tampil bila berjudul, DECISIONS #132) | Agenda/sambutan | Doa/harapan |
| 6. Amplop digital | Multi-rekening (bank, no., a.n.) + e-wallet + alamat kirim kado — toggle on/off | Opsional (mis. donasi) | Sama dengan pernikahan |
| 7. Pengaturan | Ucapan pembuka/penutup, kutipan ayat/quote, toggle tampil/sembunyi per section, moderasi ucapan on/off. Tema diganti lewat tombol "Ganti Tema" (lihat "Ganti tema" di bawah); varian warna, font & urutan bagian lewat "Kustomisasi Tampilan" | Sama | Sama |

Perilaku form: autosave per step (debounce) · indikator step selesai · upload foto dikompres di sisi klien menjadi **2 varian WebP** (thumbnail 400px + display maks 1600px, ±100–200KB) lalu diunggah lewat lapisan `lib/storage/` — bukan langsung ke vendor (lihat §6.4) · musik dipilih dari **library royalty-free bawaan platform** (±20 lagu instrumental, bawaan semua paket); undangan Premium juga boleh mengunggah **satu lagu MP3 sendiri** dengan pernyataan hak — aturannya di "Musik unggahan" di bawah · tombol "Preview" membuka undangan dalam mode draft (hanya bisa diakses pemilik) · **step terakhir ditutup tombol "Selesai"** yang menuntaskan simpanan tertunda lebih dulu lalu membuka pratinjau pemilik; bila simpanan gagal, halaman TIDAK dipindah dan pesan gagal muncul · bar pratinjau pemilik menyediakan jalan lanjut ke aktivasi sesuai status undangan ("Aktifkan"/"Bayar"/"Perpanjang"; tidak ada untuk `active` & `suspended`) — ajakan ini tidak pernah tampil di pratinjau tema publik. · **setiap isian dibatasi di UI persis sebesar batas skema server** (satu sumber angka): isian teks ber-`maxLength` dengan penghitung karakter pada isian panjang, tombol "Tambah" berhenti di batas jumlah entri dan menjelaskan alasannya · bila server tetap menolak (mis. data lama melebihi batas), pesan berbahasa Indonesia tampil DI isian yang bermasalah, langkahnya ditandai di navigasi, dan pesan "Selesai" menyebut nama langkahnya · isi tersimpan yang tak lolos skema draft tetap ditampilkan apa adanya di editor — tidak pernah diganti konten kosong. · **sesi jadwal yang tanggal-jam mulainya belum lengkap tetap tersimpan** dan kembali utuh setelah muat ulang, tetapi TIDAK tampil di undangan, pratinjau, berkas kalender, maupun gambar pratinjau tautan sampai jam mulainya diisi; isian "Mulai" memberi catatan untuk itu · mengosongkan isian "Mulai" pada sesi yang sudah berjam TIDAK menghapus jam tersimpan sampai isiannya lengkap kembali (sesi tak hilang dari undangan aktif saat pemilik mengganti tanggal); untuk membuang sesi, pakai "Hapus" · kartu sesi yang kosong total tidak disimpan · langkah Jadwal bercentang bila ada sesi berjam DAN semua sesi yang berisi sudah berjam · waktu sesi yang sah hanya dalam rentang tahun 1900–9999.

**Kriteria terima:** klien bisa berpindah step tanpa kehilangan isian → mengetik lalu LANGSUNG menekan "Selesai" tetap menyimpan ketikan terakhir sebelum pindah ke pratinjau → refresh browser tidak menghilangkan data → foto 10MB dari kamera HP berhasil terkompres & terunggah di koneksi 4G → limit paket ditegakkan di server (bukan hanya di UI) → undangan `draft` tidak bisa diakses publik → validasi menampilkan pesan error bahasa Indonesia yang jelas per field.

**Musik unggahan (keputusan pemilik 8–9 Nov 2026, DECISIONS #121 — membalik #8).** Pustaka tetap bawaan. Aturannya:
- **Siapa:** hanya undangan berpaket Premium. Gerbangnya `!limits.watermark`, konvensi yang sama dengan live streaming. Draft milik admin/Pro memakai paket teratas (§4.8). Draft pelanggan tetap lantai Basic, jadi bidangnya terkunci dengan kalimat netral tanpa ajakan membeli. Undangan yang turun paket tidak bisa mengunggah dan lagu tersimpannya tidak diputar, tetapi pemilik **tetap bisa menghapus** lagu itu di editor. Server menolak paket yang tidak mencakupnya, dan undangan yang sudah di-purge, **sebelum** membaca isi berkas.
- **Format & batas:** hanya MP3 (MPEG-1/2 Layer III), berkas yang diunggah ≤ 10 MB, durasi 10 detik–7 menit. Durasi **dihitung server** dari rantai frame audio, bukan dari metadata berkas atau angka kiriman peramban (toleransi 1 detik, karena satu frame ≈ 26 ms). Peramban memeriksa hal yang sama lebih dulu hanya supaya pesannya cepat; penegaknya server.
- **Normalisasi:** server menelusuri rantai frame dan **hanya menyimpan byte frame audio**. Semua data **di luar** rantai frame dibuang: tag ID3/APE/Lyrics3 (termasuk gambar sampul dan sisipan apa pun di dalam tag), byte di depan frame pertama, dan ekor sesudah frame terakhir. **Isi badan frame tidak diperiksa** (itu data audio terkompresi), jadi byte sembarang yang diselipkan di sana tetap tersimpan; objek selalu disajikan sebagai `audio/mpeg` + `nosniff`. Berkas yang bukan MP3 atau rantai framenya rusak ditolak. Objek disimpan sebagai `audio/<id undangan>/<uuid>.mp3`, dengan UUID baru di setiap unggahan, lewat `lib/storage/` dan disajikan dari domain sendiri (`/media`).
- **Pernyataan hak:** pemilik wajib mencentang pernyataan di **setiap** unggahan, bukan sekali saat mendaftar. Tanpa centang, tombolnya mati dan server menolak. Server mencatat akun, waktu server, versi teks pernyataan yang dicentang, sidik sha256 byte yang disimpan, ukuran, dan durasi di tabel `music_uploads` (§5). Catatan itu bukti itikad baik dan jejak penanganan klaim, **bukan bukti kriptografis**: yang terbukti hanyalah bahwa server menerima unggahan berpernyataan versi N dari sesi akun itu. Teks pernyataan membatasi tanggung jawab pemilik pada klaim pihak lain yang timbul karena pernyataannya tidak benar, selaras dengan klausul ganti rugi S&K (bukan pengalihan tanggung jawab tanpa batas). Mengubah teksnya wajib menaikkan `CUSTOM_MUSIC_ATTEST_VERSION`.
- **Satu lagu, menggantikan pustaka saat diputar:** rujukan `content.customMusic` (`{path, name?}`) disimpan autosave. Halaman publik dan pratinjau memutarnya menggantikan lagu pustaka hanya bila undangan Premium, tidak terkunci, path-nya objek milik undangan itu, **dan barisnya masih hidup di `music_uploads`** (`removed_at` kosong). Rujukan basi (objek sudah disapu, di-takedown, atau di-purge) kembali ke lagu pustaka. Pilihan pustaka (`settings.songId`) **tidak dihapus**, jadi menghapus lagu unggahan, turun paket, atau takedown mengembalikan lagu pustaka (atau tanpa musik). Kontrak tema tidak berubah: perakit render tetap menghasilkan `InvitationData.music {url, title}`; judul yang sampai ke tamu adalah label generik, **tidak memuat nama berkas** (`name` hanya tampil di editor).
- **Kuota:** maksimal 5 unggahan per undangan per 24 jam, dihitung dari `music_uploads` sehingga bertahan melewati deploy, ditambah rate limit 6/menit per jaringan dan 15/jam per akun. Kuotanya hitung-lalu-sisip tanpa kunci, jadi unggahan serentak bisa **sedikit melampaui** 5; lonjakannya dibatasi rate limit itu, dan objek kelebihan yang tak dirujuk ikut disapu. Ini diterima dengan sadar.
- **Berkas usang:** objek yang tidak lagi dirujuk `content` dan berumur lebih dari 24 jam dihapus oleh langkah penyapu di cron `purge-expired`, yang berjalan tiap 12 jam (`removed_reason = 'replaced'`). Kandidatnya disaring di DB oleh fungsi `music_uploads_usang` (hanya `service_role`). Ini mencakup lagu yang diganti atau dihapus, unggahan yang tidak pernah tersimpan, dan baris hidup milik undangan yang sudah di-purge; semuanya hilang dari storage dalam ±1–1,5 hari. Rujukan yang masih dipakai tidak disapu, termasuk pada undangan yang turun paket, kedaluwarsa, atau terkunci.
- **Takedown admin (laporan hak cipta):** satu tombol di detail undangan admin ("Hapus musik & kunci unggah", dua isian alasan seperti suspend) menghapus **semua** objek musik unggahan undangan itu, membuang `content.customMusic`, mengisi `invitations.music_locked_at`, dan mencatat `admin_logs` beserta sidik setiap berkas dalam satu transaksi, lalu mengirim email ke pemilik berisi alasan publik dan jalur sanggahan. **Undangan tetap tayang.** Kunci berlaku **sampai admin membukanya** (tidak ada batas waktu otomatis; biasanya sesudah sanggahan diterima). Selama terkunci, unggah ditolak, autosave membuang `customMusic` yang ditulis ulang tab editor lama, dan rujukan apa pun tidak diputar; pembukaannya tercatat. Berkas `audio/` disajikan dengan cache maksimal **1 jam** (bukan `immutable` setahun seperti media lain), sehingga berkas yang dihapus berhenti tersaji paling lambat ±1 jam tanpa purge Cloudflare. Prosedur penanganan laporan ada di `docs/RUNBOOK.md`.
- **Retensi:** objek musik ikut terhapus saat purge 6 bulan pasca-expired, purge oleh pemilik, dan hapus akun. Objeknya dipanen dari `music_uploads`, jadi yang belum disapu ikut terhapus. Saat draft dihapus, aksi hapus draft membaca path dari `music_uploads` sebelum DELETE (barisnya hilang lewat cascade) lalu menghapus objeknya; bila DELETE tidak mengenai baris (mis. status draft berubah bersamaan), tak satu objek pun dihapus. Baris `music_uploads` lainnya dipertahankan sebagai catatan tanpa isi berkas (`removed_reason`), dan `user_id`-nya menjadi NULL saat akun dihapus.

**Kriteria terima musik unggahan:** undangan Basic, draft pelanggan, dan undangan yang sudah di-purge ditolak server (bukan hanya di UI) sebelum isi berkas dibaca → berkas bukan MP3, > 10 MB, < 10 detik, atau > 7 menit ditolak dengan pesan bahasa Indonesia di isiannya, dengan durasi dihitung server → berkas tersimpan hanya berisi rantai frame audio (tag ID3, gambar sampul, byte di depan dan ekor tidak ikut) → unggahan tanpa pernyataan ditolak server, dan setiap unggahan sukses punya satu baris `music_uploads` dengan versi pernyataannya → unggahan ke-6 dalam 24 jam pada undangan yang sama ditolak (unggahan berurutan; serentak boleh sedikit lewat, lihat Kuota) → tamu mendengar lagu unggahan setelah menekan "Buka Undangan", dimuat dari `merriva.id/media`, di WebView WhatsApp Android & iOS, dan judul yang dikirim ke halaman tamu tidak memuat nama berkas → undangan yang turun paket atau terkunci, atau yang rujukannya menunjuk baris `music_uploads` yang tidak hidup, tidak memutar lagu unggahan; lagu pustakanya kembali dan datanya tetap → pemilik undangan yang turun paket bisa menghapus lagu tersimpannya → objek yang tak dirujuk lebih dari 24 jam, juga baris hidup milik undangan yang sudah di-purge, terhapus cron → takedown membuat undangan tetap tayang, menghapus objek (juga bila id undangan di URL admin ditulis huruf besar), mengunci unggah sampai admin membukanya, mencatat `admin_logs` secara atomik, dan mengirim email (bila email gagal, admin melihatnya) → objek musik ikut terhapus saat purge, hapus akun, dan hapus draft; hapus draft yang DELETE-nya tidak mengenai baris tidak menghapus objek apa pun → bentuk `InvitationData` tidak berubah (14 tema tak tersentuh).

**Ganti tema (keputusan pemilik 10 Nov 2026, DECISIONS #124).** Pemilik bisa mengganti tema undangannya kapan saja, tanpa batas jumlah, tanpa kehilangan isi:
- **Pintu masuk:** tombol "Ganti Tema" di kepala halaman Edit (sebelah "Kustomisasi Tampilan") dan tombol "Tema" di kartu undangan dashboard → halaman `/dashboard/undangan/{id}/tema`. Tersedia untuk `draft`, `pending_payment`, `active`, dan `expired`; undangan `suspended` atau yang sudah di-purge tidak bisa.
- **Pilihan:** tema aktif di katalog yang mendukung kategori undangan, dengan kartu yang sama seperti saat membuat undangan. Tema yang sedang dipakai ditandai "Dipakai sekarang" (tetap tampil walau sudah dinonaktifkan di katalog).
- **Pratinjau dengan data sendiri:** `/preview/{id}?tema={slug}` merender undangan pemilik (isi, foto, jadwal, musik) dalam tema itu — persis hasilnya bila dipakai, termasuk kustomisasi yang kembali ke bawaan — **tanpa menyimpan apa pun**. Slug yang tidak sah, nonaktif, atau berbeda kategori diabaikan (tema sekarang yang tampil). Tema premium yang terkunci tetap boleh dipratinjau.
- **Menerapkan:** "Pakai Tema Ini" meminta konfirmasi; pada undangan aktif, konfirmasinya menyebut bahwa tamu langsung melihat tema baru. Server menegakkan semuanya ulang (auth → kepemilikan → validasi → status → tema aktif, sekategori, dan kodenya terpasang → aturan paket) dan menulis `theme_id` + `settings` dalam satu UPDATE; DB menegakkan aturan tema sekali lagi (§4.8).
- **Kustomisasi direset:** `settings.custom` (varian warna, pasangan font, aksen, urutan & bagian yang disembunyikan, gaya, motion, grain dari "Kustomisasi Tampilan") dihapus; tema baru tampil dengan bawaannya. Pengaturan lain tetap: toggle section di langkah Pengaturan, lagu, zona waktu, moderasi. Kembali ke tema lama tidak memulihkan kustomisasi lamanya.
- **Tidak ada yang hilang:** isi `content` (termasuk foto bernama beserta titik fokusnya), galeri, jadwal, tamu, RSVP, ucapan, amplop, musik, dan alamat undangan. Foto yang tidak dirender tema baru tetap tersimpan dan tampil lagi di tema yang memakainya.
- **Tema premium:** undangan yang belum pernah dibayar boleh memilihnya (rasakan dulu — saat bayar wajib paket Premium, §4.8). Undangan berpaket tanpa `all_themes` melihat kartu premium terkunci ("Perlu paket Premium") dengan tombol upgrade bila undangannya aktif dan bisa di-upgrade; server dan DB menolaknya juga.
- **Sesudah ganti:** halaman publik `/{slug}` diperbarui saat itu juga (revalidasi ISR), gambar pratinjau tautan ikut versi baru (`updated_at`), lalu pemilik kembali ke halaman Edit.

**Foto cerita (keputusan pemilik 11 Nov 2026, DECISIONS #127):**

- Setiap entri love story boleh punya **satu foto**, diunggah lewat jalur foto mempelai (kompres 2 varian WebP di klien, `lib/storage/`, titik fokus non-destruktif). Foto ini tidak dihitung batas galeri (§2).
- Bidang unggahnya hanya muncul di editor bila tema yang dipakai menampilkan foto cerita (`media.story` di `options.ts`, THEME-CONTRACT §2). Saat ini hanya tema **Berita** (kode `warta`; bernama "Warta" sampai 12 Nov 2026, DECISIONS #136). Foto tetap tersimpan saat ganti tema dan tampil lagi di tema yang memakainya.
- **Tema Berita:** selama belum ada satu pun entri berfoto, foto cerita diambil dari galeri secara berurutan (perilaku sebelumnya). Begitu satu entri diberi foto, hanya foto unggahan yang dipakai dan entri tanpa foto tampil tanpa foto.
- Mengganti foto atau menghapus entri menghapus berkas lamanya. Foto cerita ikut dibersihkan saat draft dihapus, saat purge retensi, dan saat hapus akun.
- Halaman tamu hanya menampilkan foto milik undangan itu sendiri (`inv/<id>/foto/<uuid>`).
- Agenda (korporat) dan doa/harapan (keluarga) tidak punya foto.
- **Narasi love story opsional (DECISIONS #132):** entri tampil bila berjudul — mis. halaman "Lamaran" yang hanya berisi judul, foto, dan keterangan. Isian "Tanggal" menjadi keterangan foto di tema Berita. Agenda dan doa/harapan tetap wajib bernarasi.

**Kriteria terima:** unggah foto di entri cerita → foto tampil di pratinjau & halaman tamu tema Berita dengan titik fokusnya → muat ulang editor, foto tetap ada → hapus entri → berkasnya terhapus → tema tanpa foto cerita tidak menampilkan bidang unggahnya → purge undangan memanen foto cerita (pgTAP).

**Tema Berita (kode `warta`) — Edisi Indonesia & foto berita utama (keputusan pemilik 11 Nov 2026, DECISIONS #130–#131):**

- **Edisi Indonesia** adalah pilihan keempat di tab warna "Kustomisasi Tampilan" tema Berita (di samping Koran, Sepia, Merah), terbuka untuk semua paket seperti varian lain. Ia mengubah sekaligus: semua judul dekoratif menjadi bahasa Indonesia (mis. folio "HALAMAN 2 . BERITA" / "UNDANGAN PERNIKAHAN", "BERITA UTAMA !", "PASANGAN BAHAGIA MENGUNDANG ANDA", "KISAH CINTA KAMI"), latar kertas abu-abu, foto hitam-putih polos tanpa raster titik, kutipan ayat tanpa kotak, font dekoratif bernuansa aksara Jawa (Dhaksinarga, OFL), dan bingkai foto cerita bergantian ±8:9 lalu ±5:7. Pratinjau di editor Tampilan langsung ikut berubah. Varian lain tetap berjudul Inggris (#123).
- **Foto berita utama** — bidang foto khas tema Berita di langkah Galeri: satu foto lebar penuh (3:2) di halaman Berita, di kedua edisi; bisa diganti, digeser, dan diperbesar seperti foto mempelai; tidak dihitung kuota galeri. Tanpa foto, halaman Berita tampil seperti sebelumnya.
- Foto khas tema disimpan di `content.themePhotos` (kunci = id slot `x-…` tema) dan ikut dibersihkan seperti foto bernama lain: saat diganti/dibuang, saat draft dihapus, saat purge retensi, dan saat hapus akun.

**Kriteria terima:** memilih Edisi Indonesia di Tampilan → pratinjau langsung menampilkan judul Indonesia, latar abu-abu, dan foto polos; sesudah Simpan, halaman tamu sama → undangan Basic bisa memilihnya → bingkai foto cerita di editor mengikuti edisi yang tersimpan → unggah foto berita utama → tampil lebar penuh di halaman Berita dengan titik fokusnya → purge undangan memanen foto khas tema (pgTAP) → varian Koran/Sepia/Merah tidak berubah.

**Kriteria terima ganti tema:** pemilik undangan aktif bisa mengganti tema dari Edit maupun dashboard, dan tamu yang membuka `/{slug}` sesudahnya langsung melihat tema baru → pratinjau `?tema=` menampilkan data pemilik dalam tema kandidat tanpa mengubah DB; slug liar diabaikan; bukan pemilik → 404 → hanya tema aktif & sekategori yang ditawarkan, dan server menolak tema nonaktif, berkategori lain, atau tanpa kode walau dikirim langsung → draft pelanggan bisa pindah ke tema premium lalu hanya bisa membayar paket Premium; undangan aktif Basic tidak bisa (kartu terkunci, server & DB menolak dengan pesan bahasa Indonesia); draft dengan order Basic `pending` tidak bisa → sesudah ganti, tampilan kembali ke bawaan tema baru dan "Kustomisasi Tampilan" bisa langsung disimpan; isi, foto, tamu, dan ucapan utuh; ganti balik ke tema lama aman → undangan `suspended` atau sudah di-purge tidak bisa ganti tema → semua nyaman dipakai di layar 360px.

### 4.5 Halaman undangan publik (produk yang dilihat tamu — kualitas tertinggi)

URL `/{slug}` dengan personalisasi `?g={guestToken}` (tamu terdaftar) atau `?to={Nama}` (fallback manual). Struktur: cover fullscreen ("Kepada Yth.") → tombol Buka → hero + countdown → detail jadwal (tombol Google Maps + Simpan ke Kalender .ics/Google + tombol **Tonton Siaran Langsung** bila tautan live streaming diisi — Premium; di tema Berita info live tampil di bawah video halaman "Di Layar", lihat kriteria terima) → galeri → love story → amplop digital (modal: salin nomor, konfirmasi kiriman) → RSVP + dinding ucapan & doa → footer.

Ketentuan teknis: render **SSR + cache ISR** (di-revalidate saat pemilik menyimpan perubahan) · musik play/pause floating button · animasi masuk per section (Framer Motion, hormati `prefers-reduced-motion`) · gambar lewat `next/image` dengan ukuran responsif · **OG image otomatis** per undangan (nama + tanggal di atas foto cover) agar preview link di WA terlihat profesional — disajikan sebagai **JPEG di bawah ±300 KB**, dengan `og:url` kanonik tanpa token tamu dan `og:description` berisi hari, tanggal, dan tempat acara (syarat resmi pratinjau WhatsApp; DECISIONS #119), dari URL berakhiran `.jpg` — **ter-cache CDN secara bawaan, tanpa aturan dasbor** — ber-`?v=` versi simpanan (gambar segar sesudah simpan) dan ber-`Content-Length`; gambar yang lambat memakan jatah tunggu WhatsApp Desktop/Web (7 detik) dan kartu terkirim tanpa gambar (DECISIONS #122) · watermark kecil di footer untuk paket Basic · isi di luar cakupan paket yang berlaku tidak ditampilkan (§2 Penegakan paket).

**Kriteria terima:** terbuka sempurna di WebView WhatsApp Android & iOS (browser paling umum tamu) → LCP < 2,5 dtk pada 4G / Lighthouse mobile ≥ 90 → tamu dengan token melihat namanya & form RSVP terisi otomatis → tanpa token tetap bisa RSVP manual → countdown akurat di timezone acara → tombol salin rekening berfungsi di iOS & Android → undangan `expired` menampilkan halaman "masa aktif berakhir" yang sopan (bukan error) → undangan yang paketnya tak mencakup suatu fitur menampilkan versi paketnya (font/gaya/aksen bawaan, N foto pertama, tanpa video & live streaming, tanpa musik unggahan) tanpa kehilangan data, dan kembali utuh saat naik paket → tautan live streaming Premium tampil sebagai tombol di section acara ke-14 tema selain Berita dan hanya membuka URL https → di tema Berita, info live streaming Premium tampil di bawah video halaman "Di Layar" dengan lencana LIVE yang titiknya berkedip (diam bila `prefers-reduced-motion`): tautan https menjadi tombol **Tonton Siaran Langsung**, isian lain (mis. nama kanal) tampil sebagai tulisan biasa yang tak pernah menjadi tautan; halaman "Di Layar" tetap tampil walau tanpa video bila info live ada, dan ikut tersembunyi bila section Video disembunyikan pemilik (DECISIONS #135).

### 4.6 RSVP, ucapan & amplop

Satu form gabungan: kehadiran (hadir / tidak hadir), jumlah pax (maks. sesuai alokasi tamu; maks. 4 untuk tamu tanpa token — link umum, DECISIONS #120), dan ucapan/doa. Ucapan tampil di dinding (terbaru di atas, paginasi). Pemilik bisa menyembunyikan ucapan tertentu; bila moderasi diaktifkan, ucapan baru tampil setelah disetujui. Konfirmasi amplop (transfer/kado + nominal opsional) bersifat **privat** — hanya terlihat pemilik di dashboard.

**Anti-spam:** Cloudflare Turnstile (invisible) + rate limit per IP + honeypot field. Tanpa CAPTCHA gambar yang mengganggu tamu. Di form RSVP dan konfirmasi amplop, widget memakai `appearance: "interaction-only"`: tak terlihat bagi hampir semua tamu, dan kotak centang hanya muncul bila Cloudflare meminta interaksi (DECISIONS #128). Bila tamu menekan Kirim sebelum verifikasi selesai, form menampilkan "sedang memverifikasi" tanpa mengirim ke server — jatah rate limit tidak terpakai dan tantangan tidak diulang. Form daftar akun, reset sandi, dan Album Momen tetap menampilkan widget.

**Kriteria terima:** RSVP tamu bertoken meng-update statistik dashboard secara akurat (termasuk kiriman ulang = update, bukan duplikat) → tamu tanpa token tidak bisa membanjiri (rate limit terbukti dengan test) → ucapan tersembunyi tidak muncul di publik → data amplop tidak pernah terekspos di API publik → widget Turnstile tidak terlihat di form RSVP & amplop kecuali Cloudflare meminta interaksi.

### 4.7 Manajemen tamu & distribusi WA

CRUD tamu (nama, no. WA opsional, label/grup, alokasi pax, catatan) · **impor dari Excel/CSV** (template disediakan; hasil impor di-preview dulu, baris bermasalah ditandai) · setiap tamu otomatis mendapat `token` unik → link personal.

Distribusi (DECISIONS #120): halaman "Sebar Undangan" berisi dua template pesan yang bisa diedit dan **tersimpan per undangan** — **personal** (`{nama}`, `{link}` personal, `{acara}`, `{tanggal}`) dan **umum tanpa nama tamu** (link polos tanpa token, `{nama}` = nama yang diketik atau "Bapak/Ibu/Saudara/i"). Template bawaan menyebut tanggal acara dan menegaskan undangan berupa halaman web tanpa perlu memasang aplikasi; tidak memakai kalimat "mohon maaf hanya lewat pesan" (pola pancingan penipuan APK). Template wajib memuat `{link}`.
- **"Kirim via WA" untuk SEMUA tamu**: bernomor → `wa.me/{nomor}?text=`; tanpa nomor → `wa.me/?text=` (WhatsApp membuka daftar kontak dengan pesan terisi). Tetap ada **"Salin pesan"** dan "salin semua" (aksi sekunder).
- **Status per tamu** (tertinggi yang tampil): belum dikirim → **terkirim** (ditandai otomatis saat tombol kirim diketuk atau pesan disalin; **bisa dibatalkan**) → **dibuka** (tercatat saat link token pertama kali diakses) → hadir / tidak hadir (RSVP tertaut). Ringkasan progres (terkirim/total · dibuka · RSVP), filter (bawaan "Belum dikirim"), dan pencarian nama/grup.
- **Mode "Kirim satu per satu"**: satu tamu per layar, mengantre semua tamu belum dikirim yang cocok dengan pencarian; setelah membuka WhatsApp pemilik mengonfirmasi "Sudah terkirim?" (ya / belum, kirim ulang / lewati) lalu maju ke tamu berikutnya. WhatsApp tak memberi sinyal terkirim lewat tautan resmi — konfirmasi pemilik adalah satu-satunya sinyal "terkirim"; "dibuka" adalah sinyal objektif.
- **Kartu "Undangan umum"** untuk tamu yang tak ada di daftar: kirim/salin pesan umum, opsional nama (`?to=Nama`); tidak terlacak per tamu, RSVP-nya tanpa token (maks. 4 orang).
- **Kartu pratinjau tautan** (DECISIONS #122): kartu dibuat WhatsApp di perangkat PENGIRIM, dan yang terkirim adalah kartu yang tampil saat Kirim ditekan — kartu sementara "merriva.id" (judul = domain, tanpa gambar) selagi belum siap, dan kartu AKHIR bila Desktop/Web lewat batas tunggunya (7 detik); pesan yang sudah terkirim tak bisa diperbaiki dari server. Karena itu halaman Sebar (a) meminta gambar pratinjau undangan **aktif** sekali saat dibuka — URL sama dengan og:image halaman sesudah simpanan pemilik (editor maupun template Sebar me-revalidate `/{slug}`; pembaruan tanpa revalidate — pengingat cron, ganti pemilik oleh admin — bisa membuat halaman tertinggal satu versi ≤ 1 jam), tanpa cookie, melewati cache peramban — agar sudah ada di cache Cloudflare PoP jaringan yang membuka Sebar sebelum kiriman pertama (HP di jaringan lain bisa MISS di PoP-nya; bila Tiered Cache Smart diaktifkan — disarankan, paket Free — PoP itu mengisi dari PoP hulu, bukan merender di origin), dan (b) menjelaskan: kirim setelah kartu bergambar muncul; kartu "merriva.id" saja = belum siap — di Desktop/Web tunggu hingga ±10 detik (patokan resmi Meta; batas internalnya 7 detik) dengan WhatsApp di HP tersambung; bila tetap "merriva.id", jangan kirim: hapus teksnya lalu kirim ulang dari Sebar; di pemilih kontak (pesan umum & tamu tanpa nomor) satu kontak per kiriman — memilih beberapa sekaligus di Desktop/Web mengirim tanpa kartu. Petunjuk kirim juga tampil di dialog "Kirim satu per satu", yang menutupi daftar dan dapat digulir di layar pendek.

**Kriteria terima:** impor 500 tamu dari Excel < 30 detik dengan laporan baris gagal → link `wa.me` terbuka dengan pesan lengkap & benar di HP, **termasuk untuk tamu tanpa nomor (pemilih kontak WhatsApp)** → tanda terkirim tercatat saat kirim/salin dan bisa dibatalkan → penanda "sudah dibuka" tercatat saat tamu membuka link dan tampil di halaman Sebar → template personal & umum tersimpan dan kembali utuh setelah muat ulang → membuka halaman Sebar undangan aktif membuat gambar pratinjaunya ter-cache CDN (`cf-cache-status: HIT` pada permintaan berikutnya dari jaringan yang sama), dan link yang ditempel di WhatsApp menampilkan kartu bergambar sebelum dikirim → limit 500 tamu (Basic) ditegakkan di server → ekspor daftar tamu + status RSVP ke Excel berfungsi.

### 4.8 Pembayaran (BinderPay — binderpay.id, API SNAP, dok: binderpay.id/docs)

**Gateway & peralihan.** Pakasir akan tutup; jalur uang pindah ke **BinderPay**, kanal **QRIS saja** (keputusan pemilik, DECISIONS #99). `getPaymentGateway()` memilih BinderPay begitu `BINDERPAY_PARTNER_ID` terisi — saklar GLOBAL: penerbitan QR, verifikasi, dan pembatalan semuanya pindah, termasuk untuk order era Pakasir. Sampai itu, termasuk di produksi saat ini, Pakasir tetap jalur bayarnya ("Jalur lama Pakasir" di bawah) dan baru dipensiunkan saat peralihan (DECISIONS #102).

**Metode & biaya (diukur di sandbox BinderPay, 30–31 Okt 2026):** QRIS dinamis; fee 0,7% dari pokok, dibulatkan biasa ke rupiah; **pembayar ditagih pokok + fee**, dan saldo merchant bertambah sebesar pokok. Settlement H+1 hari kerja (per binderpay.id/price). Untuk paket kita (fee diserap — lihat di bawah): Basic Rp99.000 = pokok Rp98.312 + fee Rp688; Premium Rp199.000 = pokok Rp197.617 + fee Rp1.383; semua harga katalog per 31 Okt 2026 pas persis.

**Biaya kanal ditanggung merchant** (keputusan pemilik 31 Okt 2026, DECISIONS #99): pelanggan membayar **persis** harga paket di katalog — tak ada biaya layanan yang ditambahkan, di gateway mana pun. Bila gateway menambahkan fee ke nominal tagihan (BinderPay QRIS: fee 0,7% dibulatkan ke rupiah terdekat), driver menyerapnya dengan mengirim pokok yang dikurangi sehingga pokok + fee = harga; bila tak ada pokok yang pas karena pembulatan, dipilih yang totalnya tidak melebihi harga. `orders.amount_idr` tetap mencatat yang dibayar pelanggan; yang masuk ke saldo adalah pokoknya, jadi omzet yang dihitung dari `amount_idr` melebihkan penerimaan sebesar fee.

**Alur integrasi (QRIS dinamis — QR dirender di halaman kita; BinderPay tak punya halaman bayar hosted):**

0. Gerbang sebelum checkout: undangan harus berstatus dapat-dibayar (`draft`/`pending_payment`/`expired`), sudah punya alamat (bukan slug `draft-…`), **punya minimal satu sesi jadwal yang tanggal-jam mulainya lengkap** (sesi tanpa jam tak pernah tampil ke tamu — §4.4), dan **belum di-purge** — baris ber-`purged_at` (foto/tamu/ucapan sudah dihapus permanen oleh retensi) tak bisa dibayar, supaya klien tak membeli perpanjangan untuk undangan yang isinya sudah tiada.
   - Syarat alamat & jadwal berlaku untuk SEMUA pembayaran: aktivasi pertama, bayar ulang, dan perpanjangan.
   - **Tema bertier premium hanya bisa dibayar dengan paket yang mencakup semua tema** (`limits.all_themes` — Premium). Draft boleh memakai tema apa pun (rasakan dulu) — saat dibuat maupun lewat "Ganti tema" (§4.4); di pemilih paket, paket yang tak mencakup tema itu tampil nonaktif dengan penjelasan, dan server menolaknya juga. DB menolak penggantian tema ke tier premium pada undangan yang SUDAH berpaket tanpa cakupan itu, dan pada undangan `draft`/`pending_payment`/`expired` yang punya order undangan `pending` berpaket tanpa cakupan itu; undangan yang belum pernah dibayar (tanpa paket, status `draft`/`pending_payment`) boleh. Sebaliknya DB juga menolak MEMBUAT order undangan `pending` berpaket tanpa cakupan itu bila tema undangannya premium — atomik terhadap ganti tema, sehingga balapan "checkout membaca tema standar, lalu tema diganti ke premium sebelum order dibuat" tertutup. Aktivasi manual admin tidak memeriksa ini.
   - Halaman aktivasi menampilkan SEMUA syarat yang belum terpenuhi sekaligus, masing-masing dengan tombol ke tempat memperbaikinya; tombol jadwal langsung membuka langkah Jadwal di editor. Pemilih paket baru tampil setelah semua syarat terpenuhi — kecuali bila jadwal tak bisa dibaca: halaman tak mengklaim "jadwal kosong" yang tak bisa dipastikan (syarat alamat tetap tampil), dan server yang menahan.
   - Sesi berisi yang belum berjam TIDAK menahan pembayaran (cukup satu sesi berjam), tetapi halaman aktivasi menyebut namanya karena sesi itu tak akan tampil ke tamu.
   - Server memeriksa syarat yang SAMA (fungsi & query yang sama dengan halaman) dan menolak checkout dengan pesan untuk syarat pertama yang belum terpenuhi bila halaman aktivasi dilewati atau sudah basi (mis. jadwal dikosongkan di tab lain) — halaman lalu dimuat ulang sehingga daftar syaratnya tampil. Server juga menolak (gagal-tertutup) bila jadwal tak bisa dibaca.
   - Aktivasi SESUDAH pembayaran (webhook/poller) dan aktivasi manual admin tidak memeriksa syarat ini — uang yang sudah masuk tak boleh tertahan.
1. Klien pilih paket → server membuat `order` (`pending`, `order_code` unik, `amount_idr` integer = nominal yang dibayar pelanggan).
2. Server menerbitkan QR lewat `POST /v1.0/qr/qr-mpm-generate` — setiap panggilan SNAP ditandatangani RSA-SHA256 dengan kunci privat kita (hanya di server) — dengan `partnerReferenceNo` = `order_code`, nominal = pokok hasil penyerapan fee, dan masa berlaku **23 jam**: satu jam lebih pendek dari umur order `pending`, supaya QR habis berlaku sebelum cron menutup ordernya. Respons yang tagihannya melebihi `amount_idr` ditolak — checkout gagal, pelanggan tak ditagih lebih. `additionalInfo.contractId` disimpan sebagai `orders.txn_id` dan string QR sebagai `orders.qr_content` dalam SATU update, SEBELUM klien diarahkan ke halaman bayar KITA (`/dashboard/undangan/[id]/bayar`; upgrade & Album Momen: halaman masing-masing). Halaman itu merender QR sebagai gambar dari server (bukan `qrUrl` di domain vendor) beserta batas berlakunya dan tombol "Simpan gambar QR" untuk yang membayar dari HP yang sama. QR satu order tak pernah diterbitkan ulang: BinderPay menolak `partnerReferenceNo` yang sama (HTTP 500 `5004700`).
3. BinderPay mengirim **callback POST** ke `https://merriva.id/api/webhooks/binderpay` (URL Callback yang didaftarkan di proyek BinderPay). Payload menurut dokumentasi — bentuk nyatanya belum terukur: `{originalReferenceNo, originalPartnerReferenceNo, latestTransactionStatus, amount, feeAmount, additionalInfo: {channel, contractId, brandName, rrn, buyerRef, nmid, terminalId}}`. Order dicari lewat `originalPartnerReferenceNo`; nominal di callback tidak dipakai. Yang disimpan ke `raw_notification` hanya daftar putih field rekonsiliasi — `buyerRef` (nama pembayar dari penerbit) dibuang.
4. **PENTING — payload callback adalah SINYAL, bukan bukti.** Verifikasi wajib dua lapis: (a) autentikasi pemanggil lewat tanda tangan RSA-SHA256 (header `X-SIGNATURE` + `X-TIMESTAMP`) atas `POST:/v1.0/qr/qr-mpm-notify:{sha256hex(bodi mentah)}:{timestamp}`, diverifikasi dengan kunci publik BinderPay — path yang ditandatangani adalah path SNAP TETAP itu, bukan path URL callback kita; (b) panggil `POST /v1.0/qr/qr-mpm-query` dengan PASANGAN `order_code` + `txn_id` (`contractId`) dari BARIS ORDER kita dan **hanya aktifkan bila status `00` (lunas)** DAN nominalnya cocok dengan order.

   Lapis (a): tanda tangan tak sah atau stempel waktu di luar ±5 menit → 401 SEBELUM menyentuh DB; `X-PARTNER-ID` yang ada tetapi berbeda → dilaporkan, tetap diproses (header itu belum terukur; query yang memutuskan); kunci publik yang belum diisi tidak menolak (dilaporkan) — seperti `X-Secret` Pakasir, lapis ini ADITIF, bukan bukti lunas. Lapis (b): rujukan diambil dari baris order, bukan dari isi callback, karena query menggemakan rujukan apa pun yang dikirim — gema bukan bukti identitas. Query melaporkan POKOK; pokok diterjemahkan ke `amount_idr` hanya bila persis pokok yang kita kirim untuk nominal itu, jadi gerbang nominal tetap kesetaraan ketat.
5. Order `paid` → undangan `active`, `active_until` dihitung → email kuitansi.

Halaman bayar (juga halaman upgrade & Album Momen) mem-poll inti verifikasi yang sama — untuk pembayaran yang callback-nya belum tiba; QR tetap tampil setelah poller berhenti, selama masih berlaku. Order `pending` > 24 jam yang dipastikan belum lunas di-expire oleh cron, lalu transaksinya dibatalkan lewat `POST /v1.0/qr/qr-mpm-cancel`: QR yang lewat masa berlaku tetap berstatus `01` (Initiated) di BinderPay, jadi pembatalan inilah yang menutupnya secara eksplisit. Pembatalan atas transaksi yang ternyata sudah dibayar dijawab 409 dan dilaporkan (`payment.cancel`) untuk ditangani manual. Testing memakai **Payment Simulator** di dashboard sandbox BinderPay; host sandbox ditolak bila `NODE_ENV=production`.

**Jalur lama Pakasir (sampai peralihan — DECISIONS #102).** Selama `BINDERPAY_PARTNER_ID` kosong, langkah 2–4 berjalan lewat Pakasir **API v2** (v1 dihentikan 20 Okt 2026, DECISIONS #72): server membuat transaksi lewat `POST /api/v2/create-transaction/{slug}/{order_id}` (find-or-create berkunci `order_id`), menyimpan `txn_id`-nya, lalu mengarahkan klien ke halaman bayar hosted Pakasir (QRIS & VA) dengan `redirect` kembali ke halaman bayar kita. Webhook `POST /api/webhooks/pakasir` diautentikasi header **`X-Secret`** (`PAKASIR_WEBHOOK_SECRET`) dan dicocokkan `order_id` + `amount` dengan order, lalu diverifikasi lewat `GET /api/v2/transaction-status/{slug}/{txn_id}` (header `X-Api-Key`) — status v2 berkunci `txn_id`, bukan `order_id`. Cron membatalkan lewat `cancel-transaction` v2; testing memakai `POST /api/paymentsimulation`.

**Refund (AUDIT-2026-10-01 A3).** Admin dapat menandai order lunas sebagai `refunded` dari `/admin/order` dengan alasan wajib; tindakan itu mencabut layanan yang dibeli — undangan menjadi `expired` bila tak ada order lunas lain yang menopangnya, dan order add-on mengarsipkan Album Momen tanpa menyentuh undangan. Pengembalian UANG tetap dilakukan manual di dashboard gateway — BinderPay, atau Pakasir untuk order yang dibayar lewat Pakasir — dan UI menyatakannya eksplisit. Checkout undangan memakai ulang order `pending` TERBARU bila paketnya sama alih-alih membuat order kedua (hanya yang terbaru, karena itulah yang ditampilkan halaman bayar) — di BinderPay langsung ke halaman bayar dengan QR tersimpannya, tanpa memanggil gateway lagi (QR kedua untuk nomor order yang sama ditolak); order yang QR-nya sudah habis berlaku atau yang tanpa `txn_id` tidak dipakai ulang, dan cron menutupnya (DECISIONS #101).

**Riwayat pesanan & saluran dukungan (AUDIT-2026-10-01 A4/A5).** Dashboard klien punya halaman `/dashboard/pesanan`: seluruh order milik pemilik (aktivasi, perpanjangan, add-on Album Momen) dengan kode order, status, nominal, metode pembayaran, waktu dibuat & dibayar, dan undangan terkait — terbaru dulu, berhalaman. Order lunas yang undangannya belum aktif ditandai khusus beserta jalan menghubungi tim. Setiap order lunas punya halaman kuitansi permanen `/dashboard/pesanan/[kode]` yang bisa dicetak/disimpan PDF: nomor kuitansi, penerbit beserta alamat kontaknya, status, paket, masa aktif dibeli, total, metode & waktu pembayaran, undangan terkait, dan nama + email pembeli. Kode order milik pelanggan lain dijawab identik dengan kode yang tak ada. Kontak dukungan (alamat email, satu sumber di `copy.support`) wajib tampil di: footer dashboard, kartu status pembayaran `review`/`timeout`/`error` pada kedua jalur (undangan & Album Momen), dan boundary galat dashboard. Setiap tautan kontak membawa kode order ke `subject`/`body` mailto, karena layar galat tidak selalu menampilkan kodenya.

**Kriteria terima:** pembayaran simulasi end-to-end berhasil untuk QRIS lewat Payment Simulator sandbox BinderPay (kanal QRIS saja — keputusan pemilik, DECISIONS #99) → nominal yang ditagihkan ke pelanggan tidak pernah melebihi harga paket di katalog (biaya kanal ditanggung merchant) → callback palsu (tanda tangan tak sah / order tidak ada / amount tidak cocok / `qr-mpm-query` tidak mengonfirmasi) **tidak** mengaktifkan undangan → notifikasi duplikat tidak menggandakan aktivasi (idempotent) → order `pending` kedaluwarsa otomatis dalam 24 jam dan transaksinya dibatalkan ke gateway (`qr-mpm-cancel`) → semua nominal dicatat dalam IDR integer (tanpa float) → kunci privat BinderPay (dan `api_key` Pakasir) tidak pernah terkirim ke browser → admin bisa melihat raw notification untuk rekonsiliasi → undangan tanpa alamat atau tanpa satu pun sesi berjam tidak bisa memulai pembayaran, dan halaman aktivasi menyebut semua syarat yang kurang beserta jalan memperbaikinya → riwayat pesanan menampilkan **seluruh** order pemilik (bukan hanya yang terakhir) dan tidak pernah membocorkan kolom `raw_notification` → saat DB gagal, riwayat menampilkan galat, **bukan** "belum ada pesanan" → dari setiap layar pembayaran yang tertahan, pelanggan bisa mencapai alamat dukungan tanpa meninggalkan produk → kuitansi pesanan yang belum lunas tidak pernah mengaku sebagai bukti pembayaran, dan galat DB tidak pernah menyamar jadi "kuitansi tidak ditemukan".

**Upgrade paket di tengah masa aktif (AUDIT-2026-10-01 B3).** Pemilik undangan `active` dapat pindah ke paket yang lebih mahal dengan membayar **selisih harga**, bukan harga penuh. Masa aktif TIDAK di-reset: `active_until`, `published_at`, dan `status` tidak disentuh — hanya `package_id` yang ditukar, sehingga batas paket (foto, tamu, watermark, tema premium) langsung naik untuk sisa masa aktif yang sama. Kredit selisih dihitung dari harga KATALOG paket yang sedang dipakai — satu sumber dengan angka yang ditampilkan di halaman upgrade. Syarat: status `active`, belum di-purge, `package_id` terisi, dan ada paket undangan aktif yang lebih mahal; selisih wajib > 0 sehingga downgrade dan paket yang sama ditolak sebelum order dibuat. Order upgrade ditandai `orders.purpose = 'upgrade'` dan memakai ulang alur gateway + webhook dua lapis yang sudah ada (QR tampil di halaman upgrade) — **tak ada alur bayar kedua**. Karena undangan pembeli upgrade SELALU `active`, poll status pembayaran undangan tak bisa merekonsiliasinya (ia berhenti di `active` lebih dulu); upgrade punya poll sendiri dengan inti verifikasi yang sama, sejalan dengan add-on Album Momen. Halaman upgrade menyebut tanggal berakhirnya masa aktif beserta sisa harinya secara eksplisit, karena yang dibeli adalah peningkatan untuk sisa masa itu — bukan periode baru. Refund order upgrade menurunkan `package_id` kembali ke paket order lunas sebelumnya tanpa mencabut masa aktif undangan.

**Kriteria terima:** order upgrade lunas menukar paket TANPA mengubah `active_until`, `published_at`, atau `status` → selisih ≤ 0 (paket sama, downgrade, atau harga katalog berubah) ditolak sebelum order dibuat → order `pending` aktivasi dan order `pending` upgrade tidak pernah dipakai-ulang silang, sehingga pelanggan tak pernah ditagih nominal jalur yang lain → order upgrade tidak pernah mengaku membeli masa aktif di kuitansi maupun riwayat pesanan → pemilik yang membayar QR di halaman upgrade (jalur lama: yang kembali dari Pakasir) melihat upgrade-nya direkonsiliasi tanpa menunggu webhook → refund order upgrade menurunkan paket kembali tanpa mematikan undangan yang masa aktifnya dibayar order lain.

**Akun Admin & Pro tidak pernah ditagih (DECISIONS #100).** Untuk undangan MILIKNYA SENDIRI, aktivasi, perpanjangan, upgrade, dan add-on Album Momen langsung aktif tanpa gateway pembayaran: halaman menawarkan satu tombol "Aktifkan gratis" dengan paket/tier teratas. Server mencatatnya sebagai order Rp0 bermetode `gratis` lewat RPC `activate_free_order` — satu transaksi bersama `activate_paid_order`, sehingga hasilnya identik dengan aktivasi berbayar dan tercatat di riwayat pesanan tanpa menambah omzet. Syarat alamat & jadwal (langkah 0) tetap berlaku. Undangan milik orang lain tetap lewat jalur bayar biasa walau dibuka admin; menggratiskan undangan pelanggan memakai aktivasi manual di panel admin yang ter-audit. **Selama masih draft**, undangan milik admin/Pro sudah memakai batas paket teratas itu — palet & font Premium di Kustomisasi Tampilan, kuota galeri & tamu, video, tanpa watermark pratinjau — karena itulah paket yang akan didapat gratis saat diaktifkan (DECISIONS #115). Yang menentukan adalah peran PEMILIK undangan: draft pelanggan yang dibuka admin tetap lantai Basic. Draft yang dibuat admin untuk klien jasa EO ikut memakai batas teratas; begitu dialihkan ke pelanggan, yang tampil mengikuti paket pelanggan (§2 Penegakan paket) — fitur di luar paketnya tersembunyi, tidak dihapus.

**Kriteria terima:** admin/Pro pemilik tidak pernah melewati gateway pembayaran — tak ada QR maupun link bayar yang diterbitkan — di keempat jalur → admin yang membuka undangan pelanggan tetap melihat jalur bayar → draft milik admin/Pro membuka fitur paket teratas sebelum diaktifkan (Tampilan, galeri, tamu, video), sedangkan draft pelanggan yang dibuka admin tetap Basic (test DB) → aktivasi gratis yang gagal tidak meninggalkan order apa pun → klien tidak bisa memberi dirinya peran Pro/admin (test DB).

**Dokumen legal (AUDIT-2026-10-01 A2).** Tiga halaman publik: `/syarat` (Syarat & Ketentuan), `/privasi`, `/refund`. Identitas pelaku usaha berasal dari SATU sumber (`copy.marketing.legal.merchant`) dan dirender di ketiganya; hanya field terisi yang tampil. Baris notis persetujuan — menautkan S&K + Privasi di `/daftar`, dan S&K + Refund tepat di atas tombol bayar — bukan checkbox, karena dasar pemrosesannya perjanjian. `/syarat` juga memuat bagian **"Laporan pelanggaran hak cipta"** (cara melapor ke alamat dukungan, isi laporan, tenggat tindak, sanggahan, pelanggar berulang), yang menjadi sarana pelaporan publik untuk musik unggahan (DECISIONS #121). **Kriteria terima:** setiap klausul S&K cocok dengan perilaku kode (retensi, penangguhan, batas paket, takedown musik unggahan); identitas penjual tampil sebelum pembayaran.

### 4.9 Panel admin

**Hapus akun (AUDIT-2026-10-01 A6).** Admin dapat menghapus akun permanen dari `/admin/pengguna` (alasan wajib + email akun diketik ulang dan dicocokkan di server). Data pribadi tiap undangan di-purge berikut objek storage-nya; baris `orders` dan kerangka `invitations` DIPERTAHANKAN dengan `user_id` NULL untuk kewajiban pembukuan. Akun yang masih punya undangan `active` DITOLAK. Prosedurnya di `docs/RUNBOOK.md`.

Ringkasan metrik (undangan/hari, konversi draft→paid, revenue bulan berjalan) · daftar & pencarian semua user/undangan/order · ubah peran pengguna (klien / Pro / admin — Pro tak pernah ditagih, §4.8) · aksi: aktivasi manual (mis. bayar di luar sistem), perpanjang masa aktif, suspend undangan (konten bermasalah — **dua isian alasan: catatan internal untuk audit log, dan alasan untuk pelanggan yang dikirim lewat email beserta jalur banding**), hapus musik unggahan & kunci unggah (laporan hak cipta — undangan tetap tayang; dua isian alasan yang sama; buka kunci tercatat; §4.4 "Musik unggahan", prosedur di `docs/RUNBOOK.md`), ganti kepemilikan (untuk klien jasa EO) · CRUD paket & harga · CRUD metadata tema (kode tema tetap di repo; admin mengatur nama, kategori, status aktif, tier) · log aktivitas admin.

**Kriteria terima:** role `client` tidak bisa membuka satu pun route/API admin (test RLS + middleware) → aktivasi manual menghasilkan status yang identik dengan aktivasi via pembayaran → perubahan harga langsung tercermin di landing & checkout tanpa deploy.

### 4.10 Email transaksional

Via Resend (atau SMTP VPS sebagai fallback): verifikasi akun, kuitansi pembayaran + link undangan aktif, pengingat masa aktif (H-14 sebelum expired), notifikasi RSVP mingguan opsional. Template email sederhana, brand-konsisten, teks Indonesia.

**Kriteria terima:** semua email terkirim < 1 menit setelah trigger → tautan di email benar → unsubscribe tersedia untuk email non-transaksional.

### 4.11 Album Momen (add-on berbayar — FASE H)

Kamera sekali-pakai berbasis browser untuk tamu di lokasi acara. Tamu memindai **QR yang dicetak dan dipajang di venue** — pintu masuk utama; halaman undangan TIDAK menampilkan tombol Album Momen (keputusan pemilik 10 Nov 2026, DECISIONS #125) → memasukkan nama (Turnstile) → memotret dengan jatah jepretan terbatas + 6 filter film → foto **tersembunyi sampai waktu reveal**, lalu terbuka serentak sebagai galeri bersama. Host memoderasi (sembunyikan/hapus), mencetak QR meja A6, dan mengunduh album sebagai ZIP.

**Dijual per JUMLAH PESERTA** (peserta = `device_id` unik yang pernah memotret), bukan per foto: `momen_5` gratis · `momen_50` Rp199.000 · `momen_100` Rp349.000 · `momen_200` Rp649.000 · `momen_unlimited` Rp1.099.000 (ber-`photo_ceiling` 8.000 sebagai rem biaya storage). Admin & Pro mendapat tier teratas tanpa bayar untuk undangan miliknya (§4.8). Add-on dibeli untuk undangan yang **sudah aktif** dan TIDAK mengubah status/masa-aktif undangan; album mengikuti retensi undangan induknya, bukan `duration_months` paket. Upgrade tier belum tersedia.

Pemrosesan gambar **hanya di browser** (bake filter piksel + encode 2 varian WebP, fallback JPEG untuk iOS) — server memvalidasi tipe/ukuran/magic-byte lalu menyimpan via `lib/storage/`. Jalur uang memakai-ulang alur order + gateway (§4.8 — QR tampil di halaman kelola Album Momen) + webhook yang sudah ada; **tak ada alur bayar kedua**.

**Kriteria terima:** tamu tanpa aplikasi bisa memotret dari WebView WhatsApp → foto tak pernah terpancar sebelum reveal (fail-closed, diperiksa ulang di setiap jalur baca publik) → kuota peserta & jatah per tamu tak bisa ditembus oleh unggahan paralel (gerbang atomik advisory-lock) → aktivasi add-on hanya terjadi setelah verifikasi status yang OTORITATIF ke gateway (`qr-mpm-query`; jalur lama: `transaction-status` Pakasir v2) → menyembunyikan foto menghilangkannya dari galeri tamu → ZIP berisi seluruh foto album → album & objeknya ikut terhapus saat undangan di-purge.

**Detail lengkap:** `docs/MOMEN-SPEC.md`.

---

## 5. Model Data (PostgreSQL / Supabase)

```
profiles          id (=auth.users.id), full_name, phone, role('client'|'pro'|'admin'), created_at
themes            id, slug, name, categories[], tier('standard'|'premium'), preview_image,
                  demo_slug, is_active, sort_order
packages          id, code('basic'|'premium'), name, price_idr int, duration_months,
                  limits jsonb {max_photos, max_guests, youtube (= fitur video: unggah & YouTube), all_themes, watermark},
                  is_active
invitations       id, user_id→profiles, theme_id→themes, package_id→packages (nullable),
                  slug unique, category('wedding'|'corporate'|'family'),
                  status('draft'|'pending_payment'|'active'|'expired'|'suspended'),
                  content jsonb, settings jsonb, event_date date,
                  active_until timestamptz, published_at, created_at, updated_at,
                  music_locked_at timestamptz   -- kunci unggah musik sesudah takedown
                                                   admin; hanya admin yang mengosongkan
                  -- content.customMusic = {path, name?}: rujukan lagu MP3 unggahan
                     (Premium, DECISIONS #121); tanpa klaim durasi/pernyataan
invitation_events id, invitation_id, name, start_at (null = sesi draft belum berjam,
                  tak pernah tampil publik), end_at, venue_name, address,
                  maps_url, sort_order            -- ternormalisasi: dipakai check-in Fase 2
                                                     (target check-in hanya sesi berjam;
                                                     id stabil lintas simpan — DECISIONS #43)
media             id, invitation_id, type('photo'), storage_path, width, height, sort_order
guests            id, invitation_id, name, phone, group_label, pax_allocated int,
                  token unique, wa_clicked_at, first_viewed_at, notes, created_at
rsvps             id, invitation_id, guest_id (nullable), guest_name,
                  attendance('yes'|'no'), pax int, message text, is_hidden bool,
                  is_approved bool, created_at, updated_at
                  -- unik per (invitation_id, guest_id) utk tamu bertoken → kiriman ulang = update
gift_notes        id, invitation_id, guest_name, type('transfer'|'gift'), amount (nullable),
                  note, created_at                -- privat, tidak pernah di-serve ke publik
orders            id, user_id, invitation_id, package_id, amount_idr int,
                  status('pending'|'paid'|'expired'|'failed'|'refunded'),
                  order_code unique,   -- dikirim ke gateway: partnerReferenceNo BinderPay /
                                          order_id Pakasir (mis. MRV-8F3K2)
                  txn_id text,         -- rujukan transaksi gateway, unik bila terisi; kunci cek
                                          status: contractId BinderPay / txn_id Pakasir v2
                  qr_content text,     -- string QRIS BinderPay (NULL utk Pakasir) — satu-satunya
                                          salinan: QR order tak bisa diterbitkan ulang
                  payment_method, paid_at, raw_notification jsonb, created_at
admin_logs        id, admin_id, action, target_type, target_id, detail jsonb, created_at
songs             id, title, artist, storage_path, is_active   -- library musik royalty-free
music_uploads     id, invitation_id→invitations (cascade), user_id→profiles (set null),
                  path unique ('audio/<invitation_id>/<uuid>.mp3'), sha256, bytes,
                  duration_ms, attest_version, created_at,
                  removed_at, removed_reason('replaced'|'purge'|'takedown')
                  -- catatan setiap unggahan musik klien (DECISIONS #121): kuota,
                     gerbang render (baris hidup), penyapu (fungsi
                     music_uploads_usang), purge, takedown, versi pernyataan hak.
                     HANYA service_role

-- Album Momen (add-on, FASE H — detail: docs/MOMEN-SPEC.md)
momen_albums      id, invitation_id→invitations UNIQUE, status('active'|'archived'),
                  quota_peserta int (NULL=∞), photo_ceiling int (NULL=tanpa plafon),
                  quota_per_guest int 1..20, reveal_at timestamptz (NULL=instan),
                  default_filter, allow_library_upload bool, photo_count int, created_at
momen_photos      id, album_id→momen_albums, guest_name, device_id uuid, filter_id,
                  storage_path, thumb_path, width, height, bytes,
                  status('visible'|'hidden'), created_at
                  -- PRIVAT pra-reveal; device_id = identitas peserta (unit yang dijual)
```

`packages` memperoleh kolom `kind('invitation'|'addon_momen')` — add-on adalah baris `packages` biasa sehingga `orders.package_id` tidak berubah bentuk.

**Row Level Security (wajib aktif di semua tabel):** klien hanya membaca/menulis baris miliknya; halaman undangan publik dilayani dari server (service role) dengan penyaringan eksplisit — data yang boleh publik hanya: `content`, `settings`, `events`, `media`, ucapan yang tidak disembunyikan; `guests`, `gift_notes`, `orders` **tidak pernah** dikirim ke klien publik. Insert `rsvps` publik lewat server action dengan Turnstile + rate limit, tidak langsung dari browser ke Supabase. `momen_albums`/`momen_photos` mengikuti pola yang sama namun lebih ketat: **anon tanpa policy sama sekali** (fail-closed) — seluruh baca/tulis tamu lewat server action service_role yang memverifikasi sesi HMAC + fase reveal terlebih dahulu. `music_uploads` juga **tanpa policy** dan hanya bisa disentuh `service_role` (SELECT/INSERT/UPDATE, tanpa DELETE). Pemilik undangan pun tidak bisa membaca atau menulis catatan unggahnya sendiri, dan justru karena itu catatannya bisa dipercaya. `invitations.music_locked_at` tidak termasuk allowlist kolom yang boleh di-UPDATE pemilik.

---

## 6. Arsitektur & Deployment

### 6.1 Gambaran

```
[Tamu & Klien (HP)] ──HTTPS──> [Cloudflare (proxy/CDN, gratis)]
                                    │
                          [VPS + Easypanel (Traefik, SSL otomatis)]
                                    │  container Docker
                              [Next.js app (standalone)]
                                    │
        ┌───────────────┬───────────┴──────────┬────────────────┐
   [Supabase cloud]  [BinderPay]          [Resend email]   [Turnstile]
   Postgres+RLS,     QRIS SNAP
   Auth, Storage     + callback
                     (Pakasir sampai peralihan)
```

Halaman undangan publik dilayani dengan **ISR** (cache di server, di-revalidate saat pemilik menyimpan) sehingga beban hari-H — ratusan tamu membuka bersamaan — dilayani dari cache, bukan query database per kunjungan. **Galat database tidak pernah di-cache sebagai isi undangan** (DECISIONS #45): bila salah satu bacaan gagal, render itu digugurkan — bukan disimpan sebagai undangan tanpa jadwal, galeri kosong, watermark di undangan Premium, atau 404.
  - Saat cache kedaluwarsa karena waktu, tamu tetap melihat versi terakhir yang baik.
  - Segera setelah pemilik menyimpan (cache ditandai kedaluwarsa), render berikutnya tak punya versi untuk disajikan: tamu mendapat halaman galat 500 bawaan framework (tidak di-cache, berbahasa Inggris — halaman 500 statis App Router tak bisa diganti di Next 16.2.11), dan permintaan berikutnya mencoba lagi. Sama untuk undangan yang belum pernah dibuka. Halaman "belum bisa dimuat" + tombol Coba lagi berbahasa Indonesia berlaku untuk halaman DINAMIS: Album Momen, pratinjau pemilik, dan dashboard (halaman undangan sendiri tak memuat layar itu agar bundel JS tamu tetap dalam anggaran).
  - Pratinjau pemilik, halaman Album Momen, berkas `.ics`, dan gambar pratinjau tautan (OG) mengikuti prinsip yang sama: kegagalan membaca dijawab sebagai gangguan sementara yang bisa dicoba lagi, bukan "tidak ada" atau data kosong. Galeri foto Album Momen adalah pengecualian yang disengaja (tetap tampil dengan foto yang berhasil dimuat, galatnya dilaporkan).
  - Alamat undangan yang bentuknya mustahil ditolak tanpa menyentuh database.
  - **Aksi tamu** (sapaan `?g=`, RSVP, amplop, dinding ucapan, Album Momen) mengikuti prinsip yang sama (DECISIONS #46): gangguan database dijawab sebagai gangguan **sementara** yang bisa dicoba lagi — bukan "token tak dikenal", "undangan tidak menerima konfirmasi", "belum ada ucapan", atau "album tidak aktif". RSVP **tidak disimpan** bila data tamunya gagal dibaca (lebih baik tamu mengulang daripada konfirmasi tersimpan tak tertaut dengan jumlah orang yang salah), sapaan yang gagal tetap mempertahankan token tamu, dan jepretan Album Momen yang ditolak karena gangguan sesaat disimpan di perangkat dengan tombol **Kirim ulang foto** — momen di acara tak bisa diulang. Ajakan "coba lagi" harus benar-benar bisa berhasil: setiap kiriman yang ditolak meminta tantangan anti-bot yang baru (token Turnstile sekali pakai), dan kegagalan jaringan tak boleh membekukan form.

### 6.2 Stack

| Komponen | Pilihan | Catatan |
|---|---|---|
| Framework | Next.js (App Router, versi stabil terbaru) + TypeScript strict | Server Components default |
| Styling & motion | Tailwind CSS + shadcn/ui (dashboard); tema: sistem motion 3 tingkat — Framer Motion (Craft), GSAP ScrollTrigger/SplitText + Lenis (Story/Signature), aksen WebGL via Paper Shaders (Signature) | Panduan lengkap: `docs/THEME-DESIGN.md` |
| Database/Auth | Supabase cloud (supabase.com) | Mulai free tier; **upgrade Pro (±$25/bln) saat launch** — free tier bisa auto-pause & tanpa backup harian |
| Storage media | Fase dev: Supabase Storage (free, 1GB) → jembatan sejak 14 Okt 2026: `local` (disk VPS, disajikan `/media`) → menjelang launch: **Cloudflare R2** (free 10GB, **egress Rp0**) | Abstraksi `lib/storage/`; media selalu disajikan via URL sendiri, bukan URL vendor — detail §6.4 |
| Validasi | Zod (skema tunggal dipakai form & server) | |
| Pembayaran | BinderPay (API SNAP — QRIS saja, DECISIONS #99); Pakasir (app.pakasir.com — QRIS + VA) tetap dipakai sampai `BINDERPAY_PARTNER_ID` diisi (DECISIONS #102) | Abstraksi `lib/payment/` agar mudah pindah gateway (Midtrans/Xendit) bila kelak diperlukan |
| Email | Resend | Fallback SMTP |
| Anti-spam | Cloudflare Turnstile | |
| Deploy | VPS sendiri + Easypanel, build **Dockerfile** | Dipilih Dockerfile (bukan Nixpacks): hasil build deterministik, image kecil (multi-stage + Next `output:'standalone'`), cache layer jelas |
| Monitoring | Sentry (error) + UptimeRobot (uptime) + log Easypanel | Keduanya free tier |

### 6.3 Deploy via Easypanel

App dibuat di Easypanel dari repo Git, branch **`production`**: push ke `main` → CI (`verify` + `db`) hijau → job `promote` mem-fast-forward `production` → webhook Auto Deploy → build & deploy (DECISIONS #64; webhook Auto Deploy hanya memicu build saat `production` maju — push ke `main` sendiri tak memicu apa pun — sedangkan tombol Deploy membangun ulang tip `production` yang ada; jadi commit ber-CI-merah tak ter-deploy, kecuali lewat jalur darurat pemilik di `docs/RUNBOOK.md` Skenario A2). `Dockerfile` multi-stage: `node:22-alpine` → install deps → build (`output: 'standalone'`) → runtime image hanya berisi `.next/standalone` (+ public & static), berjalan sebagai user non-root, `EXPOSE 3000`, `HEALTHCHECK` liveness `/api/health?probe=live` (tanpa probe DB; probe lengkap `/api/health` untuk UptimeRobot/`ops:verify` — DECISIONS #110; health check di panel Easypanel dibiarkan kosong). Domain di-attach di Easypanel (SSL Let's Encrypt otomatis via Traefik). Environment variables di-set di panel — tidak pernah di repo:

```
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, PAKASIR_PROJECT_SLUG, PAKASIR_API_KEY, PAKASIR_WEBHOOK_SECRET,  # PAKASIR_* hanya sampai peralihan
BINDERPAY_PARTNER_ID, BINDERPAY_BASE_URL,             # PARTNER_ID terisi → gateway = BinderPay
BINDERPAY_PRIVATE_KEY_B64, BINDERPAY_PUBLIC_KEY_B64,  # PEM ter-base64: privat KITA, publik BinderPay
RESEND_API_KEY, EMAIL_FROM, TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY,
CRON_SECRET, STORAGE_DRIVER (supabase|local|r2), MEDIA_ROOT (saat driver=local), NEXT_PUBLIC_MEDIA_URL,
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET  # R2_* diisi saat pindah driver
```

Cron (crontab root di host VPS memanggil `/api/cron/*` dengan `CRON_SECRET` — Easypanel tak punya penjadwal; `docs/LAUNCH-CHECKLIST.md` Fase 3): expire order pending > 24 jam · tandai undangan lewat `active_until` → `expired` · kirim email pengingat H-14.

### 6.4 Strategi Storage Media (bertahap — biaya Rp0 sampai skala besar)

Yang disimpan MVP: foto galeri & mempelai (±5–10MB per undangan setelah kompresi), library musik (±100MB sekali), OG image per undangan. Volume simpan kecil; yang mahal adalah **egress hari-H** (300–500 tamu membuka galeri ±1–2GB per event) — karena itu strateginya:

| Tahap | Driver | Biaya | Trigger pindah |
|---|---|---|---|
| Development + klien-klien pertama | Supabase Storage free tier (1GB storage, 5GB egress) | Rp0 | — |
| **Jembatan — sejak 14 Okt 2026** | **`local`: disk VPS sendiri** (volume Easypanel), disajikan route `/media/[...path]` dari `merriva.id` + cache Cloudflare | Rp0 (VPS sudah ada) | Dipakai saat egress/kuota Supabase jadi penghalang sementara R2 belum disiapkan; lihat DECISIONS #82 |
| Menjelang launch komersial / klien mulai rutin | **Cloudflare R2** free tier (10GB, egress gratis, dilayani via `cdn.merriva.id` + cache Cloudflare) | Rp0 | Masuk checklist M4; **wajib sebelum** event ramai karena egress Supabase free hanya 5GB |
| Skala besar (>10GB ≈ >1.000 undangan) | Tetap R2 ($0,015/GB/bln) | ±Rp10–25rb/bln | — |

**Aturan desain yang membuat perpindahan murah (berlaku sejak commit pertama):** (1) database hanya menyimpan `storage_path` relatif — URL vendor tidak pernah masuk DB; (2) semua akses lewat modul `lib/storage/` (interface: `upload/getUrl/delete`, driver: `supabase` | `local` | `r2` via S3 API, dipilih env `STORAGE_DRIVER`); (3) halaman publik menyajikan media dari domain sendiri (`cdn.merriva.id`, `merriva.id/media`, atau route proxy selama fase Supabase) sehingga pindah vendor tidak mengubah satu pun URL yang beredar; (4) nama file immutable (hash/UUID) agar cache CDN aman selamanya. Pengecualiannya musik unggahan klien (`audio/`): namanya tetap UUID, tetapi disajikan dengan cache maksimal 1 jam, karena berkas yang di-takedown harus berhenti tersaji dari edge tanpa purge manual (DECISIONS #121). Migrasi = jalankan script copy (rclone/S3 sync) + ganti env — tanpa perubahan kode/data.

**Harga driver `local` yang harus disadari sebelum memakainya:** media hidup di satu disk VPS, jadi (a) **tanpa volume yang di-mount, seluruh foto klien hilang pada rebuild berikutnya** — unggahnya tetap "berhasil", ke lapisan container yang dibuang; (b) tidak ada replikasi dan tidak ada backup bawaan (Fase 5 LAUNCH-CHECKLIST tetap berlaku, malah lebih mendesak); (c) hanya sah selama app berjalan **satu replika** — dua replika berarti foto yang diunggah ke replika A tak terlihat dari replika B. Karena itu ia tahap jembatan, bukan tujuan.

**Kenapa bukan Google Drive:** Drive membatasi akses file yang ramai diakses (error 403 saat ratusan tamu membuka galeri bersamaan — gagal justru di hari-H), tidak memberi kontrol cache/CDN, dan pemakaian sebagai backend platform komersial berisiko akun ditangguhkan (seluruh foto klien ikut hilang). Diputuskan **tidak dipakai** (24 Jul 2026).

---

## 7. Struktur Proyek

```
saas-undangan/
├─ SPEC.md                      # dokumen ini
├─ Dockerfile
├─ .env.example                 # daftar env tanpa nilai
├─ next.config.ts               # output: 'standalone'
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/           # landing, /tema, /harga, demo tema
│  │  ├─ (auth)/                # /masuk, /daftar, /reset-password
│  │  ├─ (dashboard)/dashboard/ # undangan, editor multi-step, tamu, pembayaran
│  │  ├─ (admin)/admin/
│  │  ├─ [slug]/                # halaman undangan publik (ISR)
│  │  └─ api/
│  │     ├─ webhooks/binderpay/ # callback QRIS BinderPay
│  │     ├─ webhooks/pakasir/   # jalur lama, sampai peralihan
│  │     ├─ og/[slug]/          # OG image generator
│  │     ├─ cron/
│  │     └─ health/
│  ├─ themes/                   # SATU FOLDER PER TEMA (lihat §7.1)
│  │  ├─ registry.ts
│  │  └─ eternal-rose/  index.tsx · theme.json · demo-data.ts
│  ├─ components/  ui/ · dashboard/ · invitation/   # section dipakai lintas tema
│  ├─ lib/         supabase/ · payment/ · storage/ (driver supabase|local|r2) · email/ · validation/ (skema Zod) · utils/
│  ├─ server/      actions/ · services/ · guards/  # semua mutasi lewat sini
│  └─ types/
├─ supabase/       migrations/ · seed.sql          # dikelola Supabase CLI
└─ tests/          unit/ · e2e/
```

### 7.1 Sistem tema (kontrak terpenting di kode)

Setiap tema = komponen React yang menerima props `InvitationData` (hasil parse Zod dari `content`) dan **tidak boleh** mengambil data sendiri. `theme.json` mendeklarasikan metadata (nama, kategori yang didukung, varian warna, section yang didukung). `registry.ts` memetakan slug tema → komponen (dynamic import). Menambah tema baru = menambah folder + baris registry + seed metadata — **tanpa menyentuh kode inti**. Target launch: 6 tema (3 pernikahan, 1 corporate, 1 keluarga, 1 universal minimalis). Art direction, sistem motion 3 tingkat, dan budget performa tema diatur di `docs/THEME-DESIGN.md`; acuan visual teruji: **6 prototipe di `prototypes/`** (satu per tema launch).

---

## 8. Perintah (Commands)

```bash
pnpm dev                  # jalankan dev server (http://localhost:3000)
pnpm build && pnpm start  # build & jalankan production lokal
pnpm lint                 # ESLint + Prettier check
pnpm typecheck            # tsc --noEmit
pnpm test                 # unit test (Vitest)
pnpm test:e2e             # Playwright (butuh env sandbox)
supabase migration new <nama>   # buat migrasi baru
supabase db push          # terapkan migrasi ke project cloud
supabase db reset         # reset DB lokal (supabase start) + seed
docker build -t undangan .      # verifikasi image sebelum push
```

Alur kerja: kembangkan terhadap **Supabase project "staging"** (project kedua, gratis) → migrasi teruji → migrasi production dijalankan sadar & manual (`supabase db push` ke project production) **SEBELUM push** bila kode baru membutuhkannya (urutan khusus dicatat di ADR fiturnya) → push ke `main` → CI (`verify` + `db`) hijau → job `promote` mem-fast-forward `production` → Easypanel Auto Deploy (DECISIONS #64). Push yang lolos CI ter-deploy otomatis dalam beberapa menit — tak ada jeda manual untuk menyelipkan migrasi sesudah push.

---

## 9. Gaya Kode (Code Style)

TypeScript `strict`, tanpa `any` (pengecualian didokumentasikan). Server Components secara default; `"use client"` hanya bila perlu interaktivitas. Seluruh mutasi lewat Server Actions di `src/server/actions/` dengan pola wajib: autentikasi → otorisasi kepemilikan → validasi Zod → operasi → revalidate cache. Semua input divalidasi ulang di server meski sudah divalidasi di form. Nominal uang selalu integer IDR. Teks UI bahasa Indonesia, disimpan terpusat di `lib/copy.ts` (persiapan i18n). Penamaan: file `kebab-case`, komponen `PascalCase`, fungsi/variabel `camelCase`, tabel DB `snake_case`. Commit mengikuti Conventional Commits (`feat:`, `fix:`, `chore:`...) — pesan boleh berbahasa Indonesia. Satu PR/commit = satu perubahan logis; tidak ada commit langsung berisi secrets, file `.env` masuk `.gitignore`.

---

## 10. Strategi Testing

**Unit (Vitest):** skema validasi Zod per kategori acara, perhitungan `active_until`, penegakan limit paket, generator pesan WA (escaping URL), formatter tanggal/rupiah, handler webhook BinderPay & Pakasir (fixture: payload valid, amount tidak cocok, order tak dikenal, duplikat; BinderPay juga tanda tangan/stempel waktu tak sah).

**Integration:** server actions terhadap Supabase lokal (`supabase start`) — fokus RLS: user A tidak bisa membaca/menulis data user B; insert RSVP publik terkena rate limit.

**E2E (Playwright), jalur yang wajib hijau sebelum rilis:** (1) daftar → buat undangan wedding → isi semua step → preview; (2) checkout → pembayaran sandbox → webhook → undangan aktif (Pakasir: `paymentsimulation`; BinderPay: QR dibayar lewat Payment Simulator di dashboard sandbox — spec Playwright untuk jalur ini belum ada); (3) buka link tamu bertoken → RSVP → muncul di dashboard; (4) role client mencoba akses `/admin` → ditolak.

**Checklist manual pra-launch:** buka undangan dari WA in-app browser di Android & iOS asli · Lighthouse mobile ≥ 90 pada 3 tema · pembayaran production nominal kecil (Rp10.000, paket uji) end-to-end · restore backup Supabase pernah dicoba sekali · uji beban ringan halaman undangan (k6, 200 pengunjung bersamaan — mewakili tamu serentak hari-H).

Definisi selesai per fitur: kriteria terima §4 terpenuhi + test terkait hijau + tidak menurunkan skor Lighthouse.

---

## 11. Batasan (Boundaries)

**Selalu (always):** validasi server-side di setiap mutasi · RLS aktif untuk tabel baru sebelum migrasi di-push · verifikasi setiap callback/webhook gateway dengan memanggil status transaksi sebelum aktivasi (payload = sinyal, bukan bukti; tanda tangan RSA BinderPay dan header `X-Secret` Pakasir v2 hanyalah lapis ADITIF) · rate limit semua endpoint publik · jalankan `lint + typecheck + test` sebelum merge · backup/snapshot sebelum migrasi production · pakai sandbox gateway (Payment Simulator BinderPay; `paymentsimulation` Pakasir) — bukan uang asli — di luar production · kredensial hanya lewat env Easypanel.

**Tanya dulu (ask first):** mengubah harga/struktur paket · migrasi yang mengubah/menghapus kolom berisi data production · menghapus data user · menambah dependency besar atau layanan berbayar baru · mengubah kontrak props tema (berdampak ke semua tema) · kebijakan refund kasus per kasus.

**Jangan pernah (never):** commit secrets/`.env` ke repo · memakai tool WA blast tidak resmi/unofficial API atas nama platform (risiko nomor diblokir — distribusi MVP adalah `wa.me` yang diklik manual oleh klien dari HP-nya sendiri) · menyimpan data pembayaran sensitif (kita hanya menampilkan QR; pembayarannya terjadi di aplikasi e-wallet/m-banking pembayar — selama peralihan di halaman Pakasir — dan nama pembayar dari callback dibuang) · mengekspos `guests`, `gift_notes`, `orders` di API publik · menghapus undangan yang masih aktif · push ke `main` pada hari ketika ada event klien berlangsung, kecuali perbaikan darurat yang disetujui pemilik — sejak 10 Nov 2026 setiap push yang lolos CI adalah redeploy penuh (restart kontainer + cache ISR kosong), sekecil apa pun perubahannya; cek kalender event dulu · push manual ke branch `production` — hanya job `promote` CI yang menggerakkannya, sesudah `verify` + `db` hijau (DECISIONS #64); satu-satunya pengecualian: jalur darurat pemilik di `docs/RUNBOOK.md` Skenario A2 · membiarkan musik yang dilaporkan atau diketahui melanggar hak cipta tetap tersaji, termasuk lewat URL langsung & cache edge — berlaku untuk musik unggahan klien **maupun lagu pustaka** (menonaktifkan lagu pustaka saja tidak cukup: hapus objeknya lalu purge Cloudflare, `docs/RUNBOOK.md`) (DECISIONS #121) · menyimpan URL vendor storage di database atau menyajikan media langsung dari URL vendor (selalu lewat `lib/storage/` + domain sendiri) · memakai Google Drive/layanan file-sharing personal sebagai backend media.

---

## 12. Milestone & Estimasi

| Milestone | Isi | Estimasi | Kriteria selesai |
|---|---|---|---|
| **M0 — Fondasi** | Repo, Next.js skeleton, Supabase (staging+prod), skema DB + RLS, Dockerfile, pipeline Easypanel, domain + SSL, halaman health | ~1 minggu | Deploy otomatis jalan; `/api/health` hijau di domain production |
| **M1 — Buat undangan** | Auth, dashboard klien, form multi-step 3 kategori, upload foto, autosave, 1 tema pertama + preview | 2–3 minggu | Klien bisa membuat & mem-preview undangan lengkap |
| **M2 — Halaman publik & tamu** | Halaman undangan ISR, RSVP+ucapan+amplop, anti-spam, manajemen tamu, impor Excel, generator WA, OG image | ~2 minggu | Alur tamu end-to-end jalan di WebView WA |
| **M3 — Monetisasi** | Paket & limit, integrasi Pakasir (payment link + webhook + verifikasi `transactiondetail` — kini v2 `transaction-status`, DECISIONS #72), aktivasi otomatis, email transaksional, cron expiry | 1–2 minggu | Pembayaran simulasi end-to-end; aktivasi & kuitansi otomatis |
| **M4 — Launch** | Panel admin, 5 tema tambahan, landing page final, testing penuh, checklist pra-launch, pembayaran production diuji, **aktivasi R2 + migrasi media dari Supabase (§6.4)** | ~2 minggu | 10 undangan uji dari 3 kategori; go-live |

Total gambaran: **8–10 minggu** pengerjaan tunggal berbantuan AI; bisa terkompresi signifikan bila dikerjakan intensif. Urutan M1 sebelum M3 disengaja: undangan gratis-dulu-bayar-belakangan berarti funnel pembuatan harus matang sebelum pembayaran.

---

## 13. Risiko & Mitigasi

Perang harga pasar → jangan adu murah; kualitas tema + funnel freemium, monetisasi lanjut di Fase 2–3 (bundling guestbook). · WebView WA punya keunikan rendering → diuji sejak M2, bukan menjelang launch. · Supabase free tier auto-pause & egress storage hanya 5GB → upgrade Pro sebelum ada klien berbayar dan pindahkan media ke R2 sebelum event klien ramai (checklist M4). · Lonjakan trafik hari-H → ISR + Cloudflare cache; uji beban k6. · Spam RSVP/ucapan → Turnstile + rate limit + moderasi. · **Hak cipta musik → risiko DITERIMA, bukan hilang** (DECISIONS #121, membalik #8). Sejak undangan Premium boleh mengunggah MP3 sendiri, sebagian unggahan diperkirakan berupa lagu populer tanpa izin. Itu pola pasar: pesaing lokal membolehkan lagu sendiri dengan klausul jaminan pengguna saja. Dengan fitur ini Merriva termasuk "Platform Layanan Digital berbasis UGC", yang menurut Putusan MK 84/PUU-XXI/2023 dilarang *membiarkan* pelanggaran hak cipta yang diketahuinya. Tolok ukurnya pengetahuan, jadi laporan yang didiamkan adalah risiko terbesar. Mitigasinya: pustaka bebas royalti tetap bawaan; pernyataan hak di setiap unggahan; catatan unggah `music_uploads`; jalur laporan di `/syarat` (alamat dukungan) dengan takedown admin yang berlaku ≤ 1 jam; pelanggar berulang ditindak dengan alat yang ada (suspend undangan, tangguhkan akun). Pembebasan tanggung jawab Pasal 11 Permenkominfo 5/2020 hanya berbunyi "dapat dibebaskan" dan lemah selama Merriva belum terdaftar sebagai PSE. **Pemilik memutuskan merilis fitur ini sebelum PSE terdaftar (9 Nov 2026).** Yang tidak tertutup mitigasi: klaim royalti terhadap platform (LMKN cenderung menagih platform, bukan pengguna), RUU Hak Cipta (target Desember 2026) yang bisa menambah kewajiban mencegah dan mendeteksi, dan salinan berkas yang di-takedown di backup R2 privat (±30 hari, tidak tersaji ke publik). · VPS single point of failure → UptimeRobot + prosedur restore terdokumentasi & pernah dilatih; DB aman di Supabase meski VPS mati (recovery = deploy ulang container), **tetapi sejak driver `local` (14 Okt 2026) seluruh objek media hanya ada di volume disk VPS tanpa backup apa pun** — kehilangan VPS = kehilangan foto klien, dan restore DB hanya mengembalikan baris yang menunjuk objek yang tak ada lagi (lihat `docs/LAUNCH-CHECKLIST.md` Fase 5). · Ketergantungan pada gateway yang relatif baru → sudah terjadi sekali: Pakasir akan tutup, dan BinderPay dipasang sebagai penggantinya lewat abstraksi `lib/payment/` (DECISIONS #99, peralihan #102); BinderPay memakai SNAP (standar Bank Indonesia), jadi penerus ber-SNAP bisa memakai ulang modul tanda tangannya; pantau keandalan settlement sejak transaksi pertama. · Kepatuhan: daftar **PSE Kominfo** via OSS sebelum promosi besar (fitur musik unggahan sengaja dirilis lebih dulu — lihat butir hak cipta musik di atas); kebijakan privasi + hapus data sesuai **UU PDP 27/2022** (data tamu dihapus otomatis 6 bulan setelah undangan expired).

---

## 14. Keputusan Terbuka (perlu diputuskan sebelum/selama M0–M1)

~~Nama brand & domain~~ → **DIKUNCI: Merriva / merriva.id** (24 Jul 2026; segera beli di registrar — disarankan amankan juga merriva.com yang tampak tersedia) · harga final paket (angka §2 adalah usulan awal) · identitas visual dasar (logo, font, warna brand) · daftar 6 tema launch beserta gaya desainnya · kebijakan refund tertulis · badan usaha untuk pendaftaran PSE & rekening bisnis (PT perorangan disarankan).

---

*Dokumen ini adalah sumber kebenaran (source of truth) MVP Fase 1. Perubahan scope dicatat dengan mengubah dokumen ini terlebih dahulu, baru diimplementasikan. Fase 2 (buku tamu QR & layar sapa) akan mendapat dokumen spesifikasi terpisah yang dibangun di atas skema data ini.*


