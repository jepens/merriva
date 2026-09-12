# DECISIONS — Log Keputusan (ADR) Merriva

Format: setiap keputusan penting dicatat di sini dengan tanggal, keputusan, alasan, dan alternatif yang ditolak. Keputusan hanya boleh diubah dengan entri baru yang mereferensikan entri lama (jangan menghapus riwayat).

---

## #1 — 2026-07-24 · Model layanan: self-service penuh
**Keputusan:** klien mendaftar, mengisi, membayar, dan mengaktifkan undangan sendiri; admin bisa membuatkan untuk klien jasa EO lewat dashboard yang sama.
**Alasan:** sesuai visi platform SaaS yang bisa diskalakan; funnel otomatis tanpa kerja manual per order.
**Ditolak:** jasa-dulu (admin input semua — lebih cepat dibangun tapi bukan platform), hybrid dua jalur (scope terlalu besar untuk MVP).

## #2 — 2026-07-24 · Editor: form terstruktur multi-step (bukan drag-and-drop)
**Alasan:** 3–5× lebih cepat dibangun, hasil selalu rapi, standar mayoritas platform lokal. Drag-and-drop dipertimbangkan ulang setelah MVP terbukti.

## #3 — 2026-07-24 · Stack: Next.js + Supabase cloud, deploy Dockerfile via Easypanel di VPS sendiri
**Alasan:** preferensi & infrastruktur pemilik (VPS + Easypanel sudah ada); Supabase memberi Postgres+RLS+Auth managed; Dockerfile dipilih di atas Nixpacks untuk build deterministik & image kecil (Next `output:'standalone'`).

## #4 — 2026-07-24 · Payment gateway: Pakasir (pakasir.com)
**Keputusan:** Pakasir untuk QRIS + Virtual Account, integrasi via payment link + webhook.
**Alasan:** pilihan pemilik; biaya kompetitif (QRIS 0,7%+Rp310 / 1%; VA flat Rp2.000–3.500; tanpa biaya bulanan; settlement H+1).
**Konsekuensi teknis (wajib):** webhook Pakasir tanpa signature → verifikasi dua lapis: match order di DB + konfirmasi `GET transactiondetail` sebelum aktivasi. Abstraksi `lib/payment/` dipertahankan agar bisa pindah Midtrans/Xendit dengan menyentuh satu modul bila keandalan bermasalah.
**Ditolak:** Midtrans/Xendit sebagai gateway awal (tetap menjadi fallback terdokumentasi).

## #5 — 2026-07-24 · Nama & domain: Merriva / merriva.id
**Alasan:** dari *merry* (meriah) — universal untuk semua jenis acara, mudah diucapkan, brandable; merriva.com & merriva.id tampak belum terdaftar dan tanpa konflik brand saat riset.
**Ditolak setelah riset:** Meriah.id (terdaftar), keluarga "Hadir*" (Hadirin/Hadirly/Hadirku eksis), Acaraku (dipakai Kenangan), Hajatan (Hajatan.info eksis), Evervite (.com premium + .id sudah coming-soon pihak lain), Evinta/Vitely/Occasia/Celebrio/Attendly/Festimo (konflik brand/domain).
**Tindak lanjut:** beli merriva.id + merriva.com di registrar secepatnya; cek merek PDKI sebelum investasi branding besar.

## #6 — 2026-07-24 · Storage media: bertahap Supabase Storage → Cloudflare R2; Google Drive ditolak
**Keputusan:** development & klien awal di Supabase Storage free tier; pindah ke R2 (free 10GB, egress gratis, via `cdn.merriva.id`) menjelang launch komersial — masuk checklist M4.
**Alasan:** biaya Rp0 di kedua tahap; egress hari-H (±1–2GB/event) adalah komponen biaya terbesar dan R2 menggratiskannya; R2 siap untuk video kenangan Fase 3.
**Aturan pendukung:** DB hanya menyimpan `storage_path` relatif; akses via `lib/storage/` (driver `STORAGE_DRIVER`); media dilayani dari domain sendiri; nama file immutable.
**Ditolak:** Google Drive (rate limit 403 saat ratusan tamu mengakses = galeri mati di hari-H; risiko suspend akun; tanpa kontrol CDN) · disk VPS (hilang saat redeploy, tanpa CDN, backup manual).

## #7 — 2026-07-24 · Distribusi WhatsApp: link `wa.me` per tamu, bukan blast otomatis
**Alasan:** gratis dan aman (klien mengirim dari HP-nya sendiri); WA blast tidak resmi berisiko nomor diblokir; WA Business API resmi (±Rp780/pesan marketing) ditunda ke Fase 4 sebagai add-on.

## #8 — 2026-07-24 · Musik: hanya library royalty-free bawaan platform
**Alasan:** menghindari pelanggaran hak cipta (lagu populer di undangan = risiko takedown/klaim); upload MP3 bebas ditolak di MVP.

## #9 — 2026-07-24 · RSVP & ucapan digabung satu form; kiriman ulang tamu bertoken = update
**Alasan:** UX tamu lebih sederhana (satu langkah); mencegah duplikasi data pax; ucapan tampil dari `rsvps.message`.

## #10 — 2026-07-30 · Arah desain tema: 4 DNA visual + sistem motion 3 tingkat; GSAP diadopsi
**Konteks:** tema pertama dinilai kaku/seperti template; pemilik ingin kualitas ala Awwwards namun tetap ringan di mobile (WebView WA).
**Keputusan:** (1) prinsip "desain dulu, teknologi kedua" — tipografi editorial, tekstur, koreografi adalah perbaikan utama; (2) sistem motion 3 tingkat: Craft (semua tema, ±0KB) → Story (GSAP ScrollTrigger+SplitText+Lenis, ≤45KB) → Signature (aksen WebGL ringan/Paper Shaders, ≤90KB total, lazy setelah "Buka Undangan"); (3) empat arah visual jadi DNA tema launch: Editorial Elegan, Cinematic Foto, Ilustratif Artistik, Eksperimental Modern; (4) `eternal-rose` di-redesign lebih dulu sebagai benchmark Signature.
**Dasar:** GSAP kini 100% gratis semua plugin (akuisisi Webflow); Paper Shaders zero-dependency utk efek WebGL tanpa three.js; Safari 26 sudah dukung CSS scroll-driven animations (progressive enhancement).
**Artefak:** `docs/THEME-DESIGN.md` (sistem & spesifikasi) · `prototypes/eternal-rose-signature.html` (acuan visual teruji, ±35KB, tanpa error).
**Addendum 2026-07-30:** kelima tema lainnya selesai diprototipekan & diverifikasi visual — `midnight-frame-story`, `flora-atelier-story`, `prisma-signature`, `family-warm-craft`, `mono-universal-craft` — sehingga seluruh 6 tema launch kini memiliki acuan visual hidup di `prototypes/`.
**Ditolak:** three.js penuh (terlalu berat untuk undangan mobile) · video background (berat + boros baterai).

## #11 — 2026-07-31 · Gelombang 2 tema: barakah, meridian, lumina di-redesign + tema baru `kirana` (Jawa)
**Konteks:** 3 tema existing belum tersentuh sistem desain baru; segmen pernikahan islami & adat Nusantara belum tergarap serius kompetitor.
**Keputusan:** 4 prototipe baru (semua diverifikasi visual, nol error): `barakah` (Islami — mihrab, khatam, zamrud/emas), `meridian` (Art Deco gala — sunburst, Italiana), `lumina` (soft film Korean-minimal — Craft murni), dan **`kirana`** sebagai tema baru untuk pernikahan adat Jawa.
**Dasar riset budaya (kirana):** motif **truntum** dipilih karena bermakna cinta yang bersemi & restu orang tua — motif pernikahan yang tepat; **parang secara eksplisit dihindari** karena dilarang dalam pernikahan adat Jawa (dianggap membawa pertengkaran). Rangkaian acara menyertakan Upacara Panggih dengan catatan edukatif.
**Konsekuensi:** semua 9 tema existing + 1 baru kini punya acuan visual di `prototypes/`; porting gelombang 2 = Fase F di PORTING-PROMPT.md; `kirana` butuh registry + catalog-meta + seed (pola prisma). Palet 3 tema upgrade sengaja mempertahankan catalog-meta existing agar katalog marketing tetap konsisten.

## #12 — 2026-07-31 · Kustomisasi oleh pembeli: "kustomisasi terpandu" (jalur A); kanvas bebas ditolak
**Konteks:** pemilik ingin pembeli bisa mengkustom tema sendiri, idealnya dari HP; muncul pertanyaan drag-and-drop.
**Keputusan:** kustomisasi terpandu berbasis token & opsi terkurasi (preset varian warna per tema, custom accent Premium dengan **penjaga kontras WCAG otomatis**, pasangan font kurasi, urutan+on/off section via daftar drag-handle, gaya per-section, motion, corak) — live preview tema asli + bottom sheet, mobile-first. Spesifikasi penuh: `docs/CUSTOMIZER-SPEC.md`; UX teruji di `prototypes/customizer-mobile.html`.
**Ditolak (sadar):** kanvas drag-and-drop bebas ala Canva — presisi sentuh buruk & konflik gesture di HP, menghancurkan koreografi/tipografi/performa tema (menghapus diferensiasi), effort 3–6 bulan. Industri builder pun bergerak ke structured editing.
**Dicatat untuk masa depan:** section-builder "Studio" untuk EO/reseller di **desktop** memakai [Puck](https://github.com/puckeditor/puck) (MIT, embeddable, komponen tetap section tema sendiri) — dievaluasi bila ada tarikan pasar; bukan untuk pembeli di HP.
**Konsekuensi:** tema mendeklarasikan `options.ts` (editor generik membaca schema; server memvalidasi terhadap schema yang sama); `settings.custom` versioned & backward-compatible; gating Basic/Premium jadi jalur upsell.

## #13 — 2026-08-02 · Implementasi Fase G (customizer): keputusan teknis
**Konteks:** implementasi #12 untuk tema acuan `eternal-rose`. Beberapa pilihan teknis muncul saat wiring; dicatat agar konsisten untuk rollout 9 tema lain.
**Keputusan:**
1. **Invalidasi cache = `revalidatePath('/{slug}')`** di server action simpan-tampilan, BUKAN `updateTag`. Halaman publik `[slug]` memakai ISR berbasis PATH (`dynamic:'force-static'` + `revalidatePath`), belum berbasis cache-tag; `updateTag` hanya bermakna bila fetch diberi `cacheTag` (`use cache`). Memakai `revalidatePath` konsisten dgn seluruh action & tak mengubah model cache halaman LCP-kritis. (Panduan Next 16 `updateTag` vs `revalidateTag('max')` tetap berlaku bila kelak pindah ke tag-based.)
2. **`CoverGate` dapat prop OPSIONAL `appearance`** (`{style, data, motion}`) — CSS var override diterapkan di ELEMEN AKAR tema (bukan ancestor) karena var milik-sendiri elemen mengalahkan warisan; `motion:'calm'` meng-AND-kan preferensi user dgn tier device. Additive → 9 tema lain tak terpengaruh. Ini menyentuh infra bersama tapi non-breaking (bukan perubahan kontrak `InvitationData`).
3. **`settings.custom` dimiliki EKSKLUSIF** oleh `updateInvitationAppearance`. Skema base di `settingsSchema` hanya menjaga bentuk JSON (hex ketat, batas panjang); whitelist+gating ada di server action (satu sumber kebenaran). Jalur autosave konten **mengabaikan** `custom` dari klien & mempertahankan milik server → cegah bypass gating Premium + cegah kehilangan data.
4. **Penjaga kontras dihitung juga di RENDER PUBLIK** (server), bukan hanya editor — resolver murni `resolveAppearance` dipakai bersama; data cacat → fallback bawaan (tak pernah render rusak). Urutan section = **DOM order** (bukan CSS `order`).
5. **`@dnd-kit/react@0.5.0` + `@dnd-kit/helpers@0.5.0`** (paket generasi baru; `@dnd-kit/core`/`sortable` lama = legacy) untuk reorder; **tombol panah ↑↓** = jalur aksesibilitas utama + fallback.
6. **Gating premium = `!limits.watermark`** (penanda Basic konsisten di seluruh app).
**Ditolak:** live-preview via postMessage + bridge (dipilih akses DOM iframe same-origin langsung — lebih sederhana, tanpa komponen bridge) · migrasi halaman publik ke `use cache`+`cacheTag` demi `updateTag` (destabilkan halaman terbukti tanpa manfaat nyata sekarang).
**Konsekuensi:** rollout tema lain = tambah `src/themes/{slug}/options.ts` + 1 baris registry + wiring render (CSS var + section-map DOM order + `appearance` di CoverGate + instance next/font pasangan b/c). Anggaran font: maks 3 pasangan/tema (pasangan non-default `preload:false` → hanya diunduh saat dipilih).

## #14 — 2026-08-02 · Audit customizer 10 tema + generalisasi pratinjau (kontrak `preview`)
**Konteks:** audit menyeluruh Fase G setelah rollout 10 tema (10 auditor + sintesis + gate). Render server, gating, keamanan (whitelist/hex/injeksi), backward-compat, dan section-map **semua lolos**. Dua gap ditemukan yang tak tertangkap tsc/test: (a) **HIGH** — applier pratinjau editor (`applyToFrame`/`onFrameLoad`) ter-hardcode ke selektor/var eternal-rose (`.er`, `--rose`, `.er-stage`, `.er-open`), jadi pratinjau langsung **mati untuk 9 tema lain** (simpan & render publik tetap benar); (b) 5 id section (`opening/intro/principals/event/rundown`) tak punya label → jatuh ke id mentah Inggris di tab "Bagian".
**Keputusan:**
1. **Kontrak `preview` per-tema** (WAJIB di `ThemeOptions`): `{ root, vars: PreviewVar[], stage?, grain?, open? }`. `vars` = pemetaan `nama CSS var → token resolve` (accent/accentText/onAccent/paper/ink/disp/body). Editor menurunkan selektor dari `root` (konvensi `<root>-stage/-grain/-open`) dan reorder dgn jangkar **agnostik-tema** (elemen sebelum section pertama; footer tetap di akhir).
2. **Helper murni `appearanceStyle(vars, resolved)`** (`lib/customizer/appearance-style.ts`) dipakai **BERSAMA** oleh render server (`index.tsx` menyusun `appearance.style`) DAN editor (menerapkan var ke iframe) → **satu sumber pemetaan, mustahil drift**. Ini menghapus objek `style` tulis-tangan dari 10 `index.tsx`.
3. **`preview` wajib** → tsc menegakkan setiap tema (kini & nanti) mendeklarasikannya.
4. **Label section dilengkapi** untuk 14 id yang dipakai 10 tema; **test kontrak lintas-tema** baru (`theme-contracts.test.ts`, +50 assertion) mengunci: setiap tema punya `preview` valid, `appearanceStyle` menghasilkan tepat var yang dideklarasikan, dan setiap id section + nilai gaya punya label Indonesia.
**Alasan:** menutup isu HIGH tanpa mengubah kontrak props tema (`InvitationData`/`ThemeComponentProps` utuh); pendekatan same-origin DOM dari #13 dipertahankan tapi digeneralisasi; drift dicegah secara struktural (bukan sekadar disiplin) + dijaring test & tipe.
**Ditolak:** (a) **peta adapter yang menduplikasi** pemetaan var di editor — persis kelas bug yang diperbaiki (drift); dipilih helper satu-sumber. (b) **postMessage bridge** (ditolak lagi seperti #13) — lebih besar, menyentuh route `/preview` + jalur klien tema, tanpa manfaat sepadan.
**Konsekuensi / diketahui-minor (tak memblok):** 3 temuan **low** kosmetik dibiarkan — separator marquee eternal-rose pakai aksen mentah (semua `aria-hidden`), var `--er-on-acc` tak dikonsumsi CSS, eyebrow champagne meridian sub-AA untuk varian aksen terang (tema gelap, teks dekoratif). Pratinjau **aria/prisma** (bernomor): reorder di editor tak menghitung ulang nomor section secara live — nomor benar setelah Simpan (render server); aproksimasi pratinjau yang diterima. Rollout tema baru kini WAJIB menambah blok `preview` di `options.ts` (di-enforce tsc + test).

## #15 — 2026-08-03 · Aktivasi jalur launch: R2 driver (aws4fetch), migrasi media, uji beban k6, E2E webhook
**Konteks:** survei status M0–M4 (workflow) menemukan software pada dasarnya matang; sisa **koding** sempit → R2 storage (driver skeleton), skrip uji beban, dan cakupan E2E jalur webhook. Arah dipilih pemilik: **soft-launch** (R2 sebagai fast-follow yang disiapkan sekarang).
**Keputusan:**
1. **R2 driver via `aws4fetch`** (bukan `@aws-sdk/client-s3`). aws4fetch ~6,4 KB, memakai `fetch`+`SubtleCrypto` global (tersedia di Node 22 runtime), dipakai/direkomendasikan Cloudflare untuk R2. Karena hostname R2 tak mengikuti pola AWS, `service:"s3"`+`region:"auto"` DISET eksplisit agar SigV4 benar. Kontrak `StorageDriver` TIDAK berubah (DB tetap path relatif; penyajian via `NEXT_PUBLIC_MEDIA_URL`). Aktivasi = set `STORAGE_DRIVER=r2` + isi `R2_*` + `NEXT_PUBLIC_MEDIA_URL=cdn`.
2. **Migrasi media** = skrip ops `scripts/migrate-media-to-r2.mjs` (idempoten + resume via HEAD, `--dry-run`/`--force`/`--limit`, pool 8). DB TIDAK disentuh (path vendor-agnostik). Cutover: migrasi (0 gagal) → set env → verifikasi URL → hapus objek Supabase (opsional). `pnpm migrate:media`.
3. **Uji beban k6** `scripts/k6/invitation-load.js`: ramping ke 200 VU pada `/{slug}` (jalur ISR kritis WA-blast), ambang error < 1% & p95 < 800 ms. Jalankan pada build PRODUCTION di staging/Docker (bukan `next dev`). `pnpm loadtest`.
4. **E2E hardening** `tests/e2e/payment-webhook.spec.ts`: menambah cakupan jalur **WEBHOOK** publik (POST `/api/webhooks/pakasir`) + **idempotensi**, melengkapi jalur poll. Memakai `E2E_INVITATION_ID_WEBHOOK` terpisah agar tak bentrok (tiap test mengaktifkan undangannya).
**Alasan:** menuntaskan potongan koding tersisa agar R2 = fast-follow siap-pakai, kapasitas launch dapat divalidasi (SPEC §10), dan jalur pembayaran webhook (bukan hanya poll) tercakup uji.
**Ditolak:** `@aws-sdk/client-s3` (dependency besar; berlebihan untuk sekadar PUT/DELETE server-only) · menyimpan URL R2 di DB (langgar kontrak vendor-agnostik #6) · load-test jalur `?g=token` (menulis `first_viewed_at` — ranah uji tulis terpisah).
**Konsekuensi:** +1 dependency `aws4fetch` (mungil, zero-dep). Aktivasi R2 tetap perlu akun R2 + DNS `cdn.merriva.id` (tugas owner). k6 = binary eksternal (bukan dependency npm). E2E webhook tetap **gated** pada kredensial sandbox + undangan uji. `.env.example` diperbarui (`E2E_INVITATION_ID_WEBHOOK`).

## #16 — 2026-08-03 · Chrome marketing dipakai ulang lintas route group via `MarketingShell`; showcase pratinjau tema
**Konteks:** halaman showcase tema publik `/preview/tema/{slug}` (di luar grup `(marketing)`) tampil sebagai bar gelap utilitarian tanpa navbar/brand/CTA — tak selaras dengan situs marketing dan buntu (tanpa konversi maupun navigasi antar-tema).
**Keputusan:**
1. **`MarketingShell`** (`components/marketing/marketing-shell.tsx`) mengangkat chrome marketing (token `.mrv` + font `next/font` + `SiteHeader`/`SiteFooter` + import `marketing.css`) menjadi **satu komponen** yang dipakai layout grup `(marketing)` DAN halaman di luar grup. Font dideklarasikan sekali di shell (hindari instansi ganda). → "navbar seperti halaman utama" = komponen yang sama persis, bukan tiruan.
2. **Showcase** `/preview/tema/{slug}` dibungkus `MarketingShell` + komponen `ThemeShowcase`: plakat (nama tema, chip kategori/tier, CTA "Gunakan tema ini" → /daftar, stepper prev/next dari katalog aktif) di samping **spesimen** ponsel (iframe `?embed=1`, viewport bersarang dipertahankan). Konteks tema/tetangga dari `getActiveThemes()` — **toleran** bila DB tak terjangkau (spesimen tetap tampil dari data file; nama di-humanize dari slug).
3. Pratinjau pemilik `/preview/[id]` & `/preview/demo` **tetap** memakai `PreviewFrame` lama (konteks privat/utilitas, bukan showcase publik) — tak diubah.
**Alasan:** sumber tunggal navbar/footer anti-drift; showcase publik jadi permukaan konversi (CTA + navigasi) alih-alih buntu; spesimen ponsel dipertahankan karena tamu mayoritas buka via WebView WA.
**Ditolak:** memindah `/preview/tema` ke dalam grup `(marketing)` (mengubah struktur URL + memaksa semua preview ikut chrome) · mengubah `PreviewFrame` bersama (berisiko ke preview pemilik yang kebutuhannya beda).
**Konsekuensi:** `marketing.css` bertambah blok `.mrv-show*`; showcase kini menyentuh DB (1 query anon katalog, di-guard `try/catch`); 5 teks baru di `copy.preview`.

## #17 — 2026-08-04 · Kartu tema pakai MOCKUP screenshot asli (bukan spesimen tipografi); pipeline `pnpm thumbs`
**Konteks:** kartu pemilih tema (form buat undangan) & katalog /tema semula teks/spesimen tipografi — kurang meyakinkan untuk keputusan visual pembeli (bandingan: indoinvite.com menampilkan render tema di mockup HP). Pemilik minta "perlihatkan rupa asli tema".
**Keputusan:**
1. **Kartu = mockup 2 ponsel** (`components/theme-mockup.tsx`) berisi screenshot COVER + ISI tema di atas panel warna khas tema (`catalog-meta`). Diterapkan di **form buat undangan** DAN **katalog /tema** (pemilik menerima tradeoff berat gambar di halaman publik).
2. **Sumber gambar = screenshot asli** via skrip ops `scripts/capture-theme-thumbs.mjs` (`pnpm thumbs`): Playwright (channel Edge/Chrome sistem — hindari unduh browser bundel), `reducedMotion` (deterministik), auto-discover tema dari /tema, buka cover-gate (klik tombol pertama di dialog — label beda per tema: "Buka Undangan"/"PUTAR UNDANGAN") lalu scroll untuk "isi". Output JPEG mutu 82 di `public/theme-thumbs/{slug}-{cover,inner}.jpg` (~34 KB/gambar); **Next `<Image>` mengoptimasi ke WebP/AVIF + lazy** saat disajikan (mitigasi LCP /tema).
3. **Anti-drift**: thumbnail = aset yang di-REGEN (`pnpm thumbs`) saat tema berubah — BUKAN dibuat manual. `hasThemeThumb()` (server fs-check) → tema tanpa foto fallback ke poster spesimen (`ThemePoster`/`ThemeThumb`) sehingga tak pernah gambar rusak.
4. **Jujur vs referensi**: TANPA rating bintang palsu (tak ada sistem rating) & TANPA harga per-tema (harga per-paket). Aksi kartu = "Preview" (pratinjau HP live) + "Gunakan Tema".
**Alasan:** rupa asli tema jauh lebih persuasif; pipeline regen menjaga akurasi; Next Image + lazy menahan dampak LCP; fallback spesimen menjaga ketahanan tema baru.
**Ditolak:** spesimen tipografi sebagai tampilan utama (kurang meyakinkan → jadi fallback saja) · iframe live per kartu (10+ iframe = berat) · rating/harga ala referensi (menyesatkan) · pra-konversi WebP via `sharp` di skrip (tak perlu — Next Image sudah mengoptimasi sumber JPEG).
**Konsekuensi:** +20 aset JPEG (~0,7 MB) di repo, wajib `pnpm thumbs` ulang saat visual tema berubah. /tema kini memuat gambar (di-lazy) — pantau Lighthouse mobile saat audit performa. Regen butuh Edge/Chrome sistem (Win11 ada).

## #18 — 2026-08-04 · Pustaka lagu: diisi via unggah admin (bukan seed berkas di repo); picker musik di editor
**Konteks:** infra musik sudah ada sejak M1/M2 (`songs`, `settings.songId`, `resolveMusic`, `<audio>` di cover-gate) tetapi PRAKTIKNYA senyap — tak ada UI memilih lagu di editor & pustaka kosong. Menegakkan #8 (hanya royalty-free) + boundary CLAUDE.md ("jangan musik berhak-cipta", "media via lib/storage + domain sendiri").
**Keputusan:**
1. **Pengisian pustaka = unggah admin**, bukan seed berkas audio di repo. Halaman `/admin/lagu` (+ `server/actions/admin-songs.ts`) mengunggah audio via `lib/storage` → `songs/<sha256>.<ext>` (content-addressed, idempoten) → INSERT `songs`. Audio TIDAK pernah di-commit (bukan cara media disimpan; lisensi = tanggung jawab admin, ditegaskan lewat catatan lisensi di UI). Aksi: tambah / aktif-nonaktif / hapus (hapus objek hanya bila tak dipakai baris lain).
2. **Picker musik di editor** (langkah Pengaturan, semua kategori) → `settings.songId`, dengan pratinjau `<audio>` inline. Lagu aktif dirakit di server (`edit/page.tsx`) jadi `SongOption{url}` (URL domain sendiri) lalu diteruskan lewat `EditorShell` context.
3. **Hardening**: `settings.songId` di-`preprocess` `""`→undefined (opsi "Tanpa musik" tak menggagalkan parse UUID saat autosave) + `setValueAs` di picker.
4. **Bucket tunggal dipertahankan** (SPEC §6.4): bucket `media` diperluas menerima MIME audio + batas 8 MB (migrasi `20260804190000`); validasi per-tipe tetap di aplikasi (foto 2 MB `lib/media`, audio 8 MB `lib/audio`). Prefix path membedakan konten (`inv/…` vs `songs/…`).
**Alasan:** unggah admin = mekanisme berkelanjutan & aman-lisensi tanpa menaruh audio di git; content-addressed = anti-duplikat; picker melengkapi rantai yang sudah ada (resolveMusic → halaman publik/preview) tanpa perubahan di sisi tema.
**Ditolak:** seed berkas audio royalty-free di repo (git bukan tempat media + verifikasi lisensi tak bisa dijamin dari sini) · bucket `songs` terpisah (menyalahi desain bucket-tunggal + menyulitkan driver R2) · upload MP3 oleh klien (tetap ditolak per #8 — hanya admin).
**Konsekuensi:** pustaka mulai KOSONG di production → pemilik wajib mengunggah trek berlisensi lebih dulu agar fitur musik terlihat (lihat `docs/MUSIC-LIBRARY.md`). Batas bucket naik ke 8 MB (backstop foto melonggar; batas ketat foto tetap di aplikasi).

## #19 — 2026-08-08 · Kelola user admin: suspend akun = ban GoTrue; safeguard anti-lockout
**Konteks:** `/admin/pengguna` semula hanya direktori/lookup (audit M4 menandai "kelola user" paling tipis). Dilengkapi mutasi per-user: ubah peran + tangguhkan akun.
**Keputusan:**
1. **Ubah peran** (client↔admin) = update `profiles.role` via service_role + `admin_logs` (pola admin-catalog, bukan RPC — mutasi satu baris, audit best-effort). No-op (peran sama) tak menulis audit.
2. **Tangguhkan akun** = **ban GoTrue** (`auth.admin.updateUserById(id,{ban_duration})`, `banned_until`), memblokir login/refresh. Sengaja BERBEDA dari `admin_suspend_invitation` (moderasi konten undangan) — ini tingkat akun. Status ban dibaca dari `banned_until` (helper `isUserBanned` di luar render → aturan kemurnian React compiler).
3. **Safeguard anti-lockout**: admin tak bisa mengubah/menangguhkan akun SENDIRI (baris sendiri render "Anda", dan action menolak `userId === adminUser.id`); akun ber-peran admin harus diturunkan ke client DULU sebelum bisa ditangguhkan. Karena admin tak bisa menurunkan dirinya sendiri → selalu tersisa ≥1 admin.
**Alasan:** ban GoTrue = mekanisme suspend akun bawaan (tak perlu kolom/enum baru di `profiles`); safeguard mencegah admin mengunci diri/sesama admin secara tak sengaja.
**Ditolak:** kolom status akun sendiri di `profiles` (duplikasi `banned_until`) · RPC atomik untuk ubah peran (berlebihan utk update satu baris) · mengizinkan suspend admin langsung (risiko admin saling-kunci).
**Konsekuensi:** ban tidak langsung mencabut sesi aktif (berlaku saat login/refresh berikutnya) — cukup untuk skala MVP. Aksi mengembalikan ke `/admin/pengguna?msg=` tanpa mempertahankan filter/paginasi (kehilangan minor, dapat diterima).

## #20 — 2026-08-08 · Bundel hardening (temuan security review pra-launch)
**Konteks:** review keamanan pra-launch (5 dimensi, adversarial) → 0 critical/high; inti (webhook, RLS, IDOR, escalation, cron, OAuth) BERSIH. 2 medium + beberapa low/info di anti-abuse & validasi ditutup di kode.
**Keputusan:**
1. **Rate-limit per-JARINGAN** (bukan per-IP penuh): `ipNetworkKey` → IPv6 /64, IPv4 /24 (`client-ip.ts`); rotasi alamat dalam satu blok tak lagi melewati plafon. Overflow Map = eviksi BERTAHAP (sapu kadaluarsa → buang tertua) menggantikan `buckets.clear()` total (yang menolkan counter semua pengunjung).
2. **Rate-limit + Turnstile pada auth**: login/signup/reset di-rate-limit per-jaringan (reset juga per-email, anti bombing → gagal = sukses generik diam-diam, jaga anti-enumerasi); Turnstile pada signup/reset (`TurnstileField`, no-op tanpa site key). Menutup TODO(M2). Slug-check juga di-rate-limit.
3. **Validasi URL**: `youtubeUrl` wajib https + host YouTube resmi via `new URL().hostname` (bukan substring); `livestreamUrl` wajib https (`httpsUrlSchema`); jalur draft menolak skema berbahaya (`noDangerousUrlScheme`, buang whitespace/kontrol dulu) → `javascript:`/`data:`/`file:` tak pernah tersimpan (stored-XSS/SSRF laten ditutup di batas validasi).
4. **Turnstile hostname**: `verifyTurnstile` memvalidasi `hostname` respons siteverify terhadap host aplikasi (`NEXT_PUBLIC_APP_URL`) — token dari origin pihak ketiga ditolak.
5. **Webhook byte cap KERAS**: baca body via stream + hitung byte (batalkan >8KB), tak lagi hanya percaya `Content-Length` (bisa absen pada chunked).
6. **`requireAdmin()` di TIAP page admin** (bukan hanya guard layout) — tutup staleness peran saat soft-nav. Migrasi `20260808130000` mencabut DEFAULT PRIVILEGES anon-SELECT & authenticated-DML untuk tabel MASA DEPAN (footgun RLS-by-default; tabel existing tak terpengaruh — grant eksplisit).
**Alasan:** transformasi provably-setara/non-destruktif; memperkuat lapis anti-abuse & validasi tanpa mengubah perilaku sah. Diverifikasi: 332 test hijau + smoke login/admin/auth.
**Sisa = OPS (LAUNCH-CHECKLIST):** Cloudflare Cache Rule `/api/og/*` (path-only) + WAF rate-limit edge (mitigasi DoS OG), kunci allowed-hostnames widget Turnstile, toggle "Secure password change" + Leaked-Password Protection, review `[auth.rate_limit]/[auth.captcha]` cloud.

---

## #21 — 2026-08-11 · Retensi data UU PDP: cron purge 6 bulan + "hapus undangan" self-service
**Konteks:** audit sisa-pekerjaan menemukan celah kepatuhan: `DATA-MODEL §5` + halaman /privasi PUBLIK menjanjikan data tamu/RSVP/media/gift_notes dihapus 6 bulan pasca-expired, dan `LAUNCH-CHECKLIST` Fase 8 mengklaim keliru "berjalan lewat cron expiry" — padahal `expire-invitations` HANYA membalik status, tak ada purge. Sekaligus aksi "hapus undangan" yang dijanjikan §5 belum ada.
**Keputusan:**
1. **RPC `purge_invitation_data(uuid)`** (service_role, SECURITY DEFINER, `search_path=''`, kunci baris): hapus permanen `rsvps`/`gift_notes`/`guests`/`media`/`invitation_events` + scrub `content='{}'`, set kolom baru `invitations.purged_at`. Baris undangan TETAP sebagai kerangka statistik; `orders` (incl. `raw_notification`, retensi keuangan ≥ 2 tahun) DIPERTAHANKAN. Idempoten via `purged_at`; hanya status `expired`. Return `media_paths` agar pemanggil membersihkan objek storage (SQL tak bisa sentuh bucket).
2. **Cron ke-4 `/api/cron/purge-expired`** (harian): scan `expired` + `purged_at is null` + `active_until < now−6bln` (index parsial `invitations_purge_scan_idx`) → RPC → bersihkan storage (best-effort). Cutoff dihitung `retentionCutoffIso` (diuji unit).
3. **`deleteInvitationAction`** self-service (dashboard, hanya non-aktif): `draft` = HARD-DELETE (cascade, RLS `invitations_delete` mengizinkan draft; tak ada order lunas) · `expired` = purge via RPC (owner tak bisa hapus rsvps/gift_notes via RLS → service_role) menyisakan kerangka + orders. `active`/`pending_payment`/`suspended` ditolak (boundary: jangan hapus undangan aktif). Rate-limited; dashboard menyaring `purged_at`.
**Alasan:** menutup satu-satunya klaim checklist yang tidak benar + menegakkan janji privasi; dua kebutuhan berbagi satu RPC purge (DRY). Kerangka + retensi orders menyeimbangkan hak hapus subjek data (PDP) vs kewajiban retensi keuangan.
**Ditolak:** hard-delete penuh undangan expired (akan cascade-menghapus `orders` lunas → melanggar retensi keuangan); gate waktu 6 bln di dalam RPC (dipindah ke query cron agar user bisa hapus lebih cepat tanpa menunggu).
**Konsekuensi:** kolom `purged_at` menyembunyikan baris dari daftar dashboard; halaman publik undangan ter-purge tetap menampilkan notis kedaluwarsa (content kosong, tak dirender saat expired). Cron ke-4 wajib dijadwalkan saat go-live (LAUNCH-CHECKLIST Fase 3).

---

## #22 — 2026-08-12 · Album Momen (FASE H): add-on kamera sekali pakai — model peserta, aktivasi & fallback encode
**Konteks:** implementasi MOMEN-SPEC (kamera browser + filter film + hidden-until-reveal). Modul inti teruji dipindah dari `handoff/momen/`. Owner mengubah model harga saat survei FASE H.
**Keputusan:**
1. **Harga per PESERTA, bukan per foto** (model satualbum, keputusan owner 12 Agu — deviasi dari MOMEN-SPEC §7 draft yang photo-based). Tier: 5 gratis · 50 Rp199rb · 100 Rp349rb · 200 Rp649rb · ∞ Rp1.099rb. Data model: `momen_albums.quota_peserta` (NULL=∞) + `photo_ceiling` (rem storage tier ∞) gantikan `quota_total`. Peserta = `count(distinct device_id)` yang pernah memotret. `quota_per_guest` default 5 (1–20, host atur).
2. **Add-on = baris `packages` ber-`kind='addon_momen'`** (kolom `kind` baru; `orders.package_id` NOT NULL FK TAK berubah — hindari sentuh tabel uang). Query katalog/harga/admin filter `kind='invitation'`.
3. **Aktivasi bercabang di `activate_paid_order`** (paket add-on → order→paid + buat `momen_albums`, TIDAK sentuh undangan) + `notifyOrderPaid` (email add-on). `verifyAndActivate`, webhook route, poll page **tak berubah** → verifikasi 2 lapis utuh. **Tier gratis** = server action langsung buat album TANPA order/Pakasir (deviasi MOMEN-SPEC §7 "tanpa tier gratis" — owner setuju izinkan). **Catatan rekonsiliasi:** poll page `/bayar` men-short-circuit saat undangan `active` (sinyal statusnya = transisi undangan) sehingga TIDAK merekonsiliasi order add-on (undangan sudah aktif saat beli). Aktivasi add-on utama = **webhook** (+ cron backstop); rekonsiliasi saat tamu kembali dari Pakasir memakai **status ORDER** dan dibangun di halaman kelola album (#8, redirect add-on → `/dashboard/undangan/[id]/momen`) — inti `verifyAndActivate` yang sama, bukan alur bayar kedua.
4. **Kuota confirm-gated**: `momen_confirm_photo` = gerbang ATOMIK (advisory lock album: per-tamu + peserta + plafon). `momen_claim_upload` hanya validasi sesi/album + pra-cek UX. Upload ditolak = objek yatim → purge harian. SECURITY DEFINER (tamu anon; beda dari `insert_gallery_media` INVOKER).
5. **Fallback encode WebP→JPEG** (`lib/image/encode.ts`): `toBlob('image/webp')` tak didukung Safari/iOS → cek `blob.type`, fallback JPEG q0.82. Sekalian menutup bug laten galeri undangan (iOS ditolak `isVariantBlob`). Bucket `media` +`image/jpeg`.
**Ditolak:** tabel `add-ons` terpisah (paksa ubah `orders.package_id` nullable — sentuh tabel uang); reserve-at-claim (lebih kompleks vs orphan-purge); tabel `momen_participants` (cap peserta cukup via `count(distinct device_id)` di RPC — lebih dekat spec asli).
**Konsekuensi:** upgrade kapasitas tier di tengah acara = backlog (§9). `quota_peserta` soft (ganti perangkat = peserta baru, konsisten §6). Modul `shot-quota.ts`/`momen-settings-schema.ts` dipakai apa adanya (tak ditulis ulang); gerbang peserta = kode+test baru.

---

## #23 — 2026-09-04 · Album Momen #8: QR meja (`qrcode`) + unduh ZIP streaming (`client-zip`)
**Konteks:** dashboard host butuh cetak QR meja A6 + unduh ZIP seluruh album (MOMEN-SPEC §5) — dua utilitas tak ada di dependency.
**Keputusan:** tambah `qrcode` (server-side → string SVG; TIDAK masuk bundle klien) untuk halaman QR A6 (`/dashboard/undangan/[id]/momen/qr`, isolasi cetak via `@media print` + `@page A6`). Tambah `client-zip` untuk route `/momen/zip`: ZIP di-STREAM sebagai Web `Response` (STORE, tanpa kompres ulang — WebP/JPEG sudah terkompres) lewat generator async yang menarik foto satu per satu → memori VPS ~1 foto (aman album ≥100, DoD §8). Byte foto diambil via `getStorage().getPublicUrl` + `fetch` → **driver-agnostik** (supabase|r2 pakai jalur penyajian yang sama).
**Ditolak:** hand-roll QR/ZIP (rawan salah lintas alat unzip / scanner); `archiver` (Node stream, lebih berat + perlu konversi ke Web stream); QR via API gambar pihak ketiga (mengirim URL undangan ke luar + langgar boundary "jangan serve media dari URL vendor").
**Konsekuensi:** 2 dep MIT kecil (`qrcode` server-only; `client-zip` ~5KB). ZIP mengandalkan `NEXT_PUBLIC_MEDIA_URL` + bucket publik (sama seperti seluruh penyajian media); foto gagal-fetch dilewati, ZIP tetap terbentuk. context7 tak tersedia sesi ini (butuh auth) → API dipakai dari pengetahuan versi stabil.

---

## #24 — 2026-09-04 · Album Momen: entry point tamu = FAB overlay (bukan ubah kontrak tema)
**Konteks:** DoD §8 minta tombol "Album Momen" muncul di undangan saat add-on aktif; FASE H sengaja TAK menyentuh kontrak tema (boundary: ubah props tema = berdampak semua tema).
**Keputusan:** render tombol melayang (FAB) di halaman undangan publik `[slug]/page.tsx` **DI LUAR** komponen tema (di dalam `GuestPersonalizationProvider`), muncul hanya bila `momen_albums` berstatus `active` (query service_role saat render ISR). NOL perubahan `InvitationData`/kode tema. Aktivasi gratis + webhook add-on me-`revalidatePath('/{slug}')` agar FAB muncul pasca-aktivasi.
**Ditolak:** menambah field `momen` ke `InvitationData` + render di tiap tema (10 tema, blast-radius besar, langgar boundary kontrak tema).
**Konsekuensi:** posisi FAB bawah-tengah universal (bisa bertumpuk dgn kontrol tema tertentu; mudah digeser). Integrasi in-theme yang lebih menyatu = opsi lanjutan bila diinginkan.

---

## #25 — 2026-09-05 · Revalidasi ISR halaman publik saat status undangan berubah
**Konteks:** halaman `/[slug]` disajikan ISR (`revalidate = 3600`). Perubahan status yang terjadi di LUAR aksi pemilik — aktivasi via webhook Pakasir, kedaluwarsa via cron — tidak menyentuh editor, sehingga cache lama bisa bertahan hingga 1 jam: undangan yang baru dibayar tetap tampil sebagai belum aktif, undangan kedaluwarsa tetap tampil normal.
**Keputusan:** setiap jalur yang mengubah status undangan WAJIB memanggil `revalidatePath('/{slug}')` sendiri — bukan mengandalkan TTL. Berlaku di webhook Pakasir (`activated` **dan** `already_paid`; idempoten sehingga aman dipanggil ganda) dan cron `expire-invitations` (per slug yang ter-expire).
**Alasan:** TTL 1 jam adalah jeda yang tak dapat diterima untuk transisi yang dilihat pembeli dan tamu; revalidate eksplisit murah dan deterministik.
**Ditolak:** menurunkan `revalidate` global (mengorbankan seluruh manfaat cache untuk kasus yang jarang); `force-dynamic` pada halaman undangan (melanggar target LCP < 2,5 dtk).
**Konsekuensi:** setiap jalur baru yang mengubah `invitations.status` harus ikut memanggil revalidate. Add-on Album Momen mengikuti pola yang sama untuk kemunculan FAB (#24).
**Catatan:** entri ini ditulis menyusul pada 5 Sep 2026 untuk memulihkan rujukan "DECISIONS #25" yang sudah lebih dulu ada di `src/app/api/webhooks/pakasir/route.ts` dan `src/app/api/cron/expire-invitations/route.ts` (AUDIT-2026-09-04 KUA-8). Keputusannya sendiri sudah berlaku di kode sejak M3.

---

## #26 — 2026-09-05 · Font tema: `preload:false` menyeluruh + Spectral menggantikan Gowun Batang di lumina
**Konteks:** AUDIT-2026-09-04 PER-1 mengukur dari `next-font-manifest.json` bahwa `/[slug]` mem-preload **116 berkas font / 2.034 KB** — font dari SELURUH 10 tema, bukan tema yang dipakai — karena registry tema tergabung dalam satu graph modul halaman. Tema `eternal-rose` sesungguhnya hanya butuh 3 berkas/109 KB. Target proyek LCP < 2,5 dtk di 4G mustahil tercapai selama ini ada.
**Keputusan:** (a) SEMUA instance `next/font` di `src/themes/*` memakai `preload: false`; (b) `lumina` mengganti `Gowun_Batang` → `Spectral`.
**Alasan:** `rel=preload as=font` diambil browser dengan prioritas High dan MELEWATI mekanisme `unicode-range`, jadi seluruh 2 MB terunduh berebut bandwidth dengan LCP. Tanpa preload, `@font-face` + `unicode-range` tetap terbit dan browser hanya mengunduh slice yang benar-benar dipakai. Gowun Batang (font Korea) disajikan Google sebagai 95 slice = 1.465 KB font + 93 KB `@font-face` CSS **render-blocking** padahal konten Merriva seluruhnya Latin — melanggar anggaran Craft "+0KB dari baseline" (`THEME-PORTING.md` §5). Spectral = serif buku layar kontras-rendah, mempertahankan rasa "soft film" lumina dengan 4 berkas.
**Ditolak:** self-host woff2 Gowun Batang ter-subset Latin (tampilan identik, tetapi menambah aset biner + langkah subsetting ke pipeline build); menurunkan jumlah tema (bukan masalahnya).
**Terukur sesudah:** preload `/[slug]` **116 berkas → 0 berkas**; tak ada lagi berkas CSS >47 KB (sebelumnya lumina 103,6 KB, 93,2 KB di antaranya `@font-face`). Prototipe `lumina-craft.html` sengaja TIDAK diubah — ia artefak acuan; penyimpangan dicatat di `THEME-DESIGN.md`.
**Konsekuensi:** teks tema kini memakai fallback sesaat (`display: "swap"` sudah aktif) alih-alih menunggu font ter-preload — trade-off yang benar untuk 4G. Ini perbaikan CEPAT; akar masalahnya (10 tema dalam satu graph modul) tetap perlu pemisahan per-tema, bersama gate `pnpm bundle:report` di CI agar anggaran bisa ditegakkan lagi.

---

## #27 — 2026-09-05 · Security header di `next.config.ts`, bukan di reverse proxy
**Konteks:** AUDIT-2026-09-04 KEA-5 menemukan aplikasi tidak mengirim SATU PUN security header (tanpa HSTS, nosniff, Referrer-Policy, proteksi framing, Permissions-Policy). Konfigurasi Traefik/Easypanel tidak ada di repo sehingga tak dapat direview maupun diuji.
**Keputusan:** header ditetapkan di `next.config.ts` lewat `async headers()` — bukan di reverse proxy. Global: `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()`, `X-Frame-Options: SAMEORIGIN`. Khusus `/dashboard/*` dan `/admin/*`: `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'`. HSTS **hanya production**.
**Alasan:** header ikut versi kode & review, terbawa ke lingkungan mana pun (termasuk `pnpm start` lokal), dan tak bergantung pada konfigurasi infrastruktur yang tak tersimpan di repo. `camera=(self)` WAJIB: Album Momen memakai `getUserMedia`. `SAMEORIGIN` (bukan `DENY`) global karena `PreviewFrame` + `appearance-editor` membingkai `/preview/*` dari dashboard. HSTS digate production agar `next dev` tidak memaksa https pada `localhost` dan mematikan dev server.
**Ditolak:** CSP penuh sekarang (tema memakai style inline; perlu diawali `Report-Only` + inventarisasi — masuk backlog).
**Konsekuensi:** bila reverse proxy kelak menambahkan header yang sama, nilainya bisa ganda — konfigurasi edge harus MENGIKUTI berkas ini, bukan menduplikasinya. Verifikasi: `.next/routes-manifest.json` bagian `headers`.

---

## Template entri baru

```
## #N — YYYY-MM-DD · [Judul keputusan]
**Keputusan:** ...
**Alasan:** ...
**Ditolak:** ... (alternatif + kenapa)
**Konsekuensi:** ... (bila ada dampak teknis/biaya yang harus diingat)
```
