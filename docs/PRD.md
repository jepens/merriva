# PRD — Merriva (MVP Fase 1)

**Produk:** Merriva — platform undangan digital & digital guestbook (merriva.id)
**Versi:** 1.0 — 24 Juli 2026 · **Pemilik:** Sailendra Organizer
**Dokumen pendamping:** `../SPEC.md` (spesifikasi fitur & kriteria terima — sumber kebenaran teknis)

---

## 1. Ringkasan

Merriva adalah platform self-service tempat siapa pun membuat undangan digital untuk pernikahan, corporate event, dan acara keluarga — gratis dibuat dan di-preview, bayar hanya saat mengaktifkan. Visi jangka panjangnya: **"satu QR untuk semua acara"** — undangan → RSVP → check-in di lokasi (Fase 2) → kenangan foto/video dari tamu (Fase 3). MVP Fase 1 membangun mesin undangannya.

## 2. Latar belakang pasar (riset 24 Jul 2026)

Pasar undangan digital Indonesia ramai dan mengalami **perang harga di segmen bawah** — pemain seperti Sangmempelai menjual paket lengkap Rp49.000, Invi.id menetapkan harga jual reseller mulai Rp39.000. Sebaliknya, **buku tamu digital QR check-in** (Katsudoto, Einvite, HelloGuest) dijual dengan harga premium tanpa daftar harga publik, dan **fitur "kenangan" ala internasional** (tamu mengunggah foto/video/pesan suara — GuestCam, Wedibox, $39–149/event) praktis belum digarap pemain lokal. Kesimpulan strategis: undangan adalah *pintu masuk* pasar, sedangkan margin dan diferensiasi ada di lapisan guestbook + kenangan + bundling jasa EO — posisi yang cocok karena pemilik Merriva juga menjalankan bisnis event organizer (Sailendra Organizer).

## 3. Target pengguna

**P1 — Pasangan pengantin (±80% pasar).** Usia 23–35, semua dikerjakan dari HP, terbiasa QRIS, ingin undangan yang terlihat premium dan bisa disebar via WhatsApp hari itu juga. Kriteria beli: tampilan tema, harga, kecepatan jadi.

**P2 — Keluarga penyelenggara hajat.** Khitanan, ulang tahun, syukuran, aqiqah. Kebutuhan sama dengan P1 namun lebih sederhana; sensitif harga.

**P3 — PIC corporate event.** Gathering, seminar, gala dinner. Butuh RSVP yang rapi dan data kehadiran; calon utama upsell Fase 2 (QR check-in). Di MVP dilayani dengan kategori tema tersendiri.

**Pengguna sekunder — tamu undangan.** Membuka link dari WhatsApp; tidak mau install apa pun; koneksi & HP beragam. Pengalaman tamu adalah produk yang sesungguhnya dipamerkan — setiap tamu adalah calon pembeli berikutnya.

**Internal — admin (tim Sailendra).** Mengelola katalog, order bermasalah, dan membuatkan undangan untuk klien jasa EO.

## 4. Masalah & solusi

| Masalah | Solusi Merriva |
|---|---|
| Undangan cetak mahal & lambat; undangan digital murahan terlihat generik | Tema berkualitas dengan preview demo hidup sebelum membayar |
| Chat bolak-balik dengan jasa undangan memakan waktu | Self-service penuh: isi form, preview real-time, aktif setelah bayar |
| Data tamu berantakan (siapa hadir, berapa orang) | RSVP + pax otomatis terkumpul di dashboard, ekspor Excel |
| Menyebar undangan satu-satu merepotkan | Import tamu dari Excel + generator pesan WA personal per tamu |
| Amplop fisik tidak relevan untuk tamu jarak jauh | Amplop digital (rekening/e-wallet + konfirmasi privat) |

## 5. Tujuan & metrik sukses MVP (60 hari pasca-launch)

Minimal **10 undangan terbayar** di luar klien EO sendiri · klien menyelesaikan undangan pertama **< 30 menit** tanpa bantuan · halaman undangan **Lighthouse mobile ≥ 90 / terbuka < 3 dtk di 4G** · **nol downtime** pada hari-H event klien · konversi draft→bayar ≥ 15% (indikator funnel freemium sehat).

## 6. Scope MVP Fase 1

Sepuluh modul (kriteria terima lengkap di `SPEC.md` §4): landing + katalog & demo tema · auth (email/Google) · dashboard klien · pembuat undangan form multi-step 3 kategori · halaman undangan publik (cover "Kepada Yth", countdown, maps, galeri, love story, musik) · RSVP + ucapan & doa + amplop digital · manajemen tamu (import Excel, link WA personal, status dibuka) · pembayaran Pakasir (QRIS/VA) dengan aktivasi otomatis · panel admin · email transaksional. Target launch: **6 tema** (3 pernikahan, 1 corporate, 1 keluarga, 1 universal).

## 7. Paket & harga awal (disimpan di DB, mudah diubah)

**Basic Rp99.000** (tema standar, 8 foto, 150 tamu, 6 bulan, watermark kecil) · **Premium Rp199.000** (semua tema, 20 foto + video YouTube, tamu unlimited, live streaming, 12 bulan, tanpa watermark). Buat & preview selalu gratis; bayar saat aktivasi. Posisi: di atas pemain perang-harga, di bawah tier Gold–Platinum pasar (Rp150–400rb+). Fee Pakasir per transaksi ±Rp1.000–2.000 (QRIS).

## 8. Non-goals Fase 1

QR check-in & layar sapa (Fase 2) · denah meja/souvenir/doorprize (Fase 2) · upload kenangan tamu (Fase 3) · reseller/white-label (Fase 4) · WhatsApp API resmi (MVP memakai link `wa.me` gratis) · editor drag-and-drop · custom domain otomatis · aplikasi native · multi-bahasa.

## 9. Roadmap produk selepas MVP

**Fase 2 — Buku tamu QR:** e-ticket QR per tamu (memakai `guests.token` yang sudah ada), scanner PWA untuk usher, layar sapa TV venue, dashboard kehadiran real-time, denah meja, souvenir & angpau, export laporan. Membuka paket bundling premium dan pasar corporate. **Fase 3 — Kenangan:** tamu mengunggah foto/video/pesan suara via QR yang sama, live slideshow di venue, album pasca-acara — diferensiasi utama vs kompetitor lokal. **Fase 4 — Skala:** program reseller untuk WO/EO, WA Business API resmi, fitur corporate lanjutan, custom domain otomatis.

## 10. Snapshot kompetitor (Jul 2026)

| Pemain | Posisi | Harga publik |
|---|---|---|
| Sangmempelai, Invi.id, Satumomen, dkk | Undangan murah massal, perang harga | Rp39–99rb |
| Sannubari & pasar umum | Tier Silver–Diamond | Rp50rb–3jt |
| Katsudoto, Einvite, HelloGuest | Buku tamu QR + jasa on-site, fokus B2B/EO | Tidak dipublikasi (premium) |
| GuestCam, Wedibox, Guestpix (global) | Photo/video/audio guestbook | $39–149/event |
| Merriva | Undangan berkualitas → bundling guestbook & kenangan → jaringan EO | Rp99–199rb (Fase 1) |

## 11. Risiko produk utama

Perang harga menekan konversi → jangan adu murah; kualitas tema & funnel freemium adalah senjatanya, monetisasi sesungguhnya di Fase 2–3. · Galeri/halaman lambat = reputasi hancur di hari-H → target performa adalah requirement, bukan nice-to-have. · Kepercayaan pembayaran (brand baru) → tampilkan metode QRIS/VA resmi, kuitansi otomatis, kebijakan refund tertulis. · Kepatuhan: daftar PSE Kominfo sebelum promosi besar; UU PDP 27/2022 untuk data tamu (retensi & penghapusan otomatis).

## 12. Keputusan yang masih terbuka

Harga final paket (angka §7 = hipotesis awal — validasi dengan 10 klien pertama) · identitas visual (logo, font, palet warna) · daftar & gaya 6 tema launch · kebijakan refund tertulis · badan usaha untuk PSE & rekening bisnis.
