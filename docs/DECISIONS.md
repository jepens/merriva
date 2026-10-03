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
**Konsekuensi:** upgrade kapasitas tier di tengah acara = backlog (§9). `quota_peserta` soft (ganti perangkat = peserta baru, konsisten §6). Modul `shot-quota.ts`/`momen-settings-schema.ts` dipakai apa adanya (tak ditulis ulang); gerbang peserta = kode+test baru. **Ditinjau ulang 13 Sep 2026 (#34):** asumsi "`shot-quota.ts` dipakai apa adanya" ternyata TIDAK terjadi — modul itu tak pernah tersambung ke jalur mana pun, dan modelnya (kuota foto se-album) justru digantikan model peserta yang diputuskan di entri ini. Modul dihapus.

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

## #28 — 2026-09-05 · Rate limit dua lapis: identitas untuk keadilan, jaringan untuk rem banjir
**Konteks:** seluruh proteksi anti-abuse di-key `staticRateKey(aksi, ipNetworkKey(ip))` = satu bucket per /24, tanpa cakupan sumber daya. Di WiFi venue SEMUA tamu tampak sebagai satu alamat publik (diperparah CGNAT operator Indonesia), sehingga plafon berubah makna: bukan "per orang" melainkan "per acara". AUDIT-2026-09-04 PER-3 mengukur akibatnya — hanya 20 tamu/menit bisa memulai sesi Momen dan 60 foto/menit untuk SELURUH acara (kuota default saja 5 foto x 200 tamu = 1.000 foto); dinding ucapan mengembalikan daftar KOSONG diam-diam setelah 40 pemuatan; personalisasi `?g=` berhenti bekerja setelah 30. Album Momen praktis tak terpakai persis di hari-H.

**Keputusan:** pisahkan dua peran yang selama ini ditumpuk pada satu bucket.
1. **Lapis IDENTITAS** = kendali keadilan. Di-key pada `deviceId` (bukan IP). Untuk unggah Momen, `deviceId` diambil dari cookie sesi ber-TANDA-TANGAN (HMAC sudah diverifikasi) → tepercaya. Plafon: unggah 20/menit/perangkat, mulai-sesi 5/menit/perangkat.
2. **Lapis JARINGAN** = rem anti-banjir saja. Tetap per /24 tetapi DI-SCOPE per sumber daya lewat `scopedClientRateKey(aksi, scope)`, dan dilonggarkan seukuran satu resepsi: sesi 150/menit, unggah 900/menit, baca dinding 600/menit, personalisasi 300/menit.

Keduanya harus lolos. Penolakan rate limit kini juga DAPAT DIBEDAKAN dari "tidak ada data": `getGuestbookAction` mengembalikan `rateLimited: true` dan `viewGuestByTokenAction` mengembalikan `{status:"rate"}` — UI menampilkan "coba lagi", bukan "belum ada ucapan".

**Alasan:** plafon per-jaringan tak bisa sekaligus longgar (agar venue jalan) dan ketat (agar satu penyalahguna terhenti) — itu dua tujuan berbeda yang butuh dua kunci berbeda. Men-scope kunci jaringan per sumber daya membuat pelonggaran aman: satu acara ramai tak lagi menghabiskan jatah acara lain yang kebetulan sejaringan. Urutan pemeriksaan disusun dari yang termurah: Zod (tanpa I/O) → limiter in-memory → Turnstile → DB.

**Ditolak:** menaikkan plafon per-jaringan saja (menghilangkan rem terhadap satu penyalahguna); memakai cookie sesi untuk baca dinding/personalisasi (tamu belum tentu punya sesi; keduanya jalur baca publik); pindah ke Redis sekarang (limiter in-memory masih memadai untuk MVP satu instance — lihat catatan R-1 audit).

**Konsekuensi:** `deviceId` pada MULAI SESI masih dari form dan dapat dirotasi, jadi lapis identitas di sana bersifat best-effort — gerbang bot sesungguhnya tetap Turnstile, dan rotasi deviceId untuk menguras kuota PESERTA tetap temuan terbuka (KEA-4). Kunci jaringan di-scope pakai `slug` (bukan `albumId`) agar tak perlu query untuk membentuk kunci; memvariasikan slug memberi bucket berbeda, tetapi jalur mahal (DB + storage) tetap terkunci di belakang sesi terverifikasi + plafon per-perangkat. Saat pindah multi-instance (M4+), lapis identitas HARUS ikut pindah ke store bersama — kalau tidak, plafon terbagi diam-diam sebanyak jumlah replika. Kardinalitas kunci juga naik tajam: dulu ~1 kunci per jaringan, kini ~2 kunci per PERANGKAT aktif (sesi + unggah). Dengan `MAX_KEYS = 20.000` di `lib/rate-limit.ts`, batas praktisnya ~10 ribu perangkat per jendela 60 detik; di atas itu evictor membuang kunci tertua sehingga sebagian penghitung ter-reset — plafon melemah (degradasi jinak), bukan menolak tamu sah. Jauh di atas skala saat ini, tetapi wajib ditinjau bersama pemindahan ke Redis.

---

## #29 — 2026-09-05 · Add-on Momen: jalur aktivasi otoritatif kedua berkunci pada status ORDER
**Konteks:** jalur undangan punya TIGA lapis aktivasi — webhook Pakasir, poll `checkPaymentStatusAction` saat pembeli kembali dari Pakasir, dan cron rekonsiliasi. Add-on Album Momen hanya punya webhook. Penyebabnya struktural, bukan kelalaian: `checkPaymentStatusAction` berkunci pada status UNDANGAN dan `return { status: "active" }` lebih dulu bila undangan sudah aktif — sedangkan pembeli add-on undangannya SELALU `active` (itu syarat checkout-nya). Akibatnya order add-on tak pernah direkonsiliasi poll, sehingga aktivasi bergantung PENUH pada webhook yang TANPA signature dan bisa hilang, dengan backstop cron baru 24 jam kemudian (AUDIT-2026-09-04 KUA-2b). Wajah UX-nya: pemilik yang baru membayar hanya melihat halaman diam (UXA-7).

**Keputusan:** tambah `checkMomenPaymentStatusAction` yang berkunci pada **keberadaan ALBUM** (kondisi berhenti) dan **status ORDER** (apa yang direkonsiliasi) — bukan status undangan. Ia memakai inti `verifyAndActivate` yang SAMA, dipasang di halaman kelola album lewat `MomenPaymentPoller` yang mencerminkan poller undangan.

**Alasan:** verifikasi 2-lapis adalah invarian keamanan yang tak boleh diduplikasi — karena itu HANYA pemilihan kondisi yang berubah, bukan cara verifikasinya. `transactiondetail` OTORITATIF tetap satu-satunya yang boleh mengaktifkan; poll sendiri tak pernah cukup. `redirectUrl` Pakasir memang sudah mengarah ke halaman kelola album, jadi pemasangan poller di sana melengkapi alur yang sudah ada tanpa rute baru.

**Ditolak:** melonggarkan early-return di `checkPaymentStatusAction` agar ikut menangani add-on (mencampur dua siklus hidup berbeda dalam satu aksi — undangan punya `suspended`/`held`/masa-aktif, add-on tidak); mempercepat cron backstop (mengobati gejala, dan tetap menyisakan jendela diam bagi pembeli).

**Konsekuensi:** `paid` tanpa album kini punya state eksplisit `review` — poll TIDAK mencoba memperbaikinya sendiri karena itu anomali yang butuh mata manusia (mis. order dari era sebelum KUA-2a ditutup, ketika album tier gratis yang dibuat lebih dulu membuat `create_momen_album` menjadi no-op). Kuitansi tetap hanya pada transisi `activated` (RPC mengunci baris → hanya satu pemenang), jadi webhook dan poll yang berlomba tak mengirim email ganda. Poll berhenti otomatis setelah ~6 menit; webhook & cron tetap bekerja di latar.

---

## #30 — 2026-09-05 · Anggaran bundle ditegakkan dari manifest Next, bukan dari output `next build`
**Konteks:** `docs/THEME-PORTING.md` §4 menetapkan anggaran gzip per tier tema dengan instruksi "cek `next build` output per route". Sejak Next 16 + Turbopack, tabel First Load JS **tidak lagi dicetak**, sehingga anggaran itu berhenti bisa ditegakkan — tanpa ada yang menyadarinya. Akibat langsungnya terukur di AUDIT-2026-09-04: `/[slug]` tumbuh menjadi 116 berkas font (2.034 KB) dan 13 stylesheet render-blocking dari KESEPULUH tema, bukan hanya tema yang dipakai. Ketiadaan alat ukur inilah sebab PER-1/PER-2/PER-5 lolos melewati berbagai commit dan review.

**Keputusan:** `scripts/bundle-report.mjs` (`pnpm bundle:report`) membaca **manifest resmi Next** — `entryCSSFiles`/`entryJSFiles` dari `page_client-reference-manifest.js` dan `next-font-manifest.json` per route — lalu melaporkan CSS gzip, JS gzip, dan byte font ter-preload per route. `--check` keluar non-nol bila anggaran di `BUDGETS` terlampaui, dan dipasang sebagai langkah CI **setelah** build.

**Alasan:** angka harus berasal dari apa yang Next benar-benar emit sebagai `<link>`/`<script>` untuk route itu, bukan dari penjumlahan berkas di `.next/static` (yang mencampur seluruh route) apalagi dari perkiraan. Membaca manifest membuat laporan tetap sahih meski format output CLI Next berubah lagi.

**Ditolak:** `@next/bundle-analyzer` (butuh webpack; proyek memakai Turbopack, dan keluarannya visual — tak bisa jadi gerbang CI); menjumlahkan ukuran `.next/static` (tidak per-route); mengandalkan Lighthouse CI (butuh server berjalan + jauh lebih lambat; berguna sebagai pelengkap, bukan pengganti).

**Konsekuensi:** angka awal `BUDGETS` sengaja ditaruh SEDIKIT di atas kondisi saat ini agar gerbang menangkap pertumbuhan BARU alih-alih langsung merah — nilainya wajib DITURUNKAN seiring perbaikan struktural, kalau tidak ia hanya membekukan keadaan yang buruk. Gerbang ini mengukur byte, bukan waktu: ia tidak menggantikan pengukuran LCP nyata, yang tetap butuh Docker/staging (di Windows lokal server standalone tak bisa bind port).


**Ditinjau ulang 13 Sep 2026:** langkah CI `Anggaran bundle` **BELUM PERNAH berjalan** sejak dipasang — ia di-*skip* karena langkah Build di `main` merah sejak `c446101` (30 Jul 2026, M4.3): pra-render statis `/`, `/harga`, `/tema` membaca katalog Supabase lewat `createSupabasePublicClient`, sedangkan CI tak punya `NEXT_PUBLIC_SUPABASE_URL`. Klaim "dipasang sebagai langkah CI" benar secara konfigurasi, tetapi belum efektif. Repo privat pada paket gratis tak mendukung branch protection, jadi CI merah tak memblokir push — itulah sebabnya kegagalan selama 6 minggu tak terlihat. **Diselesaikan #36:** sejak run `34734389665` (percobaan 3, commit `bf8fdef`, 13 Sep 2026) Build CI hijau dan gerbang benar-benar berjalan — 37 route diukur, "Semua route dalam anggaran". Karena CI merah tetap tak memblokir push, hasil run wajib dicek setelah push.

---

## #31 — 2026-09-05 · CSS tema keluar dari graph modul JS → aset statis ber-hash isi
**Konteks:** AUDIT-2026-09-04 PER-2/PER-5 mengukur `/[slug]` mengirim **13 stylesheet render-blocking / 57,2 KB gz** pada setiap pembukaan undangan — CSS KESEPULUH tema, padahal satu undangan hanya memakai satu (±3–5,5 KB gz). Penyebabnya bukan salah pakai: `src/themes/registry.ts` sudah memakai `import()` dinamis, tetapi dokumentasi Next menyatakan dynamic import sebuah **Server Component** hanya me-lazy-load Client Component ANAK-nya, dan `getLinkAndScriptTags` berkunci pada path entry halaman (`entryCSSFiles["…/[slug]/page"]`). Selama CSS tema melewati graph modul JS halaman, ia SELALU ikut ter-emit. Ini batas framework, bukan konfigurasi yang salah.

**Keputusan:** keluarkan CSS tema dari graph modul. `scripts/build-theme-css.mjs` menyalin `src/themes/{slug}/*.css` ke `public/themes/{slug}.{hash-isi}.css` dan menghasilkan `src/themes/theme-css.generated.ts`; `<ThemeStyles slug>` meng-emit `<link rel="stylesheet" precedence="theme">` HANYA untuk tema yang dipakai. Skrip berjalan otomatis pada `pnpm dev`, `pnpm build`, dan `pnpm typecheck`. Nama ber-hash isi → `Cache-Control: immutable` di `next.config.ts`.

**Alasan:** sumber kebenaran CSS TIDAK pindah — penulis tema tetap mengedit `src/themes/{slug}/*.css` seperti biasa; yang berubah hanya cara pengirimannya. `precedence` membuat React menaikkan `<link>` ke `<head>`, men-dedup, dan MENUNGGU stylesheet termuat sebelum konten tampil, sehingga tak ada kedipan tanpa gaya. Minifikasi tak diperlukan: sumber CSS ke-10 tema ter-gzip **42 KB** versus **45,1 KB** hasil bundler (selisihnya `@font-face` dari next/font) — jadi tak ada dependency minifier baru.

**Terukur sesudah:** `/[slug]` CSS render-blocking **57,2 → 25,9 KB gz** (13 → 12 berkas; −31,3 KB gz). Verifikasi visual: `eternal-rose`, `prisma`, `meridian` identik piksel sebelum/sesudah, dan `/andi-sinta-demo` memuat **tepat satu** `/themes/*.css`, termasuk section di bawah cover.

**Ditolak:** `next/dynamic` (dokumentasi Next eksplisit: tak memecah Server Component itu sendiri); route handler penyaji CSS (biaya CPU per request + butuh header cache manual, tanpa keuntungan atas `public/`); memindahkan `next/font` sekaligus (menghapus sisa 12,7 KB gz `@font-face`, tetapi menyentuh sistem pasangan font kustomisasi `fontPairs` a/b/c di 6 tema — pekerjaan terpisah).

**Konsekuensi:** kontrak penulisan tema BERUBAH — tepat satu CSS di akar folder tema, tanpa `import "./x.css"`, dan pemanggil wajib merender `<ThemeStyles>` (didokumentasikan di THEME-PORTING §3b; skrip gagal keras bila ada >1 CSS di akar). CSS tema kini di luar pipeline PostCSS/Lightning Next: aman karena CSS tema polos (tanpa direktif Tailwind — diverifikasi), tetapi tema baru TIDAK boleh memakai `@apply`. `public/themes/` di-gitignore (dibuat ulang saat dev/build); `theme-css.generated.ts` di-commit mengikuti konvensi `demo-photos.generated.ts`. Sisa 12,7 KB gz `@font-face` masih render-blocking.

---

## #32 — 2026-09-13 · Galeri Momen: paginasi KEYSET + angka ringkasan dari agregat DB
**Konteks:** AUDIT-2026-09-04 PER-4 — `/{slug}/momen` adalah route publik `force-dynamic` (TAK PERNAH ter-cache) yang menarik SELURUH baris foto album tanpa `limit`, lalu menurunkan angka ringkasan dari daftar itu (`photos.length`, `new Set(guestName).size`). Album 500 foto ≈ 150 KB payload per pembukaan + 500 node `<img>`; 200 tamu membuka bersamaan ≈ 100.000 baris terbaca dan ~30 MB egress dari satu instance — tepat di hari acara. Dashboard memuat seluruh album termasuk foto tersembunyi.

**Keputusan:** (1) baca ber-halaman lewat `fetchMomenPhotos` dengan **kursor keyset** pada `created_at` (`created_at < cursor`, ambil `limit + 1` untuk mendeteksi halaman berikutnya tanpa query hitung), memakai index `momen_photos_album_created_idx (album_id, created_at)` yang sudah ada; (2) angka ringkasan pindah ke RPC agregat baru `momen_album_stats(album_id)` — satu query, payload konstan.

**Alasan:** begitu daftar tak lagi utuh, menurunkan "50 foto oleh 7 fotografer" dari daftar yang termuat menjadi SALAH — subjudul akan berbunyi "40 foto" pada album 50 foto. Agregat harus datang dari tempat yang melihat seluruh baris, yaitu DB. Keyset dipilih di atas OFFSET karena biayanya tidak tumbuh linear dan tidak melompati baris pada feed hidup (foto baru masuk saat tamu memuat halaman berikutnya). Klien tetap men-dedup by id: foto yang baru diunggah tamu sendiri disisipkan lokal dan bisa tumpang-tindih dengan halaman berikutnya.

**Semantik `momen_album_stats` sengaja dibedakan:** `photographer_count` hanya menghitung foto `visible` (foto yang disembunyikan host tak boleh menambah angka yang dilihat tamu), sedangkan `participant_count` menghitung `device_id` unik tanpa memandang status — itu UNIT YANG DIJUAL dan harus selaras persis dengan `momen_claim_upload` yang menegakkan `quota_peserta` (menyembunyikan foto tidak mengembalikan jatah peserta).

**Ditolak:** `count: "exact"` terpisah per angka (dua-tiga round-trip, dan `count(distinct …)` tak bisa diungkapkan lewat PostgREST); memuat kolom `guest_name` seluruh album untuk dihitung di aplikasi (tetap O(N) lewat kabel — persis yang hendak dihindari); paginasi OFFSET (biaya linear + lompat baris).

**Konsekuensi:** `loadMomenPhotosAction` adalah aksi PUBLIK, jadi gerbang fase reveal diperiksa ULANG di dalamnya — ia tak boleh bergantung pada halaman yang memanggilnya; pra-reveal mengembalikan daftar kosong berapa pun kursor yang dikirim klien (diuji). Dashboard dibatasi `?foto=N` (server-rendered, tanpa state klien) dengan plafon keras 400 per render. Sekalian PER-7: detak 1 detik kini BERHENTI setelah reveal — sebelumnya React mendiff seluruh grid tiap detik selamanya.

---

## #33 — 2026-09-13 · Moderasi Album Momen: pencabutan akses bergantung FASE
**Konteks:** AUDIT-2026-09-04 KEA-3. Bucket `media` dibuat `public = true` dan objek diunggah ber-`cacheControl: 31536000`. Setelah reveal, URL foto dipancarkan ke SETIAP pengunjung tanpa autentikasi. Ketika host memoderasi foto sensitif dengan "Sembunyikan", cabang `hide` hanya `update({ status })` — barisnya hilang dari galeri tetapi **objeknya tetap melayani 200 selamanya** dan tertahan di cache CDN/browser hingga setahun. UI memberi kesan foto sudah tak dapat diakses; itu tidak benar.

**Nuansa yang menentukan keputusan:** menghapus objek pada SETIAP "Sembunyikan" terlalu kasar. Pra-reveal, URL foto **belum pernah** publik (jalur baca tamu fail-closed pada fase), sehingga menyembunyikan di sana adalah penyortiran biasa — menghancurkan berkas tamu untuk itu berlebihan, dan mematikan tombol "Tampilkan" yang sah dipakai host saat menyortir sebelum acara dibuka.

**Keputusan:** perilaku "Sembunyikan" bergantung fase album.
* **Pra-reveal** → hanya penanda `status='hidden'`; objek dipertahankan; dapat ditampilkan kembali.
* **Pasca-reveal** → `status='hidden'` **DAN** objek storage dihapus, dengan `momen_photos.purged_at` dicatat. Permanen; "Tampilkan" tak lagi ditawarkan (UI menghilangkan tombolnya, server menolak aksinya). Konfirmasi eksplisit sebelum tindakan.

Baris foto SELALU dipertahankan (bukan dihapus): metadata, jatah jepret per tamu, dan hitungan peserta tetap konsisten — moderasi tidak mengembalikan jatah yang sudah terpakai.

**Kenapa kolom, bukan inferensi:** menebak "objek sudah dihapus?" dari fase album SALAH. Foto yang disembunyikan pra-reveal masih punya objek utuh, dan album yang kemudian ter-reveal tidak boleh membuatnya tampak terhapus. `purged_at` ditulis SEBELUM penghapusan storage: bila proses mati di tengah, foto tetap ditandai tercabut (fail-closed) alih-alih tampak masih dapat dipulihkan.

**Ditolak:** signed URL / route proxy berumur pendek dengan bucket privat (paling kuat — pencabutan seketika dan sekalian menutup kelemahan pra-reveal yang kini bersandar pada "path UUID tak tertebak" — tetapi butuh migrasi seluruh objek yang sudah ada, dukungan signed URL di KEDUA driver storage `supabase|r2`, dan mengubah setiap thumbnail menjadi request ber-tanda-tangan; tetap opsi yang benar bila kelak dibutuhkan); menghapus objek pada setiap "Sembunyikan" (moderasi jadi satu arah, merugikan penyortiran pra-reveal).

**Konsekuensi & batas yang JUJUR:** ini mencabut akses BARU. Cache CDN/browser yang sudah terlanjur menyimpan objek tetap hidup sampai TTL-nya habis, dan siapa pun yang sudah melihat foto bisa saja sudah menyimpannya — tak ada mekanisme yang bisa membatalkan itu. Copy konfirmasi sengaja menjanjikan "tautannya tak bisa dibuka lagi", bukan "fotonya hilang dari mana pun".

---

## #34 — 2026-09-13 · `shot-quota.ts` dihapus; gerbang fase tamu disatukan
**Konteks:** AUDIT-2026-09-04 KUA-6. `grep` membuktikan `canCapture`/`remainingForDevice`/`remainingTotal`/`canViewPhotos` hanya muncul di definisinya sendiri dan di `momen-logic.test.ts` — **nol pemakaian produksi**. Sekitar 9 test hijau memberi rasa aman untuk logika yang tak pernah dijalankan, sementara jalur nyata tak ter-test.

Audit menyarankan "sambungkan ke jalur nyata (opsi terbaik) ATAU hapus". Penelusuran menunjukkan opsi pertama tidak berlaku untuk `shot-quota.ts`: modelnya **sudah digantikan**, bukan sekadar terduplikasi. `QuotaState` mengenal `quotaTotal` (kuota foto se-album) dan hanya dua alasan tolak (`album-full`, `guest-quota`), sedangkan yang dijual adalah **peserta** (`quota_peserta` = `device_id` unik) dengan `photo_ceiling` sebagai rem biaya storage — dan alasan `peserta-penuh` tidak ada sama sekali di modul itu. "Menyambungkan" berarti menulis ulang seluruhnya. Lagi pula tak ada representasi TypeScript kedua untuk disatukan: otoritas kuota ada di SQL (atomik, advisory-lock), dan klien hanya MENAMPILKAN `remaining` yang dikirim server.

**Keputusan:**
1. **Hapus `src/lib/momen/shot-quota.ts`** beserta test-nya. Membiarkannya lebih buruk daripada tak ada: kontributor berikutnya bisa menyambungkannya dan mendapat aturan yang salah.
2. **Pertahankan & SAMBUNGKAN gerbang fase**, tetapi sebagai `canGuestViewPhotos(phase)` — parameter `isOwner` dibuang karena tak ada satu pun pemanggil yang mengirim `true`. Dipakai kedua jalur baca tamu: render awal `/{slug}/momen` dan `loadMomenPhotosAction`.
3. **Ganti test logika mati dengan test jalur NYATA:** pemetaan alasan penolakan RPC → copy tamu (satu-satunya representasi aturan kuota di TS), termasuk invarian bahwa `guest-quota`, `peserta-penuh`, dan `album-full` menghasilkan pesan BERBEDA, dan alasan tak dikenal tidak membocorkan string mentah.

**Alasan membuang `isOwner`:** akses pemilik dipisahkan secara STRUKTURAL, bukan lewat flag — dashboard adalah route terautentikasi yang memverifikasi kepemilikan lalu membaca via service_role tanpa gerbang fase sama sekali (host memang harus memoderasi pra-reveal). Parameter boolean yang selalu `false` di setiap pemanggil adalah beban mati yang mengundang salah pakai: satu `true` yang keliru akan membocorkan foto pra-reveal.

**Ditolak:** menulis ulang `shot-quota.ts` ke model peserta (akan MENCIPTAKAN representasi kedua aturan yang otoritasnya ada di SQL — persis risiko yang hendak dihindari); membiarkannya dengan komentar "belum dipakai" (test-nya tetap menghijaukan logika yang salah).

**Konsekuensi:** jumlah test turun (467 dari 469) tetapi yang tersisa mengukur kode yang benar-benar berjalan. Bila kelak dibutuhkan pratinjau pemilik pada route publik, gerbangnya ditambahkan kembali secara eksplisit di `canGuestViewPhotos` — bukan dengan menghidupkan lagi flag yang dorman.

---

## #35 — 2026-09-13 · Bake filter Momen di Web Worker (tanpa OffscreenCanvas) + halation hemat memori
**Konteks:** AUDIT-2026-09-04 PER-6. `getImageData` → `applyFilmToPixels` → `putImageData` berjalan sinkron di main thread: foto 1600×1200 = 1,9 juta piksel × ±40–50 operasi float (60–95 juta operasi) dalam SATU task — tombol rana tampak beku tepat saat tamu memotret. Preset `senja` (satu-satunya ber-halation) memanggil `boxBlur1(boxBlur1(mask))` sehingga lima buffer `Float32Array` seukuran foto hidup bersamaan (≈38 MB pada 1600×1200) — berisiko crash tab di HP RAM 2 GB, bersama ImageBitmap foto aslinya.

**Keputusan:**
1. **Hanya matematika piksel yang pindah ke Web Worker** (`src/lib/momen/film.worker.ts`). API kanvas (`getImageData`/`putImageData`/`toBlob`) tetap di main thread; buffer piksel DI-TRANSFER (nol salinan) pergi-pulang.
2. **Satu fungsi pemroses** `runBakeRequest` dipakai worker DAN fallback main thread → kedua jalur mustahil menghasilkan foto berbeda.
3. **Fallback menyeluruh** (`film-bake.ts`): `Worker` tak tersedia, konstruksi melempar, worker error, diam >20 detik, `postMessage` melempar, atau respons gagal → main thread. Worker yang error/timeout ditandai rusak dan tak dibuat ulang selama sesi.
4. **Fallback tanpa redraw:** kontrak `read()` boleh dipanggil ulang — kanvas belum diubah sampai `putImageData`, jadi foto kamera TIDAK berganti ke frame video berikutnya saat worker gagal.
5. **Halation 5 → 3 buffer** via `boxBlur1Into` (tanpa alokasi, scratch dipakai ulang) — ≈38 MB → ≈23 MB pada 1600×1200 (aritmetika), hasil BYTE-IDENTIK.

**Bukti:**
* **Golden hash** direkam dari implementasi SEBELUM perubahan (6 preset × 2 ukuran, 12 hash unik; pola uji sengaja memuat titik sangat terang agar halation aktif). Jalur main thread & jalur worker sama-sama cocok byte-per-byte (`film-render.golden.test.ts`).
* **Build:** Turbopack mengemit chunk worker terpisah 4,4 KB (tanpa React); JS `/[slug]/momen` naik ±0,1 KB gz.
* **Browser nyata** (Chrome, dev server lokal, foto 1064×1600, filter `hangat` bawaan album, `window.Worker` diinstrumentasi): jalur worker — worker dibuat dari chunk `film.worker.ts`, 1 pesan keluar / 1 masuk / 0 error, **0 long task** selama bake+encode+unggah (767 ms total). Pembanding dengan `Worker` dimatikan — fallback bekerja (unggah sukses), **satu long task 110 ms** (525 ms total). Kedua foto tersimpan utuh di DB (1064×1600).

**Batas yang JUJUR:** (a) jalur worker ±240 ms LEBIH LAMBAT secara total pada bake pertama — biaya memuat chunk worker & transfer buffer; yang dihapus adalah PEMBEKUAN UI, bukan waktu tunggu. (b) Angka di atas dari CPU desktop tanpa throttling; di HP menengah-bawah blokir main thread diperkirakan membesar kira-kira sebanding kecepatan CPU — perkiraan, BELUM diukur. (c) Preset `senja` (terberat) belum diukur di browser; penghematan memorinya adalah aritmetika ukuran buffer.

**Ditolak:** `OffscreenCanvas` di worker (baru didukung Safari 16.4, sedangkan tamu banyak membuka lewat WebView WhatsApp iOS lama — dan tak diperlukan: worker cukup menerima `ArrayBuffer`); menurunkan `DISPLAY_MAX` ke 1200 seperti saran audit (melanggar varian 1600px yang didokumentasikan di CLAUDE.md/SPEC — keputusan produk, bukan tambalan performa); menghitung halation pada ½ resolusi (mengubah tampilan preset — golden hash akan berubah).

**Konsekuensi:** kontrak `read()` — kanvas sumber tak boleh diubah sebelum bake selesai. Mengubah tampilan preset secara SENGAJA wajib merekam ulang golden hash dan menyebutnya eksplisit di commit; preset BARU menggagalkan test cakupan golden sampai hash-nya ditambahkan.

---

## #36 — 2026-09-13 · Build CI memakai secret Supabase publik, bukan katalog kosong
**Konteks:** CI di `main` merah di langkah **Build** sejak `c446101` (30 Jul 2026, M4.3) — ditemukan 13 Sep 2026, ±56 run kemudian. Pra-render statis `/`, `/harga`, `/tema` memanggil `getActivePackages`/`getActiveThemes` lewat `createSupabasePublicClient`, sedangkan CI tak punya `NEXT_PUBLIC_SUPABASE_URL`. Semua langkah sesudah Build (termasuk gerbang `Anggaran bundle`, #30) ter-*skip* diam-diam. Repo privat paket gratis tak mendukung branch protection, jadi CI merah tak pernah memblokir push.

Dua niat tertulis bertabrakan: `src/server/marketing/catalog.ts` sengaja **gagal-keras** saat query gagal agar katalog/harga kosong tak pernah ter-cache statis (kontrak SPEC §4.1 "harga SELALU dari packages"), sementara komentar `src/lib/env.ts` menyatakan build/CI tanpa env tak akan gagal — anggapan yang patah sejak M4.3.

**Keputusan (dipilih pemilik):** pertahankan gagal-keras `catalog.ts`; beri CI akses baca Supabase lewat GitHub Actions secret `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`, diteruskan hanya ke langkah Build. Langkah `Cek secret build` gagal cepat dengan pesan yang menunjuk entri ini bila secret belum dipasang. Komentar `env.ts` dikoreksi.

**Alasan:** URL & anon key memang publik by design (ter-inline di setiap bundle browser; akses dibatasi RLS — anon hanya SELECT `packages`/`themes` aktif) — BUKAN service role. Dengan env nyata, build CI setara build produksi Docker (yang juga butuh Supabase terjangkau saat build), sehingga gerbang anggaran mengukur halaman marketing sungguhan, bukan versi kosong.

**Ditolak:** katalog kosong bila `CI` di-set & env tak ada (mengesampingkan keputusan gagal-keras yang ditulis sengaja, dan gerbang anggaran akan mengukur halaman marketing kosong); `continue-on-error` pada Build (menyembunyikan kegagalan — persis penyebab 6 minggu tak terlihat); `force-dynamic` pada halaman marketing (membuang ISR demi CI).

**Konsekuensi:** CI kini bergantung pada project Supabase cloud yang terjangkau — bila cloud down, Build CI merah (sama seperti build deploy). Secret dipasang pemilik di Settings › Secrets and variables › Actions (atau `gh secret set`). Karena branch protection tak tersedia, hasil CI WAJIB dicek setelah push (`gh run list --branch main`); jangan mengklaim "berjalan di CI" tanpa melihat run nyata.

**Terverifikasi 13 Sep 2026:** run `34734389665` percobaan 3 (`bf8fdef`) hijau di semua langkah — 539 test lulus, 26/26 halaman ter-pra-render dengan katalog nyata (`/harga`, `/tema` statis, revalidate 1 jam), dan gerbang `Anggaran bundle` mengukur 37 route tanpa pelanggaran. Percobaan 1–2 gagal di `Cek secret build` karena secret belum lengkap — langkah itu bekerja sesuai niat.

---

## #37 — 2026-09-13 · `cf-connecting-ip` hanya dipercaya dari peer Cloudflare yang dicatat Traefik
**Konteks:** AUDIT-2026-09-04 KEA-1 — `resolveClientIp` mempercayai `cf-connecting-ip` tanpa syarat. Siapa pun yang menemukan IP origin bisa mengirim nilai acak per request → bucket rate limit baru tiap request → brute-force login, banjir sesi/unggah Momen, dan flood lain lolos sekaligus. Konfigurasi edge produksi (Traefik Easypanel, firewall VPS) tidak ada di repo.

**Keputusan:**
1. Peer = entri **paling kanan** `X-Forwarded-For` saja. Traefik tersambung langsung ke kontainer app dan selalu menambahkan `RemoteAddr`-nya di ujung kanan (`rewriteRequestBuilder`); Next 16 hanya mengisi XFF bila kosong (`base-server.js`, `??=`). Entri di kiri peer tak pernah ditelusuri.
2. Peer publik di rentang Cloudflare → `cf-connecting-ip`. Peer publik lain → peer itu; `cf-connecting-ip` dan `x-real-ip` diabaikan (`cf-rejected` bila header Cloudflare ikut dikirim).
3. Peer internal/tak ada/tak dikenali → urutan lama (`cf-connecting-ip` → `x-real-ip` → entri kanan XFF), ditandai `unverified`. Production mencatat `console.warn` `[client-ip]` sekali per proses, tanpa nilai IP.
4. Parser IP/CIDR sendiri (`src/lib/ip-cidr.ts`, tanpa dependency). Rentang disimpan di `src/lib/cloudflare-ips.json` dan dicocokkan **harian** dengan API resmi oleh workflow terjadwal `.github/workflows/cloudflare-ips.yml`.

**Alasan:** hanya nilai yang ditulis Traefik sendiri (peer) yang tak bisa dipalsukan klien. Mencocokkan peer dengan rentang Cloudflare menyaring akses langsung ke origin dari luar Cloudflare, tetapi BUKAN autentikasi (lihat Konsekuensi). Review adversarial (4 lensa + skeptis, semua menjalankan kode asli) menemukan desain awal — menelusuri XFF dari kanan sambil melewati hop internal — justru membuka celah: bila peer Traefik internal dan Traefik mempercayai header masuk, entri tulisan klien menjadi "peer" (merotasi bucket, meniru /24 korban, menyamar sebagai edge Cloudflare). Parser diuji silang dengan `node:net` (500.267 input, 0 selisih).

**Ditolak:** fail-closed ke satu bucket bersama saat peer tak terverifikasi (salah pasang topologi — mis. port Traefik mode *ingress* Swarm yang menghilangkan IP sumber — akan mengunci SELURUH pengunjung dari login; kondisi itu dibuat terlihat lewat log dan ditutup lewat ops); melewati hop internal (lihat Alasan); env `TRUSTED_PROXY_HOPS` (hanya ada satu proxy; konfigurasi tambahan = cara baru salah pasang); library IP (parser ±150 baris cukup dan teruji); cek rentang di CI push (gangguan API Cloudflare memerahkan push tak berhubungan, dan rentang bisa berubah saat repo sepi); regex atas berkas TS (entri yang dikomentari ikut terbaca).

**Konsekuensi:** kode menolak `cf-connecting-ip` palsu dari luar Cloudflare **bila** Traefik melihat IP sumber publik dan menambahkan XFF. KEA-1 baru **tertutup penuh** dengan Authenticated Origin Pulls per-zona yang ditegakkan Traefik: rentang IP bukan autentikasi — pelanggan Cloudflare mana pun (Worker `connect()`, zona proxied milik mereka) tersambung dari rentang yang sama, menulis `cf-connecting-ip` sendiri, dan lolos sebagai `cloudflare` tanpa log; firewall rentang Cloudflare pun tak menghalanginya (ditemukan re-verifikasi adversarial). Langkah ops lengkap di LAUNCH-CHECKLIST Fase 6: baca langsung konfigurasi Traefik (mode publish port, `forwardedHeaders`, `notAppendXForwardedFor` — log kosong saja bukan bukti), firewall origin, AOP per-zona, dan uji spoof LANGSUNG ke origin (uji lewat domain tak membuktikan apa pun karena Cloudflare menimpa header itu). Daftar basi = pengunjung dari edge baru berbagi bucket per IP edge — begitu workflow terjadwal merah, perbarui `cloudflare-ips.json` DAN allowlist firewall bersamaan. Belum ditangani (terpisah dari KEA-1, sudah ada sebelumnya): lewat Cloudflare yang sah, satu blok IPv6 /48 memberi 65.536 bucket /64 — ditangani #38.

---

## #38 — 2026-09-14 · Rate limit jaringan: lapis agregat IPv6 /48 lewat satu helper
**Konteks:** kunci jaringan rate limit = IPv4 /24, IPv6 /64 (#28). Satu blok IPv6 /48 — gratis dari tunnel broker, umum dari penyedia VPS — berisi 65.536 blok /64, sehingga penyalahguna yang lewat Cloudflare secara SAH mendapat 65.536× plafon (login 10/menit → ±655 ribu percobaan/menit). Ditemukan review adversarial KEA-1 (#37). Selain itu `ipNetworkKey` membentuk kunci dari TEKS, sehingga penulisan berbeda untuk alamat yang sama (`2001:0db8::` vs `2001:db8::`) dan string sampah menjadi bucket berbeda.

**Keputusan:**
1. `checkClientRateLimit(aksi, batas, scope?)` di `lib/request-ip.ts` menjadi SATU-SATUNYA jalan rate limit per-jaringan. `clientRateKey`/`scopedClientRateKey` dihapus agar tak ada jalur satu-kunci yang terlewat; 19 titik panggil dimigrasi, nama aksi, batas, scope & bentuk kunci jaringan tak berubah.
2. Khusus IPv6, selain kunci /64 diperiksa kunci agregat /48 dengan plafon `max × 16` (`IPV6_AGGREGATE_FACTOR`), di-scope sama dengan kunci jaringan.
3. Kedua kunci diperiksa lewat `checkRateLimitAll` secara **semua-atau-tidak-sama-sekali**: hit hanya dicatat bila SEMUA lapis lolos; request yang ditolak tak mengubah bucket mana pun dan tak membuat kunci baru.
4. `ipNetworkKey`/`ipAggregateKey` dibentuk dari byte `parseIp` (#37); nilai tak dikenali → `"unknown"`.

**Alasan:** faktor 16 membatasi penyalahguna /48 ke 16× plafon (bukan 65.536×) sambil tetap longgar bagi pelanggan operator seluler IPv6 yang berbeda namun berbagi satu /48 — menyamakan /48 dengan /24 (faktor 1) membuat dua pelanggan saling mengunci di login. Pencatatan semua-atau-tidak menutup dua kebocoran: percobaan yang ditolak di /64 menguras jatah /48 tetangga, dan percobaan yang ditolak di /48 mengisi bucket /64 pemanggil sendiri (ia tetap terkunci satu jendela lagi setelah /48 pulih). Review adversarial menemukan versi pertama — periksa-lalu-catat berurutan — masih bocor ke arah kedua. IPv4 tak diberi agregat: memiliki banyak /24 itu mahal.

**Ditolak:** kunci jaringan IPv6 langsung /48 (pelanggan seluler berbagi plafon ketat); agregat IPv4 /16 (terlalu banyak pengguna sah per /16 di balik CGNAT); melewati agregat untuk aksi auth (membuka lagi rotasi /64 untuk brute-force login, sasaran paling bernilai); kunci komposit tersembunyi di dalam `checkRateLimit` (sihir berbasis string di limiter generik).

**Konsekuensi:**
- **Penguncian tetangga /48 — trade-off diterima.** Pelaku yang menguasai ≥16 blok /64 di /48 yang sama (banyak SIM, sambung-ulang seluler berulang, atau jalur spoof pelanggan Cloudflare sebelum AOP — #37) dapat menghabiskan jatah agregat, sehingga pelanggan lain di /48 itu ditolak selama satu jendela. Untuk aksi tanpa scope artinya login 160/menit, daftar/reset/RSVP/amplop 80/menit per /48. Kapabilitas ini tak melampaui jalur spoof #37, yang sudah bisa mengunci /24 CGNAT mana pun. Lapis berikutnya bila terjadi: Turnstile pada login setelah N kegagalan (rekomendasi audit KEA-1) dan WAF Cloudflare.
- **Kardinalitas kunci.** Aksi ber-scope menambah 1 kunci per (scope, /48), dan scope (slug) dipilih pemanggil sebelum divalidasi — request IPv6 dengan slug acak membuat 2 kunci jaringan, ditambah kunci identitas pada aksi yang memilikinya (mulai sesi Momen: `momen-session-device` → 3 kunci per request; sebelumnya 2). Kelemahan yang sudah ada sejak #28 (scope/identitas tak terbatas + eviksi kunci tertua mereset penghitung aktif, termasuk `auth-reset-email`/`auth-signin`) kini lebih murah dari IPv6: ±6,7 ribu request lewat mulai sesi Momen (sebelumnya ±10 ribu), ±10 ribu lewat galeri/buku tamu (sebelumnya ±20 ribu). `checkRateLimitAll` yang ditolak tak membuat kunci, tetapi kunci identitas di luarnya tetap dibuat walau lapis jaringan menolak — mis. `auth-reset-email` per email, sehingga satu IPv4 dapat mengisi Map dengan ±20 ribu request reset berapa pun batas IP-nya. Perbaikan tuntasnya — batasi scope/identitas sebelum limiter atau pisahkan store kunci identitas/auth — ditangani #39 dengan pendekatan lain (eviksi berbasis rasio isi + kunci identitas di belakang gerbang).
- Penyerang yang mengumpulkan banyak /48 masih mendapat plafon berlipat, tetapi jauh lebih mahal daripada rotasi /64; lapis lintas-proses tetap WAF Cloudflare (LAUNCH-CHECKLIST Fase 6).
- Test yang memalsukan rate limit jaringan me-mock `checkClientRateLimit`, bukan `checkRateLimit` (yang tetap dipakai untuk kunci identitas/email).

---

## #39 — 2026-09-15 · Limiter in-memory: eviksi berbasis rasio isi, kunci identitas di belakang gerbang
**Konteks:** `lib/rate-limit.ts` menyimpan ≤20.000 kunci. Saat penuh ia membuang bucket kedaluwarsa lalu kunci TERTUA, dan kunci yang dibuang mulai lagi dari nol. Pemanggil dapat membuat kunci tanpa batas — scope slug sebelum divalidasi, `deviceId` dari form, email reset — sehingga ±20 ribu request murah (±6,7 ribu lewat IPv6, #38) cukup untuk mereset penghitung aktif mana pun, termasuk batas brute-force login milik penyerang sendiri dan batas email reset korban. #28 menyebutnya "degradasi jinak"; review adversarial #38 membuktikan sebaliknya. Ditemukan juga bug: sapu kedaluwarsa memakai jendela request PEMICU untuk semua bucket, sehingga bucket `auth-reset-email` (15 menit) ikut terbuang oleh pemicu berjendela 60 detik.

**Keputusan:**
1. Bucket menyimpan `max`, `windowMs`, dan `lastSeen` (terakhir DIPERIKSA — diterima maupun ditolak). Saat Map akan penuh: (a) buang yang kedaluwarsa menurut jendelanya MASING-MASING; (b) bila ruang kosong masih <10%, buang bucket dengan **rasio isi terendah** (hit dalam jendela ÷ plafon) lebih dulu, seri → yang paling lama tak diperiksa, sampai 90% kapasitas. Kunci milik request yang sedang diproses tak ikut dibuang.
2. Reset kata sandi: Turnstile DULU, baru `auth-reset-ip` + `auth-reset-email` dicatat dalam satu keputusan semua-atau-tidak (parameter `identity` pada `checkClientRateLimit`). Request tanpa token Turnstile sah tak membuat kunci limiter apa pun.
3. Lapis perangkat mulai sesi Momen (`momen-session-device`, `deviceId` dari form) dipindah SESUDAH Turnstile.

**Alasan:** kerugian mereset sebuah penghitung sebanding dengan seberapa dekat ia ke plafon, dan rasio isi mengukur itu langsung. Kunci sampah yang murah (sedikit hit, plafon longgar) kini terbuang paling awal, sedangkan penghitung yang sedang membatasi seseorang (rasio ≈1) baru terbuang bila ≥18 ribu kunci lain sama penuhnya. Seri diputus dengan `lastSeen`, bukan hit terakhir yang diterima: penghitung yang terus MENOLAK brute-force tetap dianggap aktif, sehingga penyalahguna tak bisa membuatnya tampak menganggur. Review adversarial membuktikan versi pertama keputusan ini masih bocor: `auth-reset-email` dicatat sebelum Turnstile, jadi penuh dengan 3 request tanpa token dan hidup 15 menit — ±60 blok /48 (±67 ribu request) cukup untuk mereset plafon email korban, bukan ±2,7 juta request seperti klaim awal. Karena itu email kini di belakang Turnstile, bukan hanya di belakang batas jaringan; urutan ini tak menambah biaya karena Turnstile sejak awal dipanggil pada setiap request reset.

**Ditolak:** pindah ke Redis/Upstash sekarang (layanan baru, tetap butuh kebijakan kardinalitas; ditunda ke multi-instance, #28); validasi slug ke DB sebelum limiter (membalik urutan termurah-dulu, menambah query per request banjir); anggaran pembuatan scope per jaringan (harus menebak plafon aman untuk CGNAT seluler yang membagi satu /24 ke ribuan pengguna lintas undangan); menolak kunci baru saat penuh (fail-closed: banjir kunci mengunci semua pengunjung baru); Map terpisah untuk kunci auth (kunci email tetap bisa membanjiri Map-nya sendiri, akar masalah tak tersentuh); memutus seri dengan membuang hit TERBARU dulu (penyerang cukup mengisi kuncinya lebih awal dari penghitung korban).

**Konsekuensi:**
- **Biaya serangan dinyatakan dalam jaringan, bukan request.** Mendesak penghitung penuh keluar butuh ≥18 ribu kunci penuh lain yang hidup BERSAMAAN (dalam ±60 detik) pada satu titik mana pun di jendela penghitung korban — satu ledakan cukup untuk satu reset; banjir terus-menerus hanya perlu untuk reset berulang. Sumber kunci penuh termurah adalah kunci jaringan tanpa scope yang dicatat sebelum Turnstile: satu blok IPv6 /48 menghasilkan ±17 kunci penuh per aksi per menit (16 /64 + agregat). Dua ujung trade-off, terukur dengan kode asli: termurah per request (daftar/RSVP/amplop/login) butuh ±265 /48 atau ±4.500 /24 IPv4 dengan ±106 ribu request; jaringan paling sedikit — ditambah ics/og/webhook Pakasir (publik) — butuh ±152 /48 atau ±2.572 /24 dengan ±1,1 juta request, atau ±82 /48 atau ±1.385 /24 dengan ±0,9 juta request bila penyerang juga memakai satu akun untuk aksi dasbor (cek slug, hapus undangan, media, status pembayaran). Dari SATU jaringan, kunci penuh termurah (rem mulai sesi per slug) butuh 150 request per kunci. Lapis lintas-proses tetap WAF Cloudflare.
- **Biaya CPU.** Sapu O(n) menyisakan ≥10% ruang, jadi berjalan paling banyak sekali tiap ±2 ribu kunci baru — juga saat banjir stabil, ketika dulu setiap kunci baru memindai seluruh Map. Satu sapuan (pangkas + urutkan ±20 ribu bucket) memakan 3–9 milidetik setelah JIT hangat dan ±16 milidetik pada sapuan pertama, hanya saat Map penuh; rata-rata ±2–3 µdtk per kunci baru, dibanding ±200 µdtk pada banjir stabil sebelumnya.
- Lapis perangkat mulai sesi tak lagi meredam loop naif SEBELUM Turnstile — loop tanpa token baru gagal di Turnstile, dan panggilan siteverify tetap dibatasi rem jaringan per slug (slug-nya dapat divariasikan, #28). Reset kata sandi memanggil Turnstile pada setiap request, sama seperti sebelumnya.
- `checkRateLimit` tetap untuk kunci identitas yang sudah di belakang gerbang (`momen-upload-device` dari sesi HMAC, `momen-session-device` sesudah Turnstile).

---

## #40 — 2026-09-20 · Step terakhir editor: "Selesai" → pratinjau → aktivasi, dengan autosave yang ditunggu

**Konteks:** tombol kanan wizard editor di-disable mati di step terakhir (`disabled={step === steps.length - 1}`). Pemilik yang sudah mengisi semua step menyangka formnya rusak — tidak ada apa pun yang menunjukkan langkah berikutnya, dan tidak ada satu pun tautan ke `/preview/{id}` di seluruh dasbor. Sekaligus ada bug yang tak terlihat: autosave men-debounce 800 ms dan cleanup `useEffect` membuang timer yang tertunda, jadi berpindah halaman tepat setelah mengetik menelan ketikan terakhir tanpa jejak.

**Keputusan:**
1. Di step terakhir tombol kanan menjadi "Selesai" → `/preview/{invitationId}`. Navigasi DITUNDA sampai `flush()` autosave selesai; simpan gagal → tetap di editor, pesan `role="alert"`, tombol hidup lagi.
2. `useDraftAutosave` mengembalikan `{ status, flush }`. Semua simpan diserialisasi lewat satu rantai promise dan snapshot `form.getValues()` diambil saat gilirannya tiba, jadi request lama tak pernah menimpa yang baru. Saat unmount, timer yang tertunda tidak dibuang: simpanannya tetap dikirim (best-effort). `flush()` menguras perubahan berulang (maks 5 putaran) supaya ketikan yang masuk selagi simpan berjalan ikut terkirim.
2b. **Penolakan server dibedakan dari gangguan transport** (temuan review, severity tinggi): `ActionState` ber-`fieldErrors` = skema server menolak isi (mis. narasi melebihi 2.000 karakter — Textarea editor tak punya `maxLength`), dan payload yang sama persis pasti ditolak lagi. Kasus itu TIDAK diantre ulang dan memakai pesan sendiri yang menyuruh pemilik memperbaiki isian, bukan "periksa koneksi". Tanpa pemisahan ini satu penolakan membuat `dirty` macet selamanya: tombol Selesai jadi jalan buntu permanen DAN setiap ketikan sesudahnya gagal tersimpan dalam senyap.
2c. Indikator hanya menulis "Tersimpan" bila benar-benar tak ada perubahan tertunda; pesan kegagalan diletakkan di ATAS baris tombol lalu digulirkan ke layar (di ponsel baris tombol sering sudah di batas bawah viewport), dan hilang sendiri begitu simpanan berikutnya berhasil.
3. Bar pratinjau pemilik mendapat CTA aktivasi per status dari `lib/invitation-status.ts` — satu sumber kebenaran yang dipakai bersama kartu dashboard. `active` & `suspended` tak punya CTA. Undangan ber-`purged_at` juga tidak: datanya sudah dihapus permanen, jadi menawarkan perpanjangan berarti menjual undangan kosong. Gerbangnya ditutup di SERVER juga (`createCheckoutAction` menolak, halaman `/aktifkan` `notFound()`), bukan hanya di UI — dashboard menyembunyikan baris purged, tetapi URL aktivasinya masih bisa dibuka dari tautan lama.
4. Props chrome pratinjau menjadi union terdiskriminasi `PreviewChrome`: kombinasi "demo + CTA pemilik" tak bisa ditulis, jadi kebocoran CTA ke showcase tema publik adalah galat kompilasi.

**Alasan:** tombol mati adalah jalan buntu di titik paling bernilai dalam corong (tepat sebelum bayar). Pratinjau dipilih sebagai perantara — bukan langsung ke checkout — karena pemilik memang perlu melihat hasilnya sebelum memutuskan membayar, dan bar pratinjau sudah punya jalan pulang ke editor. Menunggu flush adalah syarat, bukan hiasan: tanpa itu fitur baru ini justru MENAMBAH peluang kehilangan data, karena ia mendorong pemilik berpindah halaman persis setelah mengetik.

**Ditolak:** `<Link>` bergaya tombol (href asli & bisa buka tab baru, tetapi navigasi harus menunggu simpan — anchor yang di-`preventDefault` lalu `router.push` hanya menambah jalur yang bisa salah); memblokir "Selesai" bila ada step belum lengkap (draft memang boleh belum lengkap, dan gerbang slug/paket sudah ada di halaman aktivasi); menurunkan `PAYABLE_STATUSES` dari peta CTA (label UI tak boleh melebarkan gerbang uang — keduanya dijaga selaras oleh test); `beforeunload`/`visibilitychange` untuk menyimpan saat tab ditutup (mematikan bfcache; jalur kehilangan utama sudah ditutup flush + simpan-saat-unmount); `AbortController` untuk membatalkan simpan in-flight (request yang sudah tiba di server tetap menulis — pembatalan sisi klien hanya menyembunyikan kegagalan).

**Konsekuensi:**
- Kontrak `useDraftAutosave` berubah dari `SaveStatus` menjadi `{ status, flush }`; hanya `EditorShell` yang memakainya.
- Shell `/preview/[id]` kini membaca satu kolom `status` (lookup PK) untuk menentukan CTA. Efek samping yang diinginkan: id milik orang lain langsung `notFound()`, bukan bingkai kosong yang iframe-nya gagal belakangan.
- Simpan saat unmount bersifat best-effort dan SENYAP bila gagal (komponen sudah lepas) — tetap lebih baik daripada perilaku lama yang pasti membuang. Menutup tab di tengah jendela debounce masih bisa kehilangan ketikan terakhir; itu risiko yang diterima sadar.
- CTA memakai label lebih pendek daripada kartu dashboard ("Bayar" vs "Lanjutkan pembayaran") karena bar pratinjau tetap harus muat di layar 360px (bar butuh 241px, diukur di browser).
- Sumber penolakan validasi belum ditutup di hulu: input editor masih boleh melebihi batas skema draft (`narrative` 2.000 karakter, story `.max(20)`, sesi jadwal `.max(10)`) karena tak ada `maxLength`/pembatas tombol "Tambah". Perubahan ini membuat kegagalannya jujur dan bisa dipulihkan, tetapi pencegahannya (batas di klien) masih pekerjaan terbuka.
- Uji mutasi 12 varian (tombol kembali di-disable, navigasi tanpa menunggu flush, hasil flush diabaikan, label bocor ke langkah lain, alert tak dirender, penolakan diantre ulang, penolakan disamakan dengan transport, flush satu putaran, indikator berbohong, simpan-saat-unmount dibuang, gerbang `!demo` dicabut, `purged_at` diabaikan) — seluruhnya merah di test baru.

---

## #41 — 2026-09-22 · Batas isian editor = batas skema server; penolakan tampil per isian

**Konteks:** review #40 membuktikan autosave bisa ditolak dari UI biasa. Telaah lanjutan menemukan hal yang lebih parah:
- Tak satu pun dari 71 isian teks editor memakai `maxLength`, dan tak satu pun dari 6 tombol "Tambah" dibatasi.
- **Amplop tidak dilonggarkan di skema draft.** Menekan "Tambah rekening" langsung membuat autosave ditolak ("Nama bank wajib diisi"). Karena payload = seluruh form, SEMUA perubahan di langkah lain ikut gagal tersimpan sampai baris itu terisi lengkap.
- Server mengembalikan `error.flatten().fieldErrors`, jadi path diratakan ke `content`. Pesan bawaan Zod berbahasa Inggris. Kriteria terima SPEC §4.4 ("pesan error bahasa Indonesia yang jelas per field") tidak mungkin dipenuhi.
- **Halaman edit mengganti isi yang tak lolos skema draft dengan konten KOSONG**, lalu autosave pertama menimpa isi asli di DB. Belum terpicu hari ini, tetapi pasti terjadi begitu satu batas diturunkan.

**Keputusan:**
1. `lib/validation/content/field-limits.ts` (`FIELD_LIMITS`, tanpa impor) menjadi satu-satunya sumber angka. Skema strict, skema draft, dan UI semuanya membacanya; 20 pasang literal ganda strict↔draft hilang.
2. Setiap isian teks ber-`maxLength`. Textarea memakai `LimitedTextarea` dengan penghitung karakter, supaya pemotongan saat menempel teks tak terjadi diam-diam. Tombol daftar memakai `AddButton`, yang nonaktif di batas dan menampilkan alasannya. Isian tanggal diberi `max` tahun 9999 (Chrome mengizinkan tahun 5–6 digit dan `Date.parse` menerimanya).
3. Skema draft melonggarkan baris rekening/e-wallet. Skema strict tetap mewajibkan isi lengkap, dan render (`coerceEnvelope`) membuang baris yang belum lengkap.
4. `saveInvitationDraftAction` memvalidasi dengan peta pesan per-parse (`draftErrorMap`) dan mengembalikan galat per PATH LENGKAP (`draftFieldErrors`). Pesan kustom di skema tetap menang.
5. Editor menampilkan pesan di isian yang ditolak (`Field` membaca `name` dari anaknya, jadi path tak bisa berbeda dari yang di-register). Pesan itu **terhubung secara terprogram**: label menunjuk id kontrol, kontrol diberi `aria-invalid` dan `aria-describedby` ke pesannya (digabung dengan penghitung karakter, tidak saling menimpa), dan pesan muncul sebagai `role="status"`. Tanpa ini pembaca layar hanya mendengar "Gagal menyimpan" tanpa tahu isian mana. Langkah yang berisi isian bermasalah ditandai di navigasi (`STEP_FIELDS`, awalan terpanjang menang), dan pesan "Selesai" menyebut nama langkahnya.
6. `editableContent`: isi tersimpan yang tak lolos skema draft ditampilkan APA ADANYA. Server menolak isian yang melanggar dengan pesan per isian, pemilik memperbaikinya, dan tak ada yang hilang. Hanya baris rusak (bukan objek / kategori lain) yang jatuh ke konten kosong.

**Alasan:** pencegahan (batas di UI) dan pemulihan (pesan per isian) sama-sama dibutuhkan. Pencegahan saja tidak cukup: data lama, versi bundle lama setelah deploy, dan input IME di batas tetap bisa lolos. Pemulihan saja membuat pemilik terus-menerus bertemu penolakan. Satu modul angka membuat UI dan server tak mungkin berbeda pendapat, dan modul itu tanpa impor sehingga editor tak menyeret Zod & graf skema ke bundle klien.

**Ditolak:**
- Membaca batas lewat introspeksi Zod: `ZodArray` tak punya getter publik untuk batasnya, dan `z.toJSONSchema` menyeret seluruh skema + generator ke klien.
- Literal di UI: salinan ketiga yang pasti menyimpang. Proyek ini sudah punya contohnya, `momen-camera.tsx` `maxLength={40}` di samping `MOMEN_LIMITS`.
- `z.config(z.locales.id())` global: pesannya teknis, dan diam-diam mengubah pesan belasan aksi lain.
- Validasi klien lewat `zodResolver`/`safeParse` di browser: skema ikut terbundel, dan validasi berjalan tiap ketikan. Server tetap sumber kebenaran, termasuk untuk klien lama setelah deploy.
- Batas lunak (boleh melebihi lalu diperingatkan): satu isian kepanjangan menggagalkan simpan untuk SEMUA isian lain.

**Konsekuensi:**
- **Menurunkan angka di `FIELD_LIMITS` kini aman terhadap kehilangan data.** Editor menampilkan data lama, server menolak dengan pesan per isian, dan pemilik memendekkannya. Tetap periksa data production dulu, karena setiap pemilik yang terdampak harus memperbaiki manual.
- `tests/unit/editor-limits-sweep.test.tsx` merender ketiga editor asli dan memeriksa SETIAP isian yang muncul:
  - `maxLength` ada;
  - skema server menerima tepat N dan menolak N+1 di path yang sama;
  - isian terpetakan ke langkahnya.
  Isian baru yang lupa diberi batas otomatis memerah. `tests/unit/lib/field-limits.test.ts` mengunci angkanya secara harfiah.
- Pembuktian:
  - Review adversarial: 18 agen menemukan 6 temuan terbukti dan 8 dibantah. Lima di antaranya soal mutu test dan satu soal aksesibilitas pesan galat; semuanya ditutup.
  - Test baru memanggil `saveInvitationDraftAction` ASLI (bukan tiruan) untuk mengunci kontrak galat per path. Gerbang `purged_at` di `createCheckoutAction` dari #40, yang ternyata belum punya test, kini teruji.
  - Uji mutasi: 35 varian, seluruhnya merah. Mencakup maxLength dicabut, amplop draft kembali ketat, aksi kembali `flatten()`, peta pesan dicabut, `editableContent` kembali mengosongkan, kunci langkah menyimpang, semua langkah ditandai, penghitung selalu 0, `aria-invalid` hilang, dan batas URL/email strict menyimpang.
- Yang BELUM ditutup, sengaja dicatat:
  - Skema strict (format https/YouTube, email PIC, isian wajib) tidak dijalankan sebagai gerbang aktivasi; nilai tak valid diterima diam-diam lalu disaring saat render.
  - ~~Sesi jadwal tanpa `startAt` dibuang server walau indikator bilang "Tersimpan".~~ Ditutup oleh #42.
  - Isian kutipan (`content.quote`) ada di skema tetapi belum di editor (SPEC §4.4 langkah 7).
  - Perilaku `maxLength` dengan IME Android/iOS dan hitungan baris baru belum diuji di perangkat nyata.

---

## #42 — 2026-09-22 · Sesi jadwal tanpa jam mulai tersimpan (`start_at` boleh NULL)

**Konteks:** sesi jadwal yang tanggal-jam mulainya belum lengkap DIBUANG di dua lapis yang sama-sama diam: filter di `saveInvitationDraftAction` dan `where start_at is not null` di RPC `replace_invitation_events`. Aksi tetap membalas "success" dan indikator menulis "Tersimpan". Editor masih memegang sesi itu di memori, sehingga pemilik mengira tersimpan. Setelah halaman dimuat ulang, sesi hilang beserta nama, gedung, alamat, dan peta yang sudah diketik. Hal yang sama terjadi lewat jalur resmi "Selesai → Pratinjau → Edit" dan lewat "Kustomisasi Tampilan". Ini melanggar SPEC §4.4 "refresh browser tidak menghilangkan data".

Pemicunya sangat biasa. `input type=datetime-local` bernilai "" selama SALAH SATU segmennya kosong, misalnya tanggal sudah diisi tetapi jam belum, atau pemilik mengisi gedung dulu. Pada undangan AKTIF lebih parah: menghapus satu segmen jam saat hendak mengganti tanggal langsung menghapus sesi dari halaman tamu.

**Keputusan** (disetujui pemilik 2026-09-22):
1. Migrasi `20260922120000_events_nullable_start.sql` melonggarkan `invitation_events.start_at` menjadi NULLABLE. NULL = sesi draft belum berjam. RPC menyimpan semua sesi yang dikirim aplikasi. Nama kosong tetap kosong — dulu diganti diam-diam menjadi "Acara", sehingga editor memuat nama yang tak pernah diketik pemilik. Hak eksekusi `PUBLIC`/`anon` dicabut; RPC tetap SECURITY INVOKER dengan RLS.
2. Predikat tunggal "sesi terjadwal" (`lib/schedule.ts` `scheduledEvents`) dipakai di builder data (halaman publik + pratinjau) dan di route ICS. OG menyaring di query. Kontrak tema `InvitationEventView.startAt: string` TIDAK berubah, jadi ke-10 tema tak disentuh. `events[0]` kini selalu sesi terjadwal pertama, sehingga label tanggal hero & hitung mundur benar.
3. Satu aturan tanggal-jam dipakai bersama editor & server (`lib/event-draft.ts`, tanpa impor): format lengkap, tahun 1900–9999, tanggal kalender nyata. `2026-02-30` menjadi NULL alih-alih digeser diam-diam ke 2 Maret. Tahun 0001 dulu menghasilkan tahun 0000 setelah konversi zona, sehingga Postgres menolak dan SELURUH autosave gagal dengan pesan "periksa koneksi"; kini juga NULL.
4. Editor: isian "Mulai" pada sesi berisi yang belum berjam memberi catatan (bukan galat) yang terhubung ke isiannya dan diumumkan lewat region status yang selalu ada. **Pengaman:** selama pemilik menyunting jam sesi yang sudah berjam, SETIAP nilai yang belum lengkap menurut aturan bersama tidak menimpa jam tersimpan sampai isiannya lengkap kembali. Versi pertama hanya menahan "" — review membuktikan di Chrome sungguhan bahwa mengetik ulang tahun memancarkan nilai antara `0002-…`, `0020-…`, `0202-…` yang lolos, tersimpan tanpa jam, dan menghapus sesi dari undangan aktif. `onBlur` ikut dijaga karena react-hook-form membaca ulang nilai DOM saat blur. Untuk membuang sesi, pakai "Hapus". Kartu kosong total tidak disimpan. Langkah Jadwal bercentang hanya bila semua sesi berisi sudah berjam — dulu cukup satu.

**Alasan:** hanya menyimpan sesi di tempat semestinya (tabel ternormalisasi, SPEC prinsip & DATA-MODEL §1) yang memenuhi kriteria "refresh tidak menghilangkan data". Menyaring di satu titik membuat pembaca publik tak mungkin lupa, dan kontrak tema tetap utuh.

**Ditolak:**
- Peringatan + tombol Selesai menahan, tanpa migrasi: sesi tetap hilang saat tab ditutup, pindah perangkat, atau navigasi lain; `beforeunload` tak bisa diandalkan di WebView/iOS dan tak terpicu navigasi Next. Tidak memenuhi SPEC.
- Penyangga JSON (`settings.pendingEvents`) untuk sesi setengah jadi: dua sumber kebenaran untuk satu jadwal, dan `settings` dibaca halaman publik sehingga butuh pengecualian khusus.
- Menolak seluruh simpanan bila ada sesi tanpa jam: mengulang masalah amplop #41 — satu kartu menggagalkan simpanan semua langkah.

**Konsekuensi:**
- **Urutan deploy.** Bila aplikasi sudah ter-deploy, deploy APLIKASI dulu, lalu migrasi:
  - aplikasi baru di atas RPC lama: sesi tanpa jam masih dibuang SQL (sama seperti sebelum #42), nama kosong masih menjadi "Acara", dan catatan editor tetap jujur karena tak mengklaim "sudah tersimpan";
  - urutan sebaliknya punya jeda buruk: RPC baru menyimpan nama kosong apa adanya, sedangkan builder & ICS lama tak punya label cadangan, sehingga judul sesi tampil kosong ke tamu.
  - Pada 2026-09-22 belum ada aplikasi ter-deploy (Easypanel belum disiapkan) dan cloud berisi 0 undangan, jadi migrasi diterapkan langsung.
  - Setelah ada baris `start_at` NULL atau nama kosong, **rollback aplikasi ke commit sebelum #42 TIDAK aman** (pembaca lama tak menyaring). Rollback RPC saja aman. Rollback PENUH ke NOT NULL wajib menghapus sesi tanpa jam — destruktif, butuh persetujuan pemilik.
- Fase 2: target check-in hanya sesi `start_at is not null`.
- Test: aksi ASLI (isi RPC yang dikirim), builder data, route ICS, kontrak migrasi statis, aturan tanggal-jam, dan perilaku isian "Mulai" di editor asli — termasuk urutan nilai antara yang dipancarkan Chrome saat tahun diketik ulang.
- Pembuktian:
  - Browser sungguhan: sesi tanpa jam tetap "Tersimpan", kembali utuh setelah muat ulang, dan tidak muncul di pratinjau.
  - Database: RPC diuji di bawah RLS (pemilik menyimpan NULL, pengguna lain ditolak, `anon` tak bisa mengeksekusi).
  - Review adversarial: 23 agen, 11 temuan terbukti — semuanya ditutup. Yang terberat: pengaman versi pertama hanya menahan "".
  - Uji mutasi: 26 varian. 23 merah. Tiga lolos dengan alasan yang diketahui:
    - catatan "jam sebelumnya" tanpa cek keabsahan — ekuivalen, karena pengaman hanya menahan bila jam tersimpan sah;
    - saringan aplikasi di ICS dicabut — ekuivalen, karena query sudah `.not(start_at is null)` dan `buildIcs` melewati sesi tanpa jam;
    - saringan OG dicabut — celah test yang diakui di bawah.
  - Migrasi diterapkan ke cloud 2026-09-22 setelah pra-cek (0 sesi, 0 undangan). Versi di `schema_migrations` disamakan dengan nama berkas.
- **Yang BELUM ditutup, sengaja dicatat:**
  - ~~**Churn id sesi.**~~ Ditutup oleh #43. Setiap autosave — dari langkah mana pun, karena payload = seluruh form — menghapus lalu menyisipkan ulang semua sesi, jadi id berganti tiap simpan. Ini mematahkan UID ICS "stabil" (`lib/calendar.ts`), tautan `/api/ics/{slug}?e={id}` di HTML ISR/tab terbuka (→ 404), dan kesiapan FK check-in Fase 2 (cascade akan menghapus riwayat check-in tiap autosave). Ditutup oleh #43 dengan upsert per id. Versi pada tautan ICS DITOLAK di #43 (butuh perubahan kontrak props 10 tema) dan diganti cache `.ics` 5 menit.
  - ~~Checkout belum mensyaratkan ≥1 sesi berjam — pemilik bisa membayar undangan berjadwal kosong.~~ Ditutup oleh #44: gerbang checkout (SPEC §4.8 langkah 0) kini mensyaratkan minimal satu sesi berjam.
  - ~~OG hanya dilindungi saringan query, belum ada test~~ Sebagian ditutup oleh #45: cabang galat, tak-aktif, dan 429 route OG kini teruji; render gambar (satori) tetap tak diuji di jsdom.
  - ~~Galat query jadwal di `/[slug]` & `/api/ics` masih ditelan.~~ Ditutup oleh #45 (seluruh bacaan halaman publik, pratinjau, Album Momen, `.ics`, dan OG).

## #43 — 2026-09-22 · Id sesi jadwal stabil: upsert per id, bukan hapus-semua

**Konteks:** RPC `replace_invitation_events` menghapus SEMUA sesi lalu menyisipkan ulang, jadi id setiap sesi berganti pada SETIAP autosave. Payload autosave = seluruh form, sehingga ini terjadi dari langkah mana pun, bukan hanya langkah Jadwal. Akibatnya:
- tautan `/api/ics/{slug}?e={id}` di HTML ISR maupun tab tamu yang sudah terbuka menjadi 404;
- UID kalender `{id}@merriva.id` (`lib/calendar.ts`) berganti, sehingga tamu yang menambah ulang sesi mendapat entri GANDA alih-alih pembaruan — padahal UID stabil adalah niat awal modul itu;
- FK check-in Fase 2 ke sesi akan ikut terhapus (cascade) tiap autosave.

Dicatat sebagai "wajib sebelum Fase 2" di #42; dikerjakan atas rekomendasi yang disetujui pemilik 2026-09-22.

**Keputusan:**
1. **Editor membuat id untuk kartu sesi baru** saat kartu ditambah (`newEventId`, `lib/event-draft.ts`: `crypto.randomUUID`, jatuh ke `getRandomValues` di konteks http biasa). Sesi yang dimuat membawa id DB-nya (`toEventDraft`). Karena id sudah ada sebelum simpanan pertama, simpanan berulang — termasuk percobaan ulang setelah jaringan putus — memperbarui baris yang sama, tak pernah menggandakan.
2. **RPC meng-upsert per id** (migrasi `20260922130000_events_stable_ids.sql`): sesi undangan ini yang tak dikirim lagi dihapus; yang dikirim diperbarui di tempat (`on conflict (id) do update`); yang tanpa id disisipkan ber-id baru. `invitation_id` tak pernah ikut di-SET. Id milik undangan LAIN yang disusupkan dilewati oleh WHERE konflik tanpa galat. RLS (SECURITY INVOKER) tetap lapis kedua: sesi baru untuk undangan orang lain ditolak.
3. **Aksi simpan menormalkan id:** id tak berbentuk UUID dibuang (sesi diperlakukan baru) alih-alih menolak simpanan — pelajaran #41: satu kartu tak boleh menggagalkan autosave semua langkah. Id GANDA dalam satu kiriman: kemunculan pertama memegang id, sisanya menjadi sesi baru. Postgres menolak upsert yang menyentuh satu baris dua kali, dan autosave tak boleh macet karenanya.
4. **Cache `.ics` dipendekkan** dari 1 jam (peramban) / 1 hari (CDN) menjadi 5 menit di keduanya. URL per sesi kini stabil lintas suntingan, jadi cache panjang akan menyajikan jam LAMA setelah pemilik mengubah jadwal. Dulu URL "segar" hanya karena id berganti — dengan harga tautan 404. Respons 404/429 kini memancarkan `Cache-Control: no-store` eksplisit: tanpa header, CDN/peramban memakai TTL bawaannya (Cloudflare: Browser Cache TTL zona 4 jam), sehingga 404 sesaat — mis. pemilik mengosongkan jam sesi sebentar (#42) — bisa tertahan di peramban tamu berjam-jam. Bila Cache Rule `/api/ics/*` kelak dipasang, Browser TTL WAJIB "Respect origin"; bawaan 4 jam menimpa `max-age` origin yang lebih kecil (ARCHITECTURE §3).
5. Kunci render `useFieldArray` diganti `keyName: "key"`. Dengan bawaan `id`, `fields[i].id` (kunci RHF) dan id sesi DB berbeda nilai tetapi bernama sama. Nilai form sendiri tak tertimpa (diperiksa di sumber RHF 7.82); ini soal kejelasan, bukan perbaikan bug.
6. **RPC diserialkan per undangan** dengan `pg_advisory_xact_lock(hashtextextended('replace_invitation_events:' || inv_id::text, 0))` di awal badan fungsi. Ditemukan review: dua simpanan bersamaan (dua tab/perangkat) dengan jadwal bersilang — tab 1 membuang sesi y, tab 2 membuang sesi x — saling mengunci baris dalam urutan terbalik (DELETE lalu upsert), dan Postgres membatalkan salah satunya dengan `deadlock detected`. RPC lama tak mengalaminya karena kedua transaksi mengantre pada baris pertama pindaian. Dengan kunci, simpanan kedua menunggu lalu berjalan di atas snapshot baru (READ COMMITTED): bersih "penulis terakhir menang". Kuncinya ber-namespace agar tak saling menunggu dengan kunci galeri & tamu per undangan (`hashtextextended(inv_id::text, 0|1)`). Pengguna lain yang memanggil RPC untuk undangan yang sama hanya ikut mengantre sepanjang satu transaksi singkat; RLS tetap menolak tulisannya.

**Ditolak:**
- **Id dibuat server lalu dikembalikan ke klien:** butuh jalur balik ke form, dan balasan yang hilang di jaringan membuat percobaan ulang menyisipkan sesi ganda.
- **`?v=` pada tautan ICS** (seperti OG `?v=updated_at`): tema merakit URL ICS sendiri dari `slug` + `e.id`, jadi versi butuh field baru di `InvitationEventView` — mengubah kontrak props 10 tema (wajib tanya dulu). Manfaatnya kecil: Cloudflare tak meng-cache `/api/ics/*` tanpa Cache Rule (opsional, tak ada di LAUNCH-CHECKLIST), dan TTL 5 menit sudah membatasi basi di peramban.
- **`SEQUENCE` iCalendar:** `DTSTAMP` sudah berubah tiap unduhan dan UID kini stabil. Tak ada bukti klien sasaran menolak pembaruan tanpa `SEQUENCE`; ditunda sampai ada.
- **Soft-delete sesi yang dihapus pemilik:** urusan desain check-in Fase 2 (riwayat check-in sesi yang dibuang), bukan churn.

**Konsekuensi:**
- **Kompatibel dua arah; urutan deploy bebas.** Aplikasi baru di atas RPC lama: id diabaikan, perilaku sama seperti sebelum #43. Aplikasi lama di atas RPC baru: tanpa id, semua sesi lama terhapus lalu disisipkan ulang ber-id baru — persis perilaku lama. Rollback aplikasi maupun RPC aman, tak destruktif.
- Fase 2: FK check-in → `invitation_events.id` kini aman dari autosave. Menghapus sesi lewat "Hapus" tetap meng-cascade; putuskan saat mendesain check-in.
- Klien yang dirakit ulang bisa memilih id sendiri. Dampaknya hanya pada undangannya sendiri: baris undangan lain tak tersentuh (WHERE konflik + RLS), dan UUID v4 editor tak bisa ditebak sebelum tersimpan.
- Test:
  - aksi ASLI: id diteruskan, dinormalkan, dibuang bila tak sah, id ganda, kartu kosong;
  - editor asli: kartu baru ber-id, id sama antar-simpanan, id DB dipertahankan, hapus lalu tambah tak memakai ulang id;
  - `newEventId`: v4, fallback tanpa `randomUUID`;
  - kontrak migrasi statis (teks SQL): predikat DELETE dikunci UTUH, kunci per undangan sebelum DELETE, upsert per id, `invitation_id` tak di-SET, WHERE konflik. Versi pertama hanya mencocokkan potongan predikat, sehingga `and`→`or` (admin menghapus SELURUH tabel) dan saringan id NULL yang dibuang (satu id NULL membuat `<> all` bernilai NULL → tak ada yang terhapus) lolos — ditemukan review;
  - **test DB pgTAP** `supabase/tests/database/replace_invitation_events.test.sql` (`pnpm test:db`, 27 asersi, mandiri: fixture dibuat & di-ROLLBACK di dalam test): upsert per id yang memperbarui SEMUA kolom di tempat, baris anak ber-FK cascade (calon check-in Fase 2) selamat melewati simpanan, sesi dibuang terhapus, id undangan lain & undangan lain milik sendiri dilewati, RPC untuk undangan orang lain ditolak RLS, id ganda ditolak, payload lama tanpa id & `events` bukan array berperilaku seperti RPC lama, `anon`/PUBLIC tak bisa mengeksekusi, SECURITY INVOKER. Butuh stack Supabase lokal, jadi BELUM masuk CI (CI tak punya DB); DoD `pnpm lint && pnpm typecheck && pnpm test` tak berubah. Konkurensi (kunci #6) tak bisa diuji satu koneksi — dibuktikan manual di bawah;
  - route `.ics`: TTL ≤ 300 dtk di 200, `no-store` di 404 & 429.
- Pembuktian:
  - **Database lokal di bawah RLS**, dengan pengguna non-admin sungguhan: id lama dipertahankan dan sesi tanpa id mendapat id baru; sesi yang tak dikirim terhapus; id milik undangan orang lain dilewati tanpa galat dan barisnya utuh; RPC untuk undangan orang lain tak menghapus apa pun dan sesi barunya ditolak RLS; id ganda ditolak Postgres (alasan normalisasi di aksi); `anon` tak bisa mengeksekusi.
  - **Tautan kalender:** sesi `andi-sinta-demo` disunting sebagai pemiliknya lewat RPC; tautan `?e=` yang SAMA tetap 200, UID sama, dan jam serta gedung barunya ikut terbaca. Data demo dipulihkan dan dicek identik.
  - **Browser sungguhan:** sesi baru disimpan, lalu disunting dua kali — sekali setelah muat ulang. Id di DB tetap sama di ketiga simpanan; "Hapus" menghapus barisnya; konsol bersih.
  - **Review adversarial:** 10 agen (5 lensa: SQL/RLS/konkurensi, editor klien, aksi & validasi, pembaca publik & cache, test & dokumen; satu skeptis per temuan; satu kritik kelengkapan). 4 temuan, 3 bertahan — semuanya rendah — dan keempatnya ditangani: deadlock dua tab (#6), 404/429 tanpa `Cache-Control` + syarat Browser TTL (#4), catatan #42 yang masih mewajibkan versi tautan ICS. Temuan keempat (test kontrak hanya mencocokkan potongan DELETE) dinilai skeptis bukan cacat kode saat ini, tetapi benar sebagai celah test: predikat kini dikunci utuh dan perilakunya diuji pgTAP.
  - **Deadlock:** jadwal bersilang tiga koneksi psql paralel (semua ROLLBACK) — sebelum kunci: `deadlock detected`; sesudah kunci: simpanan kedua menunggu lalu berhasil, data utuh.
  - **Uji mutasi:** 23 mutan (8 SQL, 15 aplikasi), semuanya merah — 22 oleh vitest, 1 oleh typecheck (halaman edit tak memilih kolom `id`). Ke-8 mutan SQL juga diterapkan ke DB lokal lalu diuji pgTAP: 6 merah, 2 lolos dengan alasan yang diketahui:
    - kunci per undangan dicabut — konkurensi tak teruji dengan satu koneksi; dijaga test kontrak dan bukti deadlock manual;
    - `invitation_id` ikut di-SET — ekuivalen, karena WHERE konflik menjamin nilainya sama.

    Putaran pertama pgTAP meloloskan dua mutan lain: hapus-semua lalu sisip ulang dengan id yang sama (id saja tak membedakannya), dan kolom `address` tak diperbarui saat konflik. Keduanya kini merah setelah pgTAP ditambah asersi baris anak ber-FK dan pemeriksaan seluruh kolom.

## #44 — 2026-09-22 · Syarat bayar: minimal satu sesi jadwal berjam, semua syarat tampil sekaligus

**Konteks:** pemilik bisa membayar undangan yang jadwalnya kosong, atau yang semua sesinya belum berjam. Sejak #42, sesi tanpa jam mulai tersimpan tetapi tak pernah tampil ke tamu, jadi undangan seperti itu tersebar tanpa keterangan kapan dan di mana acaranya — dan uang sudah terlanjur dibayar. Dicatat sebagai butir terbuka di #42.

Gerbang yang ada hanya menahan alamat `draft-…`, dengan satu kartu untuk satu syarat. Bila alamat dan jadwal sama-sama kurang, pemilik baru mengetahui syarat kedua setelah menyelesaikan yang pertama.

**Keputusan** (disetujui pemilik 2026-09-22, ketiganya opsi rekomendasi):
1. **Syarat jadwal = minimal SATU sesi berjam.** "Berjam" memakai predikat tunggal `scheduledEvents` (#42) — sama dengan yang dipakai halaman publik, jadi "berjam" di gerbang = "tampil ke tamu". Sesi berisi lain yang belum berjam TIDAK menahan bayar, tetapi halaman aktivasi menyebut namanya (atau "Sesi N", sesuai nomor kartu di editor).
2. **Berlaku untuk SEMUA pembayaran** — aktivasi pertama, bayar ulang (`pending_payment`), perpanjangan (`expired`) — sama persis dengan syarat alamat.
3. **Satu sumber syarat DAN satu query:** `lib/activation-readiness.ts` — `fetchReadinessEvents` (baca jadwal lewat klien pengguna/RLS, urut `sort_order`) dan `activationReadiness` — dipakai halaman aktivasi DAN `createCheckoutAction`. Versi pertama berbagi fungsi tetapi menyalin query di dua tempat, dan filter query halaman tak teruji (ditemukan review); kini keduanya tak bisa berbeda pendapat karena konstruksi. Urutan syarat: alamat lalu jadwal; aksi membalas pesan syarat pertama dengan `reason: "readiness"`.
4. **Halaman aktivasi menampilkan SEMUA syarat sekaligus** (`ActivationBlockers`), masing-masing dengan tombol ke tempat perbaikannya. Menggantikan kartu alamat tunggal.
5. **Tautan langsung ke langkah editor:** `?langkah=jadwal` (`lib/editor-links.ts`; nama langkah berbahasa Indonesia seperti rute dashboard lain). `EditorShell` membuka langkah itu lebih dulu; nilai tak dikenal atau berupa array → langkah pertama.
6. **Galat saat membaca jadwal:**
   - aksi GAGAL-TERTUTUP: tak ada order, tak ada tautan bayar;
   - halaman tak mengklaim "jadwal kosong" yang tak bisa dipastikan: syarat jadwal dilewati, syarat alamat tetap tampil. Pemilih paket yang muncul tetap ditahan aksi.

   Galat di tempat lain dulu ditelan (catatan #42); di sini tidak.
7. **Tidak memeriksa syarat ini:** aktivasi SESUDAH pembayaran (webhook/poller) dan aktivasi manual admin. Uang yang sudah masuk tak boleh tertahan, dan admin adalah override yang disengaja.
8. **Halaman aktivasi yang basi** (jadwal dikosongkan di tab lain setelah halaman dimuat): aksi membalas `reason: "readiness"`, lalu `PackageChooser` memanggil `router.refresh()`, sehingga daftar syarat beserta tautan perbaikannya menggantikan pemilih paket. Galat lain digulir ke pandangan. Dulu pesannya jatuh di bawah kartu Premium — di luar layar ponsel — tanpa tautan perbaikan (ditemukan review).
9. **Baris sesi "hantu" ditutup di akarnya.** Aksi simpan kini menilai kekosongan kartu SETELAH normalisasi: jam yang tak lengkap/tak sah tersimpan NULL, jadi kartu yang isinya HANYA itu tidak disimpan. Contohnya tahun setengah jadi `0002-…` yang dipancarkan Chrome saat tahun diketik ulang, atau tahun < 1900.
   - Dulu kartu itu menjadi baris kosong: di editor tampil sebagai kartu kosong tanpa catatan dan langkah Jadwal bercentang, tetapi halaman aktivasi menyebutnya "Sesi N belum tampil" (ditemukan review).
   - `activationReadiness` juga tak menyebut baris kosong total yang mungkin tersisa dari sebelum perbaikan.
   - Kartu dengan isian lain tetap tersimpan (#42).

**Ditolak:**
- **Semua sesi berisi wajib berjam:** menahan pemilik yang sengaja menyimpan sesi cadangan. Cukup disebut namanya.
- **Hanya aktivasi pertama:** tak selaras dengan syarat alamat, dan membuat perpanjangan undangan tanpa jadwal lolos.
- **Satu kartu per syarat (seperti dulu):** pemilik menemukan syarat berikutnya hanya setelah memperbaiki yang sebelumnya.
- **Menahan di webhook/aktivasi:** pembayaran lunas tetapi undangan tak aktif = uang tertahan, dan harus diurus admin manual.

**Konsekuensi:**
- Gerbang ini mencegah kekeliruan jujur, BUKAN batas keamanan. Pemilik masih bisa mengosongkan jadwal sesudah order dibuat (pembayaran tetap mengaktifkan) atau sesudah aktif (halaman publik tak menampilkan sesi). Tak ada data yang terekspos.
- Kunci teks `setSlugTitle/Body/Cta` diganti `readiness.*`; `setSlugFirst` tetap untuk penahan server.
- Test:
  - `activationReadiness` & `editorHref`/`stepKeyFromParam` (termasuk nilai array dan kunci prototipe seperti `toString`);
  - aksi ASLI: ketiga status ditolak tanpa sesi berjam, sesi tanpa jam saja ditolak, satu sesi berjam cukup, alamat didahulukan, galat jadwal gagal-tertutup, jadwal dibaca lewat klien pengguna (RLS);
  - halaman aktivasi ASLI dirender: dua syarat sekaligus berurutan dengan tautannya, ketiga status, pemilih paket hanya saat siap, catatan sesi belum berjam, galat jadwal;
  - deep link: komponen ketiga editor DAN halaman edit asli yang dirender dengan `?langkah=` (termasuk nilai tak dikenal & array);
  - `fetchReadinessEvents`: tabel, kolom, filter `invitation_id`, urutan `sort_order` menaik;
  - `PackageChooser`: penolakan syarat → refresh; galat lain → tanpa refresh, pesan digulir ke pandangan;
  - aksi simpan ASLI: kartu yang isinya hanya jam tak lengkap/tak sah tidak disimpan;
  - prasyarat E2E pembayaran (runbook, `.env.example`, kedua spec) kini menyebut sesi berjam; spec gagal-cepat dengan sebabnya alih-alih timeout 120 dtk.
- Pembuktian:
  - **Browser sungguhan, lebar ponsel 390 px:**
    - kedua syarat tampil sekaligus;
    - "Lengkapi jadwal" membuka langkah Jadwal;
    - sesi tanpa jam tetap ditahan;
    - keadaan siap menampilkan catatan "Rapat Umum" + pemilih paket;
    - halaman basi (sesi berjam dihapus setelah halaman dimuat) → klik paket → halaman ter-refresh menjadi daftar syarat, 0 order, status tetap `draft`;
    - konsol bersih; data uji dipulihkan.
  - **Review adversarial:** 15 agen (5 lensa: jalur uang, UX & aksesibilitas, semantik syarat, regresi, test & dokumen; skeptis per temuan; kritik kelengkapan). 9 temuan, sebagian ganda — semuanya rendah, tak ada yang terbantah, seluruhnya ditangani:
    - prasyarat E2E;
    - halaman basi / pesan di luar layar (#8);
    - baris hantu (#9);
    - query ganda yang filternya tak teruji (#3);
    - penerusan `?langkah=` dari halaman edit yang tak teruji;
    - dua kalimat SPEC yang tak persis sesuai kode;
    - coretan #42 yang masih berkala kini.

    Jalur uang sendiri tak bercacat: hanya `createCheckoutAction` yang membuat tautan bayar undangan, dan tak ada efek samping sebelum syarat diperiksa.
  - **Uji mutasi:** 32 mutan (urutan & isi syarat, predikat berjam, penahan & gagal-tertutup di aksi, penanda `readiness`, klien RLS, filter & urutan query, baris hantu, refresh & gulir, cabang halaman, tautan perbaikan, deep link) — semuanya merah oleh test.

## #45 — 2026-09-23 · Galat bacaan di jalur publik dilempar, tak pernah di-cache sebagai isi undangan

**Konteks:** halaman undangan `/{slug}` adalah ISR (`force-static` + revalidasi on-demand saat pemilik menyimpan + jaring 1 jam). Query undangan utamanya sudah melempar galat. Enam bacaan sesudahnya menelan galat: tema, jadwal, galeri, Album Momen, batas paket, dan musik.
- Satu kedipan DB saat revalidasi meng-cache undangan tanpa jadwal, galeri kosong, tanpa tombol Momen, Premium ber-watermark (`getEffectiveLimits` jatuh ke lantai Basic), tanpa musik, atau 404 (tema null → `notFound()`).
- Cache itu bertahan bagi SEMUA tamu sampai simpanan berikutnya, padahal tamu justru membuka undangan pada hari-H.
- Dicatat sebagai butir terbuka di #42; dikerjakan atas rekomendasi yang disetujui pemilik 2026-09-23.

Pemetaan menemukan kelas yang sama di tempat lain:
- **OG** — jalur terberat. Galat → "tak aktif" → gambar default ber-`s-maxage=86400`. Di bawah Cache Rule `/api/og/*` yang diwajibkan LAUNCH-CHECKLIST (kunci = path saja), satu kedipan DB = pratinjau WhatsApp default selama sehari. Galat jadwal jatuh ke tanggal `event_date`, dan gambar SALAH itu di-cache 1 hari + 7 hari SWR.
- **`.ics`:** galat dijawab 404 "tak ada".
- **Pratinjau:** tanpa jadwal/galeri, sehingga pemilik mengira isiannya hilang; galat membaca status dijawab 404.
- **Album Momen:** tamu di hari-H diberi 404 atau "album belum aktif".

**Keputusan:**
1. **`dataOrThrow(result, label)` (`lib/supabase/result.ts`)**: data, atau lempar `SupabaseReadError` berlabel bacaan.
   - Render yang melempar TIDAK PERNAH di-cache. Yang tersaji bergantung jalurnya (diperiksa di sumber Next 16.2.11, dan ditinjau ulang oleh review karena versi pertama ADR ini menjanjikan terlalu banyak):
     - **basi karena waktu** (jaring 1 jam): entri basi disajikan lebih dulu, revalidasi latar yang gagal hanya dicatat → tamu melihat versi terakhir yang baik (`response-cache`, `handle-isr-error`);
     - **sesudah `revalidatePath`** (pemilik menyimpan — jalur revalidasi utama halaman ini): tag ditandai *expired*, `FileSystemCache.get` mengembalikan null, jadi render blocking; bila gagal, tamu mendapat halaman 500 (tak di-cache) dan permintaan berikutnya mencoba lagi. Versi lama TIDAK disajikan. Semantik SWR untuk jalur simpan (mis. profil cacheLife) ditunda: menukar jaminan itu dengan pemilik yang melihat versi lama sesaat sesudah menyimpan;
     - **render pertama** (belum pernah ada cache): sama seperti di atas.
   - postgrest-js tanpa `.throwOnError()` mengembalikan galat sebagai OBJEK POLOS. Melemparnya apa adanya membuat Next membungkusnya menjadi `Error(JSON)` bertumpukan internal — ketujuh bacaan tak terbedakan di Sentry (ditemukan review). `SupabaseReadError` dibuat di titik panggil, pesannya `"<label>: <pesan asli>"`, galat asli di `cause`.
   - Galat render dilaporkan ke Sentry lewat `onRequestError`.
2. **Dipakai di setiap bacaan** `/{slug}`, pratinjau (bingkai & isi iframe), dan halaman Album Momen (undangan & album). **Data yang memang TAK ADA tanpa galat tetap diperlakukan seperti dulu** (tema tak ada → 404, album belum dibeli → "belum aktif", paket tak terlihat → Basic, lagu nonaktif → tanpa musik).
3. **`getEffectiveLimits` & `resolveMusic` melempar galat DB** alih-alih menganggapnya "tak ada". Aksi kustomisasi tampilan menangkapnya dan membalas galat biasa, supaya tak menolak Premium palsu dan tak melempar ke editor. Halaman dashboard yang memakainya kini menampilkan galat alih-alih batas palsu.
4. **`.ics`:** galat DB → 503 + `Retry-After: 30` + `no-store`, dilaporkan (`reportHandledError`, karena respons yang ditangani tak sampai `onRequestError`). `?e` yang berisi tetapi bukan UUID → 404 SEBELUM query; tanpa saringan ini galat cast Postgres (22P02) akan dijawab "coba lagi". `?e=` kosong tetap berarti seluruh kalender, seperti dulu.
5. **OG:** galat DB → 503 `no-store` + `Retry-After`, dilaporkan. Tak ada gambar, sehingga tak ada yang di-cache CDN dan scrape berikutnya mencoba lagi. 429 dan 500 (font gagal) kini juga `no-store`: di bawah Cache Rule "Eligible for cache", respons tanpa `Cache-Control` di-cache memakai TTL bawaan per status.
6. **Layar galat berbahasa Indonesia di tiga tingkat** — `LoadErrorScreen` + `unstable_retry` (prop Next 16.2.11: `router.refresh()` + reset; bukan `reset` saja, yang merender ulang tanpa data baru):
   - `app/global-error.tsx` — boundary runtime untuk halaman DINAMIS yang tak punya boundary lebih dekat (auth, admin, marketing dinamis);
   - `app/[slug]/momen/error.tsx` & `app/preview/[id]/error.tsx` — untuk route DINAMIS: Album Momen & pratinjau. Halaman undangan `/{slug}` SENGAJA tanpa boundary segmen: boundary adalah komponen klien, sehingga `lib/copy.ts` + tombol ikut ke bundel tamu dan anggaran JS-nya terlampaui (71,2 KB > 64 KB gzip — ditangkap gerbang anggaran di CI, bukan test). Galat navigasi klien di sana jatuh ke `global-error`;
   - `app/(dashboard)/dashboard/undangan/[id]/error.tsx` — galat `getEffectiveLimits` di halaman tamu/tampilan; tanpa ini pemilik mendapat halaman galat global yang mengganti seluruh dokumen (header & navigasi hilang).
7. **Halaman 500 statis TIDAK bisa diganti** (dan review keliru soal ini). Saat render ISR `/{slug}` gagal tanpa versi baik, Next melempar ulang galat sebelum boundary segmen sempat dirender (`handleISRError`, `digestErrorsMap`) lalu menyajikan 500.html statis. Review menyarankan `app/global-error.tsx` agar halaman itu berbahasa Indonesia; **dibuktikan salah** untuk Next 16.2.11: 500.html App Router SELALU dirakit dari `next/dist/client/components/builtin/app-error.js` (komentar sumbernya: *"This is the static 500.html page for App Router apps"*; `next-app-loader` memakai `appErrorPath` tetap untuk rute itu). Build lokal memastikannya — `_global-error.html` hasil build memuat UI bawaan, bukan komponen kami, walau komponen kami ikut ter-bundle. `global-error.tsx` tetap dipertahankan karena berlaku sebagai boundary runtime halaman dinamis. Akibat yang diterima: tamu yang membuka undangan TANPA versi ter-cache saat DB terganggu melihat halaman 500 bawaan berbahasa Inggris (tak di-cache, pulih pada permintaan berikutnya).
8. **Slug yang bentuknya mustahil ditolak sebelum query** (`isPlausibleSlug`, sama dengan CHECK `^[a-z0-9-]{3,60}$`). Slug ribuan karakter membuat URL PostgREST melampaui batas gateway (414); galat itu kini dijawab 503 "coba lagi" + satu event Sentry per hit, padahal slugnya pasti tak ada. Ditemukan & direproduksi review. Dipakai di `/{slug}` (+metadata), Album Momen, `.ics` (404), dan OG (gambar default yang boleh di-cache).

**Ditolak:**
- **Degradasi jinak per bagian** (render tanpa jadwal + laporkan): halaman ISR akan MENG-CACHE degradasi itu — persis masalahnya.
- **Semantik SWR pada jalur simpan** (`revalidateTag` dengan profil alih-alih `revalidatePath`): akan mempertahankan versi baik terakhir juga sesudah pemilik menyimpan, tetapi pemilik lalu melihat versi LAMA sesaat setelah menyimpan. Ditunda, dicatat sebagai butir terbuka.
- **Fallback "stale" buatan sendiri** (menyimpan salinan data terakhir): ISR Next sudah melakukannya dengan benar bila render melempar.
- **Menjadikan galeri Album Momen melempar:** `fetchMomenPhotos` sengaja "degradasi jinak + lapor" (halaman dinamis, galeri bukan inti); dibiarkan.

**Konsekuensi:**
- Render pertama tanpa cache (belum pernah dibuka) saat DB terganggu → tamu melihat layar "belum bisa dimuat" + Coba lagi, bukan undangan palsu.
- Dashboard `tamu`/`tampilan` menampilkan layar "belum bisa dimuat" di dalam layout (header & navigasi tetap) saat DB terganggu — lebih jujur daripada batas paket palsu, dan sementara.
- **Belum dibuktikan pada server produksi:** `next build` berjalan di Windows (dipakai untuk membuktikan isi 500.html), tetapi servernya tidak (`output: standalone` → `next start` tak didukung; `node .next/standalone/server.js` gagal di Windows karena tata letak symlink pnpm). Perilaku cache per jalur di atas bersandar pada sumber Next 16.2.11 + simulasi memakai modul cache asli Next (review) — perlu dicoba di staging/Docker.
- ~~**Masih terbuka — kelas yang sama di server action tamu**~~ → **ditutup di #46** (tak ter-cache, sudah ada sebelum #45; ditemukan review):
  - personalisasi `?g=` menelan galat menjadi "token tak dikenal" → nama tamu hilang, RSVP tak tertaut, pax dipotong ke 2, `first_viewed_at` tak tercatat;
  - `submitRsvpAction`/`submitGiftNoteAction`: galat undangan dijawab "tidak menerima konfirmasi" (terdengar permanen); galat lookup tamu menyisipkan RSVP tak tertaut lalu melapor sukses;
  - dinding ucapan: galat dijawab daftar kosong tanpa penanda gagal ("Belum ada ucapan") dan tombol "Muat lebih" hilang;
  - aksi tamu Album Momen: galat dijawab "Album tidak aktif", foto yang baru dijepret dibuang.
- Test (baru):
  - `/{slug}` dirender: ketujuh bacaan gagal → melempar galatnya; ketiadaan data tanpa galat → perilaku lama;
  - pratinjau (bingkai & iframe) dan Album Momen dengan pola yang sama;
  - `getEffectiveLimits`/`resolveMusic`;
  - aksi tampilan;
  - `.ics` (503, `?e` tak sah → 404 tanpa query, `?e=` kosong → seluruh kalender, slug mustahil → 404 tanpa query/laporan);
  - **test pertama untuk route OG** (503 `no-store`, gambar default untuk tak aktif & slug mustahil, render untuk aktif, 429 & 500-font `no-store`) — cabang render satori tetap tak diuji;
  - `dataOrThrow` dengan galat berbentuk objek polos (bentuk postgrest-js sungguhan): Error berlabel, `code` & `cause` terjaga;
  - aksi tampilan: galat paket & galat tema → galat biasa + dilaporkan, tanpa menulis;
  - layar galat (tamu, pratinjau, dashboard) memanggil `unstable_retry`; halaman galat global berbahasa Indonesia (`lang="id"`), boundary dashboard tanpa `<main>` sendiri.
- Pembuktian:
  - **Galat DB nyata di aplikasi yang berjalan** (hak `SELECT` dicabut sementara di DB lokal, lalu dikembalikan identik): halaman tamu menampilkan layar "belum bisa dimuat" + Coba lagi alih-alih undangan tanpa galeri; `.ics` & OG menjawab 503 `no-store` + `Retry-After` (OG tanpa pengalihan ke gambar default); `?e` tak sah tetap 404. Sesudah hak dipulihkan, "Coba lagi" memuat undangan lengkap tanpa muat ulang manual, dan `.ics`/OG kembali 200.
  - **`next build` lokal:** dipakai untuk membuktikan bahwa 500.html hasil build memuat UI bawaan Next, bukan `global-error.tsx` kami (lihat butir 7). Server produksinya sendiri tak bisa dijalankan di Windows.
  - **Review adversarial:** 22 agen (5 lensa: semantik ISR Next, kelengkapan bacaan, HTTP & cache route, regresi pemanggil, test & dokumen; skeptis per temuan; kritik kelengkapan). 16 temuan, semuanya rendah, 1 terbantah. Empat mengoreksi klaim ADR/SPEC versi pertama: jaminan "versi baik terakhir" tak berlaku sesudah `revalidatePath`; layar galat kami tak tampil pada render ISR; `dataOrThrow` melempar objek polos; slug mustahil menjadi 503 + spam Sentry. Saran review untuk memperbaiki halaman 500 lewat `global-error.tsx` dibuktikan TIDAK berlaku di Next 16.2.11.
  - **Uji mutasi:** 50 mutan (menelan galat di tiap titik bacaan, label & `cause` galat, penjaga slug, penjaga `?e`, kode status, `no-store`, `Retry-After`, pelaporan Sentry, layar galat & `unstable_retry`, bahasa halaman galat global) — semuanya merah oleh test.

## #46 — 2026-09-23 · Aksi tamu: galat DB dijawab apa adanya, jepretan yang gagal bisa dikirim ulang

**Konteks:** #45 menutup jalur RENDER publik (halaman ISR, `.ics`, OG). Butir terbukanya adalah kelas yang sama di **server action tamu** — tak ter-cache, tetapi jawabannya menyesatkan, dan tiga di antaranya merusak data atau menghilangkan kiriman tamu. Semua ditemukan review #45, dikerjakan atas rekomendasi yang disetujui pemilik 2026-09-23.

Empat celah, diurutkan dari yang paling mahal:

1. **RSVP** (`submitRsvpAction`) — galat mencari tamu bertoken membuat `guestId` tetap null dan `paxCap` jatuh ke 2, lalu RSVP **tetap disimpan** dan tamu diberi tahu "berhasil". Akibatnya: konfirmasi tak tertaut, rombongan 6 orang tercatat 2, ekspor tamu menandainya "belum RSVP", dan kiriman ulang bertoken membuat baris KEDUA (unique index parsial hanya berlaku saat `guest_id` tak null) sehingga total pax ganda. Galat membaca undangan dijawab "Undangan ini sedang tidak menerima konfirmasi" — terdengar permanen, jadi tamu tak mencoba lagi.
2. **Personalisasi `?g=`** — galat dijawab sama dengan "token tak dikenal", dan klien lalu **membuang tokennya**. Sapaan hilang, dan RSVP berikutnya jatuh ke kasus (1) meski DB sudah pulih.
3. **Album Momen** — galat dijawab "Album tidak aktif." (permanen) padahal gangguannya sesaat; tamu berhenti memotret di hari-H. Lebih buruk: klien membuang blob jepretan begitu aksi menolak. Hitungan jepretan perangkat yang gagal jatuh ke 0, sehingga tamu yang jatahnya habis dibawa ke layar kamera dengan jatah penuh lalu ditolak gerbang kuota atomik. Galeri "muat lebih" yang gagal menghabiskan kursornya → tombolnya hilang diam-diam.
4. **Dinding ucapan** — galat dijawab daftar kosong: "Belum ada ucapan. Jadilah yang pertama…" padahal ada puluhan.

**Keputusan:**
1. **Setiap bacaan aksi tamu memeriksa `error` dan membedakannya dari "tidak ada".** Ketiadaan data tanpa galat tetap berperilaku seperti dulu (token tak dikenal → `none`, undangan tak aktif → pesan ditutup, album belum dibeli → "tidak aktif", dinding kosong → "belum ada ucapan").
2. **RSVP fail-closed:** galat membaca undangan ATAU galat mencari tamu → `copy.common.error` tanpa menulis apa pun. Lebih baik tamu mencoba lagi daripada RSVP tersimpan salah dan tak bisa dikoreksi tamu.
   **Amplop fail-open pada nama:** `gift_notes` tak menyimpan `guest_id`, jadi galat lookup nama hanya dilaporkan dan catatan tetap tersimpan dengan nama dari form — tak ada data yang salah tertaut.
3. **Personalisasi:** status baru `error` (dibedakan dari `rate` dan `none`). Klien mencoba ulang sekali (jitter yang sudah ada untuk rate limit, sekarang juga untuk galat), dan bila tetap gagal **tetap memegang token** — nama kosong, tetapi RSVP/amplop berikutnya tetap tertaut dan jatah pax-nya utuh (server memvalidasi ulang token). `first_viewed_at` yang gagal ditandai tidak menggagalkan sapaan; cukup dilaporkan.
4. **Album Momen:** `resolveActiveAlbum` mengembalikan `ok | inactive | error`; `error` → copy baru `momen.error.temporary` ("Sedang ada gangguan. Coba lagi sebentar lagi."). `deviceShotCount` mengembalikan `null` saat gagal dan sesi **ditolak sementara** alih-alih dibuka dengan jatah penuh palsu. ⚠️ Dibatalkan pada koreksi putaran kedua di bawah (butir 5): hitungan itu kosmetik, dan menolak sesi memblokir seluruh tamu tanpa menambah keamanan kuota. `fetchMomenPhotos` menandai `failed` dan **mempertahankan kursor**; `loadMomenPhotosAction` membalas `error` sehingga tombol "Muat lebih" tetap ada.
5. **`MomenUploadState.retryable`** memisahkan penolakan SESAAT (galat DB, storage, RPC claim/confirm, rate limit) dari yang PERMANEN (jatah habis, peserta penuh, album penuh/nonaktif, format ditolak, sesi tak sah). Klien menyimpan blob jepretan **hanya** bila `retryable`, lalu menampilkan tombol **"Kirim ulang foto"** yang mengirim foto yang SAMA (tanpa bake/encode ulang). Pada penolakan permanen blob tetap dilepas — tombol di sana hanya harapan palsu. Jepretan baru membuang yang tertunda (`discardPending`, sekaligus melepas object URL).
6. **Dinding ucapan:** `GuestbookPage.failed` (sejajar `rateLimited` yang sudah ada) → UI menampilkan "Ucapan belum bisa dimuat sekarang. Coba lagi"; pada "muat lebih" yang gagal, `hasMore` **tidak disentuh**.
7. **Pelaporan:** semua galat masuk Sentry lewat `reportHandledError` dengan area berlabel (`rsvp.invitation`, `rsvp.guest`, `rsvp.insert`, `rsvp.update`, `gift.invitation`, `gift.guest`, `gift.insert`, `guestbook.invitation`, `guestbook.rsvps`, `personalization.invitation`, `personalization.guest`, `personalization.firstViewed`, `momen.guest.invitation`, `momen.guest.album`, `momen.guest.shotCount`, `momen.photos.fetch`). **`guests.token` tidak pernah ikut** — identitas tamu (SPEC §11). ⚠️ Versi pertama butir ini menjaga `extra` saja dan itu TIDAK cukup; lihat koreksi #1 di bawah.

**Ditolak:**
- **Menyimpan RSVP tak tertaut lalu memperbaikinya belakangan:** tak ada kunci untuk mencocokkan ulang, dan pemilik sudah terlanjur menghubungi tamu berdasar data yang salah.
- **Melempar galat (pola #45) di aksi tamu:** aksi ini dipanggil dari klien dan tak pernah di-cache; melempar hanya menghasilkan galat Server Action generik yang tak bisa diterjemahkan ke bahasa Indonesia per kasus.
- **Coba-ulang otomatis untuk unggah foto:** menggandakan beban storage saat gangguan justru memperburuknya; tombol eksplisit memberi tamu kendali dan tetap menyelamatkan fotonya.
- **Menandai semua penolakan `retryable`:** tombol "Kirim ulang" pada jatah yang habis = harapan palsu.
- **Mengubah render awal galeri Momen menjadi galat:** tetap degradasi jinak (keputusan #45); hanya "muat lebih" yang berubah.

**Konsekuensi:**
- Saat DB terganggu, tamu melihat pesan sementara yang jujur di semua jalur; tak ada lagi konfirmasi yang "berhasil" tetapi salah tersimpan.
- Foto yang gagal diunggah bertahan di memori perangkat sampai jepretan berikutnya — satu blob, dilepas saat berhasil, diganti, atau ditolak permanen.
- Tombol `.mn-camerr__retry` di-scope `.mn-app` agar mengalahkan reset `.mn-app button { border: 0 }`; tanpa itu bingkainya hilang dan terbaca seperti teks biasa di atas panel merah (tertangkap saat pembuktian browser).
- Test (baru): `guest-action-errors` (13), `momen-guest-errors` (9), `guest-error-clients` (7 — token selamat, coba-ulang sekali, dinding gagal ≠ habis), `momen-camera-retry` (2 — pipeline kanvas dipalsukan), plus 8 test `retryable` di `momen-guest-upload`.
- Pembuktian:
  - **Galat DB nyata di aplikasi yang berjalan:** hak `SELECT` pada `momen_albums` dicabut sementara di DB lokal → unggahan dari galeri ditolak dengan "Sedang ada gangguan. Coba lagi sebentar lagi." + tombol "Kirim ulang foto"; sesudah hak dikembalikan, tombol itu menyimpan **foto yang sama** (tepat satu baris `momen_photos`, `photo_count` naik 1). Album di-`archived` → "Album tidak aktif." TANPA tombol, blob dilepas.
  - **Uji mutasi:** 23 mutan (menelan galat di tiap titik bacaan, `retryable` di tiap titik balik, token yang dibuang, coba-ulang yang dihapus, kursor galeri, penanda dinding) — semuanya merah oleh test. Mutan kamera (`retryable` diabaikan) awalnya LOLOS; `momen-camera-retry` ditulis untuk menutupnya.

**Koreksi hasil review adversarial (2026-09-23, putaran read-only sesudah commit `6b35059`).** 37 temuan dinilai, 10 lolos verifikasi tiga skeptis. Semuanya diperbaiki di commit berikutnya:

1. **`guests.token` TETAP bocor ke Sentry** — menjauhkannya dari `extra` (butir 7 di atas) tidak cukup. Server Action Next 16 di-POST ke `canonicalUrl`, yaitu URL halaman lengkap dengan `?g={token}`, dan `requestDataIntegration` Sentry melampirkan `request.url` + `request.query_string` ke SETIAP event yang ditangkap dalam request itu (`url` selalu disertakan, tanpa opsi mematikan; `query_string` ikut karena default `sendDefaultPii: false` tetap menghasilkan opsi yang truthy). Badan request Server Action RSVP/amplop bahkan memuat `guestToken` langsung. Satu kedipan DB di resepsi 300 tamu = ratusan token tamu yang masih berlaku di pelacak isu pihak ketiga — cukup untuk menimpa RSVP tamu dan, kelak, memegang identitas QR check-in Fase 2. **Perbaikan:** `lib/sentry-scrub.ts` (`beforeSend` + `beforeSendTransaction` di ketiga konfigurasi Sentry) menyensor nilai `g`/`token`/`guest_token` di URL, query string, atribut span, breadcrumb dan pesan exception, serta **membuang badan request seluruhnya**. ⚠️ Versi pertama penyaring ini MASIH bocor lewat header `referer` dan cookie; lihat koreksi putaran ketiga di bawah. Jalur ini sudah ada sebelum #46 (galat render lewat `onRequestError`, aksi Momen); #46 memperbesar frekuensinya dan membuat klaim yang salah, jadi koreksinya ikut di sini. Masih laten hari ini: DSN Sentry belum diisi (LAUNCH-CHECKLIST).
2. **"Silakan coba lagi" yang mustahil berhasil.** Turnstile diverifikasi SEBELUM bacaan DB, dan tokennya sekali pakai — begitu aksi menolak karena gangguan, token tamu sudah hangus di Cloudflare, sehingga kiriman berikutnya pasti "verifikasi gagal". Justru penolakan yang #46 perbanyak (fail-closed pada RSVP) yang paling sering terkena. **Perbaikan:** `TurnstileWidget` menerima `resetKey`; RSVP, amplop, dan mulai sesi Momen menaikkannya setiap kali kiriman ditolak.
3. **Server action yang MELEMPAR** (WiFi venue putus, id aksi basi sesudah deploy) tak pernah ditangkap: form RSVP/amplop tersangkut "Mengirim…" selamanya dengan tombol mati, dinding ucapan tersangkut "Memuat…", dan mulai sesi Momen diam tanpa pesan. **Perbaikan:** `try/catch` di kelima pemanggilan, semuanya bermuara ke pesan + jalan mencoba lagi yang sudah ada.
4. **Galat TULIS tak dilaporkan** — butir 7 menjanjikan "semua galat masuk Sentry", padahal INSERT/UPDATE `rsvps` dan INSERT `gift_notes` yang gagal hanya menjadi "Terjadi kesalahan" tanpa sinyal. **Perbaikan:** area `rsvp.insert`, `rsvp.update`, `gift.insert`.
5. **Kirim ulang memakai filter yang salah.** `sendPhoto` membaca `selectedFilter` hidup, sedangkan strip filter tetap aktif di balik panel galat: tamu yang menyentuh chip lain sambil menunggu membuat foto tersimpan dengan nama film yang tak cocok dengan pikselnya (kapsi galeri & lightbox ikut salah). **Perbaikan:** filter yang dipanggang disimpan di `pending` dan diteruskan sebagai argumen.
6. **Kirim ulang yang ditolak PERMANEN** (jatah habis lewat gerbang atomik saat menunggu) membiarkan tombolnya menempel pada blob yang object URL-nya baru saja dilepas. **Perbaikan:** `setPending(null)` di cabang non-retryable.
7. **Tombol kirim ulang menempel pada galat yang bukan miliknya** — tamu iPhone memilih HEIC, pesan berganti "format tak didukung", tombolnya tetap di bawahnya. **Perbaikan:** `pending` menyimpan pesannya sendiri; bila pesan di layar berbeda, ditambahkan baris "Satu jepretan sebelumnya belum terkirim."
8. **Pesan gagal "muat lebih" galeri tak terlihat** — perbaikan pertama memakai `fail()`, padahal panel galat & toast hanya hidup di layar KAMERA sedangkan tombolnya ada di layar galeri. **Perbaikan:** state `galleryError` sendiri, dirender tepat di atas tombolnya. (Ditemukan sendiri saat menulis testnya, bukan oleh review.)
9. **Dua celah test** yang diakui: `retryable` tak pernah di-assert falsy pada cabang confirm-deny (gerbang kuota ATOMIK — tempat kehabisan jatah sesungguhnya muncul) dan pada sesi lintas album; urutan "kirim ulang lalu ditolak permanen" tak diuji. Ditutup.

- Test (koreksi): `lib/sentry-scrub` (8), `guest-form-recovery` (6), `turnstile-widget` (3), 3 kasus kamera baru, 2 kasus galeri, 4 kasus galat tulis, 2 kasus `retryable`.
- Uji mutasi putaran dua: 18 mutan, semuanya merah. Mutan "Turnstile tak pernah di-reset" awalnya LOLOS (test form memakai widget palsu) → `turnstile-widget.test.tsx` ditulis untuk menutupnya.


**Koreksi putaran kedua (2026-09-27) — verifikasi ulang temuan yang sempat gugur.** Pada review read-only pertama, 48 agen verifikator mati kena batas sesi, sehingga **16 temuan dibuang tanpa satu pun suara**. Ke-16 itu dinilai ulang terhadap kode terkini (triase + tiga skeptis per temuan, 43 agen, tanpa kegagalan): 7 masih berlaku, 9 gugur (7 sudah tertutup koreksi pertama, 2 terbantah). Yang diperbaiki:

1. **Aksi `?g=` yang MELEMPAR tetap membuang token** (`guest-personalization.tsx`). Koreksi pertama menangkap lemparan di form RSVP/amplop dan dinding, tetapi penyedia personalisasi luput: `viewGuestByTokenAction` yang menolak dengan *rejection* (WiFi venue putus, id aksi basi sesudah deploy) membuat `setGuest` tak pernah jalan, token hilang, dan RSVP tamu kembali tersimpan tak tertaut dengan pax dipotong ke 2 — kerusakan yang persis ingin ditutup #46, lewat jalur kegagalan yang berbeda. Kini lemparan diperlakukan sama dengan status `error`: token tetap dipegang. Resolusinya dipecah ke `resolveByToken` agar `try/catch`-nya membungkus seluruh jalur.
2. **Unggah foto yang MELEMPAR menghancurkan jepretan** (`momen-camera.tsx`). `sendPhoto` hanya menyimpan jepretan pada penolakan yang MENGEMBALIKAN status; bila requestnya mati di tengah jalan (±1,5 MB di WiFi resepsi), eksekusi lompat ke `catch` di `shoot()`/`onFile()` dan blob yang sudah dipanggang ikut hilang — pesannya menyuruh "Coba lagi" tanpa satu pun cara mematuhinya. Kini `keepThrownShot` menyimpannya; jalur rana kamera (bukan cuma unggah galeri) ikut ber-test.
3. **Jepretan tertunda terdampar saat tamu menutup kamera** (temuan #7 & #15, satu perbaikan). Tombol kirim ulang dulu hanya hidup di layar kamera, padahal ✕ memindahkan tamu ke layar "habis"/"masuk" — pada album terjadwal, layar "habis" bahkan tak punya jalan kembali ke kamera sebelum reveal, jadi fotonya hilang begitu halaman ditutup. Kini baris "Satu jepretan sebelumnya belum terkirim." + tombolnya dirender di kedua layar itu, dan object URL-nya dilepas saat komponen di-unmount (dulu blob 1600px terpaku selama dokumen hidup).
4. **Spanduk dinding ucapan tak turun** (`guestbook-wall.tsx`): jalur sukses `loadMore` tak pernah `setFailed(false)`, sehingga "Ucapan belum bisa dimuat sekarang" menetap di atas daftar yang baru saja bertambah.
5. **Hitungan jepretan yang gagal memblokir SELURUH tamu** (`momen-guest.ts`, membatalkan sebagian butir 4 di atas). Keputusan awal #46 menolak sesi saat `deviceShotCount` gagal dibaca. Review membuktikan angka itu **kosmetik** — hanya mengisi pips & sisa jatah di UI; kuota sesungguhnya ditegakkan ulang secara atomik di `momen_claim_upload`/`momen_confirm_photo` (security definer + advisory lock) pada setiap unggah. Menolak sesi karenanya memblokir setiap tamu di hari-H tanpa menambah keamanan kuota sedikit pun, sementara momen tak bisa diulang. Kini **fail-open**: hitungan yang gagal jatuh ke 0 (tetap dilaporkan), dan tamu yang jatahnya memang habis ditolak akurat di gerbang atomik dengan "Jatah jepretanmu sudah habis."

**Ditemukan uji browser (2026-09-27), bukan oleh review.** Perbaikan butir 3 di atas menaruh baris "Satu jepretan sebelumnya belum terkirim." + tombolnya di layar **masuk** dan **habis** — tetapi pada album **reveal-instan** (`reveal_at` null, mayoritas album) tombol ✕ membawa tamu ke layar **galeri**, yang tak punya baris itu. Di browser: layar aktif `mn-galeri`, tiga tombol kirim ulang ada di DOM, **nol yang terlihat** — jepretannya tetap terdampar. Testnya ikut cacat: jsdom tak menerapkan `display:none`, jadi `within(".mn-masuk")` lolos padahal tamu sedang melihat layar lain. Kini `pendingRow` juga dirender di galeri, dan seluruh query test diikat ke layar yang BENAR-BENAR tampil (`.mn-screen.mn-on`) — versi ketat itu merah dulu sebelum perbaikannya dipasang. Ditambah satu mutan (M50) untuk exit galeri.

**Bug lama yang ikut terlihat:** `.mn-ghost` mendeklarasikan `border: 1.5px solid` yang SELALU mati — reset `.mn-app button { border: 0 }` (0,1,1) mengalahkannya (0,1,0), sehingga setiap tombol ghost Album Momen ("Lihat Album", "Muat lebih banyak") tampil seperti teks biasa. Ada sejak tema Momen ditulis, bukan dari #46; diperbaiki sekalian dengan men-scope ke `.mn-app .mn-ghost`, satu baris di berkas yang sama.


**Koreksi putaran ketiga (2026-09-27) — review atas KOREKSInya sendiri.** Kedua commit koreksi (`6cd3e5c`, `2041223`) belum pernah ditinjau siapa pun, padahal ±700 baris di jalur tamu paling sensitif. Review read-only menilainya lewat lima lensa; kuota sesi kembali habis (68 dari 107 agen mati), jadi hanya 5 temuan yang sempat diverifikasi penuh dan 29 lainnya gugur TANPA suara. Yang diperbaiki di sini adalah temuan terverifikasi ditambah temuan tanpa-suara yang klaimnya bisa saya buktikan sendiri terhadap kode & `node_modules`:

1. **Token tamu TETAP bocor ke Sentry — lewat `Referer`** (terverifikasi 3/3, high). Koreksi pertama menyensor `request.url` + `query_string` dan membuang `request.data`, tetapi POST Server Action bersifat *same-origin* dan `Referrer-Policy: strict-origin-when-cross-origin` mengirim URL halaman UTUH: `request.headers.referer` memuat `?g={token}` apa adanya. Diverifikasi langsung di `@sentry/core@10.67.0`: dengan `sendDefaultPii: false`, `defaultPiiToCollectionOptions` mengembalikan `cookies: {deny: …}` dan `httpHeaders.request: {deny: …}` — **objek, bukan `false`** — sedangkan gerbangnya `dataCollection.cookies !== false` / `httpHeaders.request !== false`, jadi keduanya IKUT terkirim; daftar `deny` tak pernah diterapkan di jalur event (hanya di atribut span). Ikut bocor: header `cookie` + `request.cookies`, yang membawa sesi unggah Album Momen ber-tanda-tangan dan token auth Supabase **pemilik**. Kini header disensor, `cookie`/`authorization` dan `request.cookies` dibuang utuh, `contexts.*` (termasuk `contexts.nextjs.request_path` dari `onRequestError`) ikut disaring, dan penyaringnya **fail-closed**: bila ia sendiri melempar, eventnya dibuang (`null`) alih-alih dikirim setengah bersih.
   **Testnya juga cacat:** seluruh fixture dirakit tangan hanya dari url/query_string/data, sehingga `not.toContain(TOKEN)` lolos karena field-nya memang tak ada — bukan karena disensor. Fixture baru mengikuti bentuk yang benar-benar diisi Sentry (header, cookie, contexts).
2. **Kirim ulang yang GAGAL dari layar masuk/habis/galeri tak memberi tanda apa pun** — panel galat & toast hanya hidup di layar kamera. Baris jepretan tertunda kini menampilkan pesan kegagalan TERAKHIR miliknya sendiri (`pending.message`, diperbarui tiap percobaan, termasuk saat pengirimannya melempar).
3. **`discardPending()` berjalan SEBELUM bake** di `shoot()` dan `onFile()`: bila `bakeAndEncode` gagal (kanvas kehabisan memori di HP murah), jepretan tertunda yang masih bisa dikirim ikut musnah padahal penggantinya tak pernah ada. Kini jepretan lama baru dilepas SESUDAH penggantinya jadi.
4. **Muat ulang dinding ucapan yang gagal menyapu ucapan yang sudah tampil** — `refreshKey` naik sesudah tamu mengirim, bacaannya gagal, dan `setEntries(res.entries)` menimpa daftar dengan array kosong. Kini daftar dibiarkan; hanya spanduk gagal yang muncul.

- Test (koreksi ketiga): 4 fixture Sentry realistis (referer, cookie, contexts, fail-closed), pesan kegagalan di layar non-kamera, bake gagal dari rana DAN dari galeri, pelepasan blob jepretan yang digantikan, muat ulang dinding yang gagal.
- Uji mutasi putaran empat: 12 mutan, semuanya merah. Tiga sempat lolos: dua karena mutannya salah sasaran (menghapus `discardPending`, bukan mengembalikan urutan lama), satu karena jalur **rana kamera** tak pernah diuji — testnya ditulis, lalu mutannya mati. URL blob kini unik per jepretan di test, sehingga kebocoran memori bisa di-assert tepat sasaran.

**Belum tuntas:** ~~29 temuan review putaran ini gugur karena agennya mati~~ → dinilai ulang di koreksi putaran keempat di bawah (23 yang bersuara kurang dari tiga; 8 bertahan, semuanya diperbaiki). Catatan aslinya: gugur karena agennya mati, bukan karena terbantah — beberapa masih layak dinilai (mis. Turnstile yang di-reset pada penolakan yang belum memakai token; risiko foto ganda bila respons unggah hilang padahal server sudah menyimpan; widget Turnstile di form auth pemilik yang tak ikut di-reset). Perlu putaran verifikasi ulang saat kuota pulih, dengan pola yang sama seperti koreksi putaran kedua.


**Koreksi putaran keempat (2026-09-27) — 23 temuan yang verifikasinya gugur, dinilai ulang.** Review atas koreksi menghasilkan 34 temuan, tetapi 68 agen mati kena batas sesi sehingga 23 di antaranya gugur TANPA tiga suara. Dinilai ulang terhadap kode terkini (triase + tiga skeptis, 62 agen): 8 masih berlaku, 15 gugur (11 sudah tertutup koreksi putaran ketiga, 4 terbantah). Yang diperbaiki:

1. **Penolakan PERMANEN atas kirim ulang dari layar habis/galeri hilang tanpa jejak** (terverifikasi 3/3). Koreksi putaran ketiga menaruh pesan kegagalan di baris jepretan — tetapi baris itu HANYA ada selama jepretannya tertunda. Saat penolakannya permanen (jatah habis lewat gerbang atomik, album diarsipkan host, sesi kedaluwarsa), `sendPhoto` melepas blob dan menghapus barisnya, lalu menulis pesan ke `error` + toast yang keduanya hidup di layar KAMERA — `display:none` saat tamu ada di habis/galeri. Yang dilihat tamu: barisnya lenyap begitu saja, tak bisa dibedakan dari kiriman yang berhasil, padahal satu-satunya salinan jepretan yang tak terulang baru saja dibuang. Kini ada `errorLine` di ketiga layar terang (tak digandakan bila pesannya sama dengan pesan jepretan).
2. **Kirim ulang bisa MENGGANDAKAN foto dan memakan jatah kedua** (terverifikasi, medium). `keepThrownShot` di putaran kedua membuat unggah yang MELEMPAR bisa dikirim ulang — tetapi bila requestnya sampai di server dan hanya responsnya yang hilang, fotonya sudah tersimpan: `momen_claim_upload` membuat `photo_id` BARU tiap panggilan, jadi percobaan kedua menyisipkan baris kedua dan memakan slot kuota kedua. **Kini idempoten tanpa migrasi:** klien membuat `shotId` sekali per jepretan (disimpan di `Variants`, dikirim ulang apa adanya), server memakainya sebagai identitas foto — pra-cek `momen_photos.id` menjawab "ok" tanpa menyentuh kuota/storage bila barisnya sudah ada, dan tabrakan primary key (23505) pada `confirm` juga diperlakukan sebagai sukses (menutup balapan). `momen_photos.id` sudah primary key dan `momen_confirm_photo` sudah menerima `p_photo_id`, jadi tak ada perubahan skema maupun tanda tangan RPC; gerbang kuota atomik tak disentuh.
3. **Turnstile di-reset pada penolakan yang belum memakai tokennya** (terverifikasi 3/3). Urutan aksi tamu: Zod → honeypot → rate limit → Turnstile → DB. Penolakan `invalid` dan `rate` terjadi SEBELUM verifikasi, jadi tokennya masih sah; me-reset di situ membuang tantangan yang baik dan membuat kiriman perbaikan berikutnya ditolak "Verifikasi anti-bot gagal" karena token barunya belum tiba. Kini reset hanya untuk penolakan yang memang sudah melewati verifikasi (`tokenTerpakai`).
4. **Form auth pemilik tak pernah ikut di-reset** (terverifikasi 3/3): `TurnstileField` memakai widget yang sama tetapi tak punya `resetKey`, sehingga pendaftaran dan reset kata sandi punya jalan buntu yang sama. Kini kedua form menaikkannya pada penolakan non-validasi.
5. **Lemparan `?g=` melewati coba-ulang ber-jitter** (terverifikasi 3/3, low). Putaran kedua menyelamatkan TOKEN-nya, tetapi lemparan langsung jatuh ke penangkap terluar — sapaan tamu hilang padahal penolakan setara yang mengembalikan status akan pulih. Kini lemparan diperlakukan sebagai `status: "error"` sebelum coba-ulang.

- Test (koreksi keempat): penolakan permanen dari layar lain yang terlihat + blob dilepas; `shotId` sama pada kirim ulang dan berbeda antar-jepretan; pra-cek idempoten tanpa claim/unggah; identitas foto dari klien dipakai di `confirm` & path; 23505 → sukses tanpa menghapus objek; reset Turnstile hanya sesudah verifikasi; lemparan `?g=` yang pulih di percobaan kedua.
- Uji mutasi putaran lima: 13 mutan, semuanya merah.

**Terbantah / sudah tertutup:** kebocoran `Referer` & cookie, `contexts.nextjs.request_path`, penyaring yang tak fail-closed, `discardPending` sebelum bake, dan muat ulang dinding yang menyapu ucapan — semuanya sudah ditutup putaran ketiga; sisanya dinilai tak berdasar oleh mayoritas suara.


**Putaran review TERAKHIR (2026-09-27) — #46 ditutup di sini.** Atas keputusan pemilik: satu putaran atas `abff40e`, lalu berhenti apa pun hasilnya; hanya temuan **high** dikerjakan, medium dicatat sebagai butir terbuka. Review dibatasi melaporkan medium ke atas saja (maksimal enam per lensa) supaya kuota agen tak habis di tengah seperti dua putaran sebelumnya — hasilnya 70 agen selesai TANPA satu pun gagal: 22 temuan dinilai, 5 high, 11 medium, 6 terbantah.

Kelima temuan high semuanya di **perubahan idempotensi yang baru saja dibuat di putaran keempat** — tiga cacat berbeda, semuanya akibat satu keputusan: identitas foto kini DIPILIH KLIEN sementara `momen_photos.id` adalah primary key GLOBAL lintas album.

1. **Objek storage yatim yang menembus setiap gerbang kuota.** Pra-cek dedupe di-scope `album_id`, jadi id milik album LAIN tak terdeteksi; id semacam itu bisa dipungut tanpa autentikasi dari HTML publik album mana pun yang sudah reveal (`app/[slug]/momen/page.tsx` menyerialkan `id` setiap foto). Alurnya: pra-cek meleset → `momen_claim_upload` lolos (ia menghitung BARIS milik perangkat, dan perangkat itu memang belum punya) → dua objek ditulis ke storage → `confirm` gagal 23505 → kode lama menjawab "ok" **sebelum** `cleanup()`. Hasil: tak ada baris, `photo_count` tak naik, perangkat tak pernah jadi peserta, jatah tak terpakai, dan objeknya tak akan pernah dibersihkan — `purge_invitation_data` sengaja hanya mengenumerasi path dari BARIS karena mengasumsikan path ber-UUID acak, asumsi yang persis dipatahkan id pilihan-klien. Rem yang tersisa hanya rate limit.
2. **`cleanup()` menghapus objek milik baris yang SUDAH commit.** Karena semua percobaan atas jepretan yang sama kini berbagi satu path, penolakan `confirm` pada percobaan kedua (mis. `guest-quota` yang justru disebabkan baris percobaan pertama) menghapus objek foto yang sudah tersimpan — host mewarisi foto rusak permanen. Sebelum id pilihan-klien ini mustahil: tiap percobaan punya path sendiri.
3. **Pra-cek memperlakukan "ada baris" sebagai bukti "objeknya ada".** Bila objeknya sudah terhapus oleh (2), jalur idempoten menjawab "tersimpan", klien membuang blob-nya, dan jepretan yang tak terulang hilang sambil dilaporkan sukses.

**Perbaikan (tanpa migrasi):** helper `shotOwner()` membaca baris berdasarkan id SAJA lalu membandingkan `album_id` **dan** `device_id`. Pra-cek: `mine` → ok; `foreign` → ditolak permanen SEBELUM satu byte ditulis; `none` → lanjut. Sesudah 23505: `mine` → ok **tanpa** `cleanup()` (objeknya milik baris yang sudah commit); selain itu → `cleanup()` + tolak. Penolakan `confirm` biasa: bila baris kita sudah ada → sukses tanpa menghapus apa pun; galat `confirm`: `bersihkanBilaYatim()` hanya menghapus bila tak ada baris yang memilikinya.

- Test: penyaring `id` benar-benar di-assert (mock lama mengabaikan seluruh argumen `.eq()` — temuan review tersendiri), id milik album lain dan perangkat lain ditolak tanpa menyentuh RPC/storage, 23505 atas id pinjaman dibersihkan, 23505 atas baris sendiri sukses, dan penolakan `confirm` atas baris yang sudah commit tak menghapus objek.
- Uji mutasi putaran enam: 4 mutan, semuanya merah.

**Butir terbuka — TIDAK dikerjakan, sesuai keputusan pemilik (11 temuan medium, semuanya bertahan verifikasi):**
- `momen_photos.id` sebaiknya kembali `gen_random_uuid()` server dan id klien disimpan di kolom terpisah `client_shot_id` dengan unique index `(album_id, client_shot_id)` — idempotensi yang sama tanpa menyerahkan primary key global ke tamu. Butuh migrasi, jadi ditunda sampai ada staging.
- `remaining` pada jalur idempoten memakai hitungan yang fail-open: satu bacaan gagal mengembalikan jatah PENUH ke tamu di tengah sesi.
- Form masuk Album Momen masih membuang tantangan Turnstile yang sah pada penolakan pra-verifikasi (perbaikan `tokenTerpakai` baru diterapkan ke RSVP & amplop).
- `useTurnstileReset` di form daftar ikut me-reset pada penolakan rate limit, yang juga terjadi sebelum verifikasi.
- Wiring reset Turnstile di form reset kata sandi praktis kode mati (aksinya menolak lewat `fieldErrors`), sehingga klaim ADR putaran keempat soal form itu hanya separuh benar.
- `remaining` pada kedua jalur sukses baru tak pernah di-assert test.

**Catatan penutup #46.** Enam commit, empat putaran koreksi, satu uji browser. Polanya konsisten dan layak diingat: **setiap lapis perbaikan melahirkan cacat baru di lapisan itu sendiri**, dan yang menangkapnya selalu mata di luar penulisnya — review adversarial, lalu uji browser, lalu review lagi. Test buatan sendiri tiga kali lolos karena alasan yang salah (fixture Sentry tanpa header, query ke layar tersembunyi, mock yang mengabaikan `.eq()`). Hal-hal yang tersisa di atas menunggu bukti dari lingkungan nyata, bukan putaran review berikutnya.

**Masih terbuka (ditunda atas permintaan pemilik):** review menilai `reportHandledError` kini menambah ~13 titik tangkap tanpa sampling di jalur tamu terpanas, sehingga satu gangguan DB di resepsi besar bisa menghabiskan kuota Sentry. Ditunda bersama pengaktifan DSN Sentry (LAUNCH-CHECKLIST) — selama DSN kosong, semua titik itu no-op.

**Terbantah / sudah tertutup:** penolakan Turnstile, filter kirim ulang, galat format yang mencuri tombol, dan galeri "muat lebih" yang senyap sudah ditutup koreksi pertama; pesan seragam untuk penolakan yang berbeda (3 suara) dan catatan `first_viewed_at` di #45 (2 dari 3 suara) dinilai tak berdasar.

- Test (koreksi kedua): token selamat dari aksi yang melempar; spanduk dinding turun sesudah berhasil; sesi tetap dibuka saat hitungan gagal; jepretan rana & galeri selamat dari lemparan; tombol kirim ulang terjangkau dari layar masuk; object URL dilepas saat unmount.
- Uji mutasi putaran tiga: 9 mutan, 8 merah. Satu SETARA (`resolveByToken(...).catch(() => { throw … })` — lemparannya tetap ditangkap `try/catch` yang sama, perilaku identik). Dua mutan sempat lolos (jalur rana kamera & pelepasan object URL) sampai testnya ditulis: jsdom butuh `getUserMedia` + `videoWidth` palsu agar tombol rana benar-benar berjalan.

- **Catatan proses:** review adversarial pertama untuk #46 dibatalkan di tengah jalan — agennya **mengedit file sumber** untuk menguji mutasinya sendiri (tiga file sempat ter-revert). Pohon kerja dipulihkan dan diperiksa ulang terhadap diff; review diulang dengan instruksi read-only sesudah commit.

## #47 — 2026-10-01 · Custom SMTP Supabase naik jadi WAJIB; kegagalan aksi auth berhenti senyap

**Keputusan:** (a) `docs/LAUNCH-CHECKLIST.md` menaikkan Custom SMTP → Resend dari
_"(Opsional)"_ menjadi **butir wajib Fase 2** dengan uji terima eksplisit;
(b) empat titik kegagalan di `src/server/actions/auth.ts` yang sebelumnya tak
meninggalkan jejak apa pun kini memanggil `reportHandledError` — `auth.signup`,
`auth.reset`, `auth.update-password`, `auth.oauth`. **Jawaban ke pengguna tidak
berubah sedikit pun**: anti-enumerasi tetap utuh.

**Alasan:** Audit standar SaaS (`audits/AUDIT-2026-10-01-standar-saas.md`, temuan
A1) menemukan bahwa jalur daftar → verifikasi → masuk **belum pernah sekali pun
berhasil di proyek produksi** — `auth.users` berisi tepat satu baris, admin yang
dibuat manual (`confirmation_sent_at` NULL, `email_confirmed_at` sama persis
dengan `created_at`). Kriteria terima SPEC §4.2 belum pernah dijalankan terhadap
cloud.

Penyebab paling mungkin bukan soal kuota. Dokumentasi Supabase menyatakan SMTP
bawaannya **menolak mengirim ke alamat yang bukan anggota tim project**, jadi
untuk produk self-service deliverability ke pelanggan = **0%**, bukan 2 email/jam
— dan karena `Confirm email` aktif, pendaftar tak akan pernah bisa masuk.
`docs/AUTH-SETUP.md` sebelumnya menyebut alasannya hanya "dibatasi rate-nya",
yang membuat butir ini terbaca sebagai optimasi, bukan prasyarat. Itu ikut
diperbaiki.

Yang membuatnya berbahaya adalah ketiadaan sinyal, bukan kegagalannya:
`requestPasswordResetAction` sengaja **selalu** menjawab sukses generik demi
anti-enumerasi (#39), sehingga layar berbunyi "tautan sudah dikirim" walau tak
ada yang terkirim; `signUpAction` menjawab pesan generik. Keduanya benar sebagai
keputusan keamanan — yang hilang murni jejak diagnostiknya, persis kelas yang
sudah ditutup `reportHandledError` di jalur pembayaran & tamu (KUA-4, #46).
**Anti-enumerasi mengatur jawaban ke pengguna, bukan telemetri server.**

**Ditolak:**
- *Menambah `console.warn`/`console.error`* — pola yang justru dikritik audit di
  `src/server/email/notify.ts`: komentarnya mengklaim "Sentry menangkap console",
  padahal tak ada `captureConsoleIntegration` di ketiga `Sentry.init`, sehingga
  jejaknya hanya jadi baris stdout yang lenyap saat redeploy.
- *Melaporkan kegagalan `signInAction`* — kata sandi salah adalah galat pengguna
  yang wajar, bukan kerusakan sistem; melaporkannya akan membanjiri Sentry.
- *Melaporkan "email sudah terdaftar"* — itu jalur normal anti-enumerasi, bukan
  kegagalan. Mutan M6 menguji tepat ini.
- *Memasukkan email ke `extra`* — `extra` ikut terkirim ke Sentry. Hanya `code`
  dan `status` yang dikirim; mutan M5 (menyuntikkan `email` ke `extra`) dipakai
  membuktikan assertion negatifnya benar-benar menggigit.

**Konsekuensi:**
- Telemetri ini **no-op selama `NEXT_PUBLIC_SENTRY_DSN` kosong**. Jadi A1 belum
  benar-benar tertutup sampai DSN diisi — checklist kini menyatakan itu sebagai
  prasyarat fase, bukan catatan kaki. Ini bersinggungan dengan butir terbuka #46
  (volume tangkap Sentry tanpa sampling) yang tetap ditunda.
- Setelan Custom SMTP hidup di dashboard Supabase cloud, **tidak ter-versioning
  di repo**. `supabase/config.toml` hanya mengatur stack lokal (`project_id`,
  port 54321, `[local_smtp]` mail-catcher) dan **tidak** membuktikan apa pun
  tentang produksi — kekeliruan yang sempat dibuat auditor putaran pertama dan
  dikoreksi penguji.
- Aksi auth sebelumnya **tidak punya satu pun test**. `tests/unit/auth-action-errors.test.ts`
  (9 tes) menutup itu sekaligus mengunci invarian anti-enumerasi, sehingga
  "memperbaiki UX pesan sukses" kelak akan menjatuhkan test, bukan lolos diam-diam.
- Uji mutasi: 7 mutan, **7 merah** (baseline diverifikasi `returncode 0` pada
  invokasi yang sama, agar "mutan mati" tak tertukar dengan runner yang rusak).

---

## #48 — 2026-10-01 · Riwayat pesanan `/dashboard/pesanan` + satu saluran dukungan; `orders` dibaca kolom-per-kolom

**Keputusan:** (a) halaman `/dashboard/pesanan` menampilkan SELURUH order pemilik
(aktivasi, perpanjangan, add-on Album Momen), terbaru dulu, berhalaman 20;
(b) `copy.support` menjadi satu-satunya sumber alamat dukungan, dirender di footer
dashboard, boundary galat dashboard, dan kartu `review`/`timeout`/`error` pada
KEDUA poller pembayaran; (c) bacaan `orders` menyebut kolomnya satu per satu —
`select("*")` dilarang di jalur pelanggan; (d) `SPEC.md` §4.8 diperluas lebih dulu.
**Tanpa migrasi.**

**Alasan.** Audit A4/A5 (`audits/AUDIT-2026-10-01-standar-saas.md`). Satu-satunya
bacaan order dari sisi pelanggan ada di `dashboard/undangan/[id]/bayar/page.tsx`
dengan `.limit(1)`, pada halaman yang tak bisa dijangkau lagi dari UI setelah
membayar — perpanjangan dan add-on menimbun order aktivasi pertama. Jadi satu-satunya
bukti transaksi adalah email kuitansi sekali kirim tanpa retry, sementara kebijakan
refund justru MEWAJIBKAN pelanggan menyebut kode order yang hanya hidup di email itu.
Bersamaan dengan itu, `copy.paymentStatus.reviewBody` dan `copy.momen.payment.reviewBody`
menyuruh "hubungi kami" TANPA alamat apa pun — tepat pada layar yang muncul ketika
uang pelanggan sudah keluar tetapi undangannya belum aktif.

**Temuan keamanan yang muncul saat merancang, bukan saat mengaudit:** §6b
`init_schema.sql:500-518` mencabut hak per-kolom untuk `profiles`, `invitations`, dan
`rsvps` — dan **melewatkan `orders`**. Grant SELECT `authenticated` di tabel itu masih
mencakup seluruh kolom, termasuk `raw_notification` yang berisi payload mentah Pakasir
pada jalur webhook dan `{"source":"admin_manual","admin_id":"<uuid>"}` pada aktivasi
manual. `ORDER_COLUMNS` adalah satu konstanta yang dipakai setiap bacaan, dan mutan
`select("*")` diuji merah. Konsekuensi lanjutan yang dicatat: **jangan pernah menambah
policy UPDATE pada `orders`** — satu policy longgar langsung membuat pelanggan bisa
menulis ulang `status` dan `amount_idr` miliknya sendiri.

**Ditolak:**
- *Klien service_role untuk `orders`* — `orders_select` sudah mengizinkan pemilik.
  Admin client di sini HANYA menyentuh `packages`. Keduanya hidup di satu fungsi
  (`attachRefs`), jadi satu kelalaian `.eq("user_id", …)` di jalur admin akan
  membocorkan order seluruh pelanggan; test mengunci bahwa `orders` tak pernah
  disentuh klien admin.
- *Membaca `packages` dengan klien sesi* — `packages_select_public` =
  `using (is_active or is_admin())`, jadi paket yang dinonaktifkan saat pemilik
  mengganti harga mengembalikan NULL SECARA SENYAP: riwayat lama kehilangan nama paket
  DAN kehilangan `kind`, sehingga add-on salah label. Preseden identik:
  `src/server/momen/orders.ts`.
- *Menyimpulkan jenis order dari nominal* — `premium` dan `momen_50` sama-sama
  Rp199.000. Label jenis HANYA dari `packages.kind`.
- *Menulis "Perpanjangan"* — aktivasi pertama, bayar-ulang, dan perpanjangan
  menghasilkan baris `orders` yang bentuknya persis sama. Menyimpulkannya dari urutan
  `created_at` akan salah begitu admin memakai `admin_extend_invitation` (tak membuat
  order sama sekali).
- *`wibDate`* — `admin/order/page.tsx` memakainya sehingga dua order di hari yang sama
  tampil identik, persis skenario bayar-ulang yang membuat halaman ini dibutuhkan.
  Halaman pelanggan memakai `wibDateTime`.
- *Membangun ulang link pembayaran Pakasir di riwayat* — `getPaymentGateway()` MELEMPAR
  bila `PAKASIR_PROJECT_SLUG` kosong, dan itu akan mematikan seluruh halaman. Riwayat
  menautkan ke `/bayar` yang sudah ada.
- *Migrasi* — seluruh data yang ditampilkan sudah ada, `orders_user_idx` sudah ada, dan
  `orders_select` sudah mengizinkan pemilik. Yang sengaja TIDAK ditambahkan dan
  konsekuensinya diterima: `updated_at` (waktu transisi ke `expired`/`refunded` tak
  terekam), snapshot nama paket (rename paket menulis ulang sejarah), dan penanda siklus.

**Konsekuensi:**
- Halaman ini memakai `dataOrThrow`, **berbeda** dari halaman dashboard lain yang
  memakai `data ?? []`. Disengaja: halaman yang gunanya membuktikan pembayaran tak boleh
  menjawab "belum ada pesanan" saat DB bermasalah — kebohongan itu persis yang membuat
  pelanggan mengira uangnya hilang. Karena itu `(dashboard)/dashboard/error.tsx` masuk
  commit yang sama; tanpa boundary itu galatnya naik ke `global-error.tsx` yang mengganti
  seluruh dokumen sehingga header, navigasi, dan kontak dukungan ikut hilang.
- Riwayat **tidak** menjanjikan kelengkapan, dan copy-nya sengaja tak memakai kata
  "semua": `orders.invitation_id` NOT NULL dengan `on delete cascade`, dan pemilik boleh
  hard-delete undangan `draft` — order `pending` bisa ikut terhapus. Order **lunas** aman
  (selalu membuat undangan `active`/`suspended` yang tak bisa dihapus, dan purge retensi
  secara eksplisit mempertahankan `orders`).
- `admin_extend_invitation` tak membuat baris order → masa aktif bisa bertambah tanpa
  jejak di riwayat. Sebaliknya `admin_activate_invitation` membuat order
  `payment_method='manual'` walau uangnya bergerak di luar sistem; labelnya menjelaskan itu.
- Status `failed` dan `refunded` dirender lengkap tetapi **tak pernah ditulis kode mana
  pun**. Jangan ada yang menyimpulkan dari halaman ini bahwa alur refund sudah ada
  (temuan A3 masih terbuka).
- `halo@merriva.id` kini dijanjikan dari dalam produk di banyak tempat → **wajib mailbox
  nyata yang dijaga sebelum launch**, sejenis dependensi Custom SMTP (#47). Bila belum,
  kita menjanjikan kanal yang mem-bounce — lebih buruk daripada keadaan sebelumnya.
- Uji mutasi: 16 mutan, **16 merah**, baseline diverifikasi `returncode 0` pada invokasi
  yang sama. Termasuk M5 (kembali ke perilaku `.limit(1)` lama), M1 (`select("*")`),
  M4 (paket dibaca klien sesi), M11 (kartu perhatian mengabaikan `kind`), dan M15
  (string kosong diteruskan sebagai kode order).

**Potongan kedua (2026-10-01, commit terpisah).** Halaman kuitansi
`/dashboard/pesanan/[kode]` ditambahkan: dokumen yang bisa dicetak/disimpan PDF lewat
`window.print()` (nol dependency baru — Chrome Android & Safari iOS sama-sama menawarkan
"Simpan sebagai PDF"), dengan penerbit + alamat kontak yang SELALU tercetak. `PrintButton`
diangkat dari `components/dashboard/momen/` ke `components/print-button.tsx` dengan label
sebagai prop, sehingga kartu QR Momen dan kuitansi memakai satu komponen. `receipt.css`
sengaja TIDAK memakai trik `visibility:hidden` + `position:fixed` seperti `momen-qr.css`:
kartu QR selalu muat satu halaman A6, sedangkan kuitansi bisa tumbuh melewati satu halaman
dan trik itu akan memotong isinya.

Penjagaan akses: kode order milik orang lain dijawab IDENTIK dengan kode yang tak ada
(keduanya `notFound()`), sehingga halaman ini tak bisa dipakai sebagai oracle untuk menebak
kode pelanggan lain. Uji mutasi putaran kedua: 9 mutan, 9 merah — tetapi K2 (galat DB pada
lookup kuitansi dijawab `null` alih-alih dilempar) **selamat pada percobaan pertama**, dan
itu celah nyata: pelanggan akan diberi tahu bukti pembayarannya TIDAK ADA padahal yang gagal
hanya koneksi DB. Testnya ditulis setelah mutan itu menunjukkannya, bukan sebelumnya.

**Masih belum dikerjakan:** `replyTo` + footer email yang berhenti berkata "jangan membalas",
dan tombol kirim-ulang kuitansi. Keduanya menunggu kepastian bahwa `halo@merriva.id` adalah
mailbox nyata yang dijaga — tanpa itu kita mengubah email transaksional agar menyuruh
membalas ke alamat yang mem-bounce, lebih buruk daripada keadaan sekarang.

---

## #49 — 2026-10-01 · Tombol "lihat kata sandi", bukan kolom konfirmasi

**Keputusan:** ketiga form kata sandi (daftar, masuk, atur ulang) memakai
`PasswordInput` dengan tombol lihat/sembunyikan, dan syarat panjang ditampilkan
sebagai hint statis **sebelum** submit. `registerSchema` **tidak** diberi field
`confirm`.

**Alasan.** Pertanyaan pemilik yang memulai audit ini: *"kenapa kata sandi tidak
diverifikasi saat mendaftar? kenapa hanya 1x?"* Jawabannya ternyata inkonsistensi,
bukan keputusan — `updatePasswordSchema` punya `confirm` + `.refine`, `registerSchema`
tidak, dan `SPEC.md` §4.2 tak pernah menyebut keduanya. String `passwordConfirm:
"Ulangi kata sandi"` bahkan sudah ada di `copy.ts` tetapi hanya dipakai di halaman reset.

Tetapi menambah kolom kedua bukan perbaikan yang benar untuk produk ini. Halaman ini
hidup di HP: mengetik kata sandi dua kali di keyboard ponsel kerap disiasati
salin-tempel dari kolom pertama, sehingga salah ketiknya ikut tersalin dan kolom
konfirmasi tak menangkap apa pun. NIST SP 800-63B §5.1.1.2 menganjurkan
memperlihatkan kata sandi ketimbang memintanya dua kali.

Cacat sebenarnya bukan "tidak ada konfirmasi" melainkan **tidak ada satu pun dari dua
desain yang sah**: tak ada konfirmasi DAN tak ada tombol lihat. Pengguna mengetik buta,
lalu salah ketiknya baru ketahuan saat login berikutnya dengan pesan "Email atau kata
sandi salah" — yang justru mengarahkan dugaan ke email. Diperparah anti-enumerasi:
mendaftar ulang menjawab "Akun dibuat. Kami mengirim tautan verifikasi" tanpa mengirim
email apa pun.

**Ditolak:**
- *Menambah `confirm` ke `registerSchema`* — alasan di atas. Halaman reset tetap punya
  `confirm` dan itu dibiarkan: di sana pengguna TIDAK bisa memakai jalur pemulihan
  kedua kalinya dengan mudah, jadi biaya salah ketiknya berbeda.
- *Indikator kekuatan (`zxcvbn` dsb.)* — dependency baru di jalur kritis demi sinyal
  yang tak menolak apa pun. Yang benar-benar menahan kata sandi lemah adalah Leaked
  Password Protection di sisi Supabase (butir LAUNCH-CHECKLIST yang masih terbuka,
  temuan B5), bukan meter di klien.
- *Hanya memperbaiki form pendaftaran* — halaman MASUK justru tempat korban salah-ketik
  terjebak; tanpa tombol lihat di sana ia tetap tak bisa memeriksa apa yang diketiknya.

**Konsekuensi:**
- Tombolnya WAJIB `type="button"`. Tanpa itu ia menjadi tombol submit default di dalam
  `<form>` dan menekan "lihat" justru mengirim formulir — pada halaman daftar itu berarti
  membakar satu tantangan Turnstile. Mutan P2 menguji tepat ini.
- `aria-label` berbunyi sebagai PERINTAH ("Tampilkan/Sembunyikan kata sandi") dan berubah
  mengikuti keadaan, dengan `aria-pressed` sebagai status. Mutan P3 & P4 menguji keduanya
  — label yang tak berubah lolos test naif karena tombolnya tetap ada.
- Hint ditautkan lewat `aria-describedby` ke id dari `useId()`, bukan sekadar `<p>` di
  bawahnya: pembaca layar harus mendengar syaratnya saat fokus di field, bukan setelah
  melewatinya.
- Nilai field bertahan saat `type` ditukar karena React tidak me-remount elemennya; bila
  kelak komponen ini dipecah dua dan di-render bergantian, nilainya akan hilang saat
  tombol ditekan. Dikunci test.
- Uji mutasi: 8 mutan, 8 merah (baseline `returncode 0` diverifikasi).
- **Belum dikerjakan (B5):** kebijakan kata sandi masih berhenti di panjang 8 tanpa
  blocklist, dan Leaked Password Protection masih mati di dashboard Supabase. Tombol ini
  memperbaiki salah-ketik, bukan kata sandi lemah — jangan tertukar.

---

## #50 — 2026-10-01 · Ganti kata sandi dari dalam akun; `current_password` GoTrue sengaja TIDAK dipakai

**Keputusan:** `/dashboard/profil` mendapat kartu "Ubah kata sandi" dengan tiga field
(sandi saat ini, baru, ulangi) lewat `changePasswordAction`. Kata sandi lama
diverifikasi SENDIRI dengan `signInWithPassword` pada klien anon TANPA cookie
(`createSupabasePublicClient`), bukan dengan parameter `current_password` milik GoTrue.

**Alasan.** Audit B1: produk sama sekali tak punya jalur ganti kata sandi — pelanggan
yang hanya ingin mengganti sandi harus berpura-pura lupa dan menunggu email, dan bila
emailnya masuk spam atau alamatnya sudah tak terpakai, ia tak punya jalan lain sama
sekali.

**Jebakan yang nyaris saya masuki, dan kenapa dicatat di sini.** Dokumentasi Supabase
menampilkan `updateUser({ current_password, password })` sebagai cara meminta kata sandi
lama. Tipe `UserAttributes` di `@supabase/auth-js@2.110.8` menyatakan sebaliknya dalam
komentarnya: *"This is only ever present when the user is resetting their password and
`GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD` is true."* Artinya bila
setelan proyek itu MATI — dan di proyek ini ia memang belum disentuh — parameter tersebut
**diabaikan diam-diam**. Kodenya akan lolos review, lolos typecheck, dan tampak aman
sambil tidak memverifikasi apa pun. Mutan C4 menguji tepat ini: menambahkan
`current_password` ke panggilan `updateUser` membuat test merah.

**Ditolak:**
- *Verifikasi lewat klien sesi* — `signInWithPassword` pada klien SSR akan menulis ulang
  cookie sesi pengguna sebagai efek samping percobaan verifikasi. Mutan C2 mengunci ini.
- *Mengaktifkan `REQUIRE_CURRENT_PASSWORD` di dashboard* — setelan itu berlaku
  project-wide dan berisiko ikut menuntut kata sandi lama pada jalur RECOVERY, yang
  justru dipakai orang yang lupa kata sandinya. Tidak diambil tanpa bukti empiris.
- *Rate limit per-jaringan saja* — form ini menerima tebakan kata sandi dari pemegang
  sesi; tanpa lapis per-akun ia menjadi oracle. Mutan C5 mengunci lapis identity-nya,
  dan mutan C3 mengunci bahwa gerbangnya dievaluasi SEBELUM verifikasi.

**Konsekuensi — dan batas yang jujur.** Entri ini menutup SETENGAH temuan B1. Separuh
yang lain **masih terbuka**: `/reset-password/ubah` tetap bisa dibuka oleh sesi dashboard
biasa, sehingga siapa pun yang memegang perangkat yang masih login dapat mengganti kata
sandi tanpa tahu yang lama. Komentar di `src/app/(auth)/reset-password/ubah/page.tsx`
yang menyatakan "akan menolak (getUser null)" tetap SALAH dan belum dikoreksi di sini.

Menutupnya butuh membedakan sesi recovery dari sesi biasa. Jalur yang tersedia:
`supabase.auth.getClaims()` ada di versi terpasang, dan `JwtPayload.amr` bertipe
`AMREntry[] | string[]` dengan `"recovery"` sebagai salah satu nilai `AMRMethod` yang
didokumentasikan. **Tetapi belum diverifikasi** bahwa GoTrue benar-benar menuliskan
`recovery` ke `amr` setelah `verifyOtp({ type: "recovery" })`, maupun apakah nilai itu
bertahan setelah token refresh. Menebak di sini berisiko mengunci SETIAP pengguna dari
pemulihan kata sandi — kegagalan yang jauh lebih parah daripada celah yang hendak ditutup.

Langkah verifikasi yang harus dijalankan sebelum tightening: `auth.admin.generateLink({
type: "recovery" })` dengan service_role → `verifyOtp` pada klien throwaway → periksa
`amr` pada JWT sesi yang dihasilkan. Dua kemungkinan hasilnya menentukan desain: bila
`recovery` ada dan segar, cek amr cukup; bila tidak, perlu cookie bertanda tangan
ber-TTL pendek yang diset `/auth/confirm` saat `type=recovery`.

Catatan terpisah: `updatePasswordAction` sampai sekarang **tanpa rate limit sama sekali**,
berbeda dari `signInAction` dan `requestPasswordResetAction` yang keduanya dibatasi.

Uji mutasi: 7 mutan, 7 merah (baseline `returncode 0` diverifikasi). Dua mutan sempat
tak terpasang dan satu sempat selamat karena mutannya sendiri cacat (`void 0;` yang tak
memindahkan apa pun) — ketiganya ditulis ulang sampai benar-benar menguji.

---

## #51 — 2026-10-01 · `/reset-password/ubah` menuntut tautan email segar; GoTrue menulis `otp`, BUKAN `recovery`

**Keputusan:** `updatePasswordAction` hanya menerima sesi yang lahir dari klik tautan
email dalam 30 menit terakhir, diuji lewat `isFreshEmailGrant()` atas klaim `amr` dari
`supabase.auth.getClaims()`. Sesi lain diarahkan ke form ganti kata sandi di profil
(#50) yang menuntut kata sandi saat ini. Aksi ini juga akhirnya mendapat rate limit.

**Alasan.** Ini separuh temuan B1 yang #50 sengaja tinggalkan terbuka. Sebelum entri ini,
`getUser()` tak-null adalah SATU-SATUNYA syarat: siapa pun yang memegang perangkat yang
masih login bisa membuka URL itu dan mengganti kata sandi tanpa tahu yang lama — pemilik
asli tersingkir permanen, tanpa notifikasi. Komentar di halamannya menyatakan "dibuka
tanpa sesi recovery akan ditolak (getUser null)", dan komentar yang salah itulah yang
menutupi celahnya selama berbulan-bulan. Komentarnya ikut dikoreksi.

**Temuan yang mengubah seluruh rancangan, dan kenapa ini dicatat panjang.** #50 menunda
tightening ini justru karena satu hal belum terverifikasi: apakah GoTrue menuliskan
`recovery` ke `amr`. Dokumentasi Supabase ("JWT Claims Reference") mencantumkan
`"recovery"` sebagai salah satu nilai `amr.method`, dan tipe `AMRMethod` di
`@supabase/auth-js` memuatnya. Pengujian langsung terhadap proyek ini —
`admin.generateLink({ type: "recovery" })` → `verifyOtp` pada klien sekali pakai →
membaca payload JWT — menghasilkan:

```
amr : [{ "method": "otp", "timestamp": 1790835431 }]
aal : aal1
```

**`recovery` tidak muncul sama sekali.** Mengikuti dokumentasi akan menghasilkan gerbang
yang menolak SETIAP sesi recovery, yakni mengunci setiap pengguna dari pemulihan kata
sandi — kegagalan jauh lebih parah daripada celah yang hendak ditutup, dan tak akan
tertangkap test mana pun yang fixture-nya ditulis dari dokumentasi yang sama. Mutan G1
(mengganti `otp` → `recovery`) kini merah, jadi kekeliruan itu tak bisa masuk diam-diam.

`getClaims()` juga diverifikasi bentuknya: mengembalikan `{ claims, header, signature }`,
`claims.sub` cocok dengan id pengguna, dan `claims.amr` berbentuk `AMREntry[]` **dengan
timestamp** (bukan `string[]`).

**Ditolak:**
- *Mengikuti dokumentasi tanpa verifikasi* — lihat di atas. Satu skrip sekali pakai
  mengubah tebakan jadi fakta; biayanya beberapa menit.
- *Cookie bertanda tangan sendiri yang diset `/auth/confirm`* — rancangan cadangan di
  #50. Tak jadi dipakai karena menuntut secret baru di `.env` (friksi pemilik, dan harus
  gagal-tertutup bila kosong) sementara klaim `amr` sudah membawa informasi yang sama.
- *Memeriksa `method` saja tanpa kesegaran* — `amr` menumpuk dan entri `otp` bertahan
  setelah token refresh, jadi sesi yang lahir dari pemulihan berbulan-bulan lalu akan
  jadi izin selamanya. Mutan G2 menguncinya.

**Konsekuensi:**
- Verifikasi email saat PENDAFTARAN juga menghasilkan `otp`, jadi pendaftar baru punya
  jendela 30 menit tempat ia bisa mengganti kata sandi tanpa menyebut yang lama. Diterima
  sadar: ia baru saja membuktikan kendali atas kotak masuknya, jadi bukan eskalasi.
- Bentuk `string[]` (RFC-8176) diterima TANPA cek kesegaran. Bentuk itu tak teramati di
  sini; menolaknya bila GoTrue kelak berganti bentuk akan mematikan pemulihan kata sandi.
  Ini gagal-aman yang disengaja ke arah ketersediaan, dan dicatat agar tak dikira kelalaian.
- Jendela 30 menit adalah satu-satunya angka yang disetel di sini
  (`EMAIL_GRANT_MAX_AGE_SEC`). Tautan recovery Supabase sendiri punya masa berlaku sendiri;
  gerbang ini menyempitkan, bukan menggantikannya.
- **Masih belum ada:** email notifikasi "kata sandi Anda baru saja diubah". Itu menunggu
  Custom SMTP (#47) dan kepastian mailbox dukungan; sampai itu ada, perubahan kata sandi
  tetap tak memberi tahu pemilik akun.

Uji mutasi: 6 mutan, 6 merah (baseline `returncode 0` diverifikasi).

---

## #52 — 2026-10-03 · Jalur eksekusi refund; RPC diuji dalam transaksi yang di-rollback

**Keputusan:** RPC `admin_refund_order(order_code, admin_id, reason)` menandai order
lunas sebagai `refunded` DAN mencabut layanan yang dibeli, atomik bersama `admin_logs`.
Tombolnya di `/admin/order`, alasan WAJIB diketik. Sekaligus: `createCheckoutAction`
kini MEMAKAI ULANG order pending untuk paket yang sama alih-alih membuat order kedua.

**Alasan.** Audit A3. Enum `order_status` sudah memuat `'refunded'` sejak migrasi awal,
tetapi tak ada satu baris kode pun yang pernah menulisnya: `/admin/order` read-only dan
`PaymentGateway` tak punya `refundTransaction`. Refund yang disetujui dikerjakan di luar
sistem — order tetap `paid`, undangan tetap aktif, jadi pelanggan mendapat uang kembali
DAN layanan, sementara laporan admin berhenti cocok dengan mutasi rekening. Kebijakan
refund yang sudah tayang menjanjikan tanggapan 3 hari kerja tanpa alat apa pun untuk
memenuhinya.

**Keputusan pemilik (2026-10-03):** refund MENCABUT layanan. Uangnya tetap digerakkan di
dashboard Pakasir — gateway tak punya API refund — dan UI menyatakan itu eksplisit agar
tak ada yang mengira tombol ini mengembalikan uang.

**Dua penghalus yang tak diminta tetapi wajib, supaya pencabutan tak menjadi bug sendiri:**
- *Order lunas lain yang menopang.* Pelanggan yang membayar aktivasi lalu memperpanjang,
  dan hanya salah satunya direfund, tak boleh kehilangan keduanya. RPC menghitung order
  lunas lain ber-`kind <> 'addon_momen'`; bila ada, undangan DIBIARKAN dan hasilnya
  `refunded_still_paid` supaya admin tahu.
- *Add-on Album Momen.* Yang dibeli albumnya, bukan undangannya. Mencabut undangan akan
  mematikan layanan yang tak pernah dikembalikan uangnya. Add-on → `momen_albums.status`
  menjadi `archived`, undangan tak disentuh.

**BUG yang HANYA ketahuan karena RPC-nya dijalankan, bukan dibaca.** Versi pertama
memakai `returns table (…, invitation_id uuid)`. Nama kolom OUT itu menaungi
`momen_albums.invitation_id` di dalam badan fungsi, sehingga cabang add-on gagal dengan
`column reference "invitation_id" is ambiguous` — **setiap refund add-on akan gagal di
produksi**. Unit test aksi tak akan pernah menangkapnya: aksi me-mock RPC-nya, dan
`pnpm typecheck` tak melihat ke dalam SQL. Kolomnya diganti `inv_id` dan UPDATE-nya
dikualifikasi (`momen_albums a`).

**Cara pengujiannya, karena layak diulang.** Produksi masih kosong (0 undangan, 0 order),
jadi RPC diuji langsung terhadap skema NYATA di dalam satu blok `do $$ … $$` yang
menyisipkan fixture, memanggil fungsinya, lalu `raise exception` di akhir — pengecualian
itu membatalkan seluruh blok, sehingga nol baris tertinggal (diverifikasi sesudahnya).
Hasilnya: A satu order lunas → `refunded_revoked`, undangan `expired`; B dua order lunas
→ `refunded_still_paid`, undangan tetap `active`; C add-on → `refunded_album_archived`,
album `archived` dan undangan tak berubah; D refund ulang → `not_paid:refunded` tanpa
jejak audit kedua. `admin_logs` berisi 3 entri, bukan 4.

**Penahan pembayaran ganda.** Pola "jangan buat order kedua" sudah ada di jalur add-on
(`findPendingMomenOrder`) tetapi tak pernah dipasang di checkout undangan — klik-ganda
atau mencoba lagi setelah meninggalkan halaman Pakasir menghasilkan dua order, penyebab
utama kasus refund yang dijanjikan kebijakan. Sekarang order pending untuk undangan+paket
yang SAMA dipakai ulang dan pemilik diarahkan ke link bayar order itu. Nominalnya diambil
dari ORDER, bukan harga paket saat ini: Pakasir menagih sesuai order yang sudah dibuat.

**Ditolak:**
- *Memblokir checkout selama ada order pending* — pemilik yang meninggalkan halaman bayar
  akan terkunci sampai cron mengedaluwarsakannya (24 jam). Memakai ulang lebih baik.
- *Memakai ulang juga saat PAKET berbeda* — itu ganti pikiran yang sah; menagihkan paket
  lama diam-diam jauh lebih buruk. Konsekuensinya diterima: bila keduanya dibayar, kini
  ADA jalur refund untuk membereskannya.
- *Menulis status `refunded` tanpa mencabut layanan* — persis keadaan sebelum entri ini.

**Konsekuensi:**
- Uangnya TIDAK bergerak dari sini. `copy.admin.refund.note` menyatakannya di dalam form,
  bukan hanya di dokumentasi.
- `pnpm test:db` (pgTAP) masih belum di CI, jadi RPC ini tak punya penjaga otomatis.
  Blok rollback di atas adalah pengujian SATU KALI, bukan regresi. Butir terbuka.
- Nama kolom OUT pada RPC apa pun yang menyentuh banyak tabel wajib dipilih agar tak
  menaungi nama kolom — pelajaran ini berlaku untuk RPC berikutnya, bukan hanya ini.

Uji unit: 12 tes aksi refund + 2 tes pemakaian-ulang order pending. Helper `orders()` di
`checkout-action.test.ts` dipertajam jadi hanya menghitung INSERT, karena jalur itu kini
juga MEMBACA `orders`.

---

---

## Template entri baru

```
## #N — YYYY-MM-DD · [Judul keputusan]
**Keputusan:** ...
**Alasan:** ...
**Ditolak:** ... (alternatif + kenapa)
**Konsekuensi:** ... (bila ada dampak teknis/biaya yang harus diingat)
```
