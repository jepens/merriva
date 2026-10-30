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
2. ~~**Migrasi media** = skrip ops `scripts/migrate-media-to-r2.mjs` (idempoten + resume via HEAD, `--dry-run`/`--force`/`--limit`, pool 8). DB TIDAK disentuh (path vendor-agnostik). Cutover: migrasi (0 gagal) → set env → verifikasi URL → hapus objek Supabase (opsional). `pnpm migrate:media`.~~ **DICABUT 16 Okt 2026 — lihat #92.** Skripnya dihapus, dan resep cutover di atas KELIRU di dua tempat: "set env" tak cukup (`NEXT_PUBLIC_MEDIA_URL` build-arg → wajib REBUILD), dan "hapus objek Supabase (opsional)" akan menghapus satu-satunya salinan server pustaka lagu, yang tak pernah ikut dipindahkan skrip itu.
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

## #53 — 2026-10-03 · Hapus akun: FK `user_id` jadi SET NULL agar riwayat pesanan bertahan

**Keputusan:** `orders.user_id` dan `invitations.user_id` menjadi nullable dengan
`ON DELETE SET NULL` (sebelumnya `NOT NULL` + `CASCADE`). RPC `admin_delete_account`
mem-purge data pribadi tiap undangan, menghapus baris `profiles`, dan membiarkan FK
mengosongkan kepemilikan — satu transaksi bersama `admin_logs`. Aksi admin di
`/admin/pengguna` + prosedur di `RUNBOOK.md`. **Belum** ada tombol self-service.

**Alasan.** Audit A6: `/privasi` sudah tayang menjanjikan "Anda dapat meminta penghapusan
data kapan saja", tetapi `auth.admin.deleteUser` tak pernah dipanggil di mana pun dan
panel admin hanya bisa MEMBEKUKAN (ban GoTrue). Janji publik tanpa mekanisme.

**Mengapa skemanya harus berubah — ini inti entri ini.** Pemilik memilih riwayat pesanan
DIPERTAHANKAN ter-anonimisasi. Itu mustahil dengan skema sebelumnya; rantainya:

```
profiles  --CASCADE-->  invitations.user_id
profiles  --CASCADE-->  orders.user_id
invitations --CASCADE-->  orders.invitation_id
```

Ketiganya `NOT NULL`, jadi menghapus profil PASTI menghapus setiap order. Diperiksa di
`information_schema`, bukan diasumsikan. Dengan `SET NULL`, baris order bertahan tanpa
pemilik dan `admin_month_revenue` tetap melihat transaksi yang benar-benar terjadi.

`orders.invitation_id` SENGAJA dibiarkan `NOT NULL` + `CASCADE`: kerangka undangan memang
dipertahankan — itu pola retensi yang sudah ada sejak `purge_invitation_data` (isi
dikosongkan, `purged_at` disetel, barisnya tetap) — jadi tak ada order yang kehilangan
induknya dan tak perlu melonggarkan kolom ketiga.

Nullable TIDAK melemahkan RLS: setiap policy membandingkan `user_id = auth.uid()`, dan
`NULL = uuid` menghasilkan NULL (bukan true), sehingga baris yatim tak terlihat klien mana
pun — hanya service_role/admin. Hal yang sama berlaku pada `with check` di jalur INSERT.

**Urutan eksekusi WAJIB: RPC → storage → GoTrue.** RPC-lah yang mengembalikan path objek
yang harus dihapus. Menghapus pengguna GoTrue lebih dulu membuang satu-satunya cara
menemukan path itu, dan objeknya jadi yatim SELAMANYA — purge retensi pun takkan
menemukannya karena ia hanya mengenumerasi path dari BARIS yang sudah tiada. Urutan ini
dikunci test (`jejak[0] === "rpc"`, `jejak.at(-1) === "deleteUser"`).

**Ditolak:**
- *Tabel `order_archive` terpisah* — `orders` tetap ketat, tetapi `admin_month_revenue`
  membaca `orders`, jadi omzet bulan-bulan lama tetap bolong kecuali query laporan ikut
  diubah: masalah yang sama, dipindah tempat.
- *Menerima pesanan ikut terhapus* — paling bersih bagi subjek data, tetapi laporan omzet
  kehilangan transaksi nyata dan rekonsiliasi dengan mutasi rekening jadi mustahil.
- *Tombol self-service sekarang* — keputusan pemilik: jalurnya diuji operator dulu.
  Permintaan masuk lewat alamat dukungan dan dieksekusi admin.
- *Menghapus baris `invitations`* — akan meng-cascade `orders` lewat `invitation_id`,
  membatalkan seluruh tujuan perubahan ini.

**Pengujian.** Pola yang sama dengan #52: produksi masih kosong, jadi RPC dijalankan
terhadap skema NYATA di dalam blok `do $$ … $$` yang berakhir `raise exception` sehingga
seluruhnya di-rollback (nol baris tertinggal, diverifikasi sesudahnya). Hasil: undangan
`active` → `has_active` tanpa perubahan apa pun; penghapusan → `deleted`, 3 undangan
di-purge, **`guests` habis**, baris order **bertahan** dengan `user_id` NULL, kerangka
undangan bertahan dengan `user_id` NULL, `profiles` kosong, dan **`admin_month_revenue`
tetap melaporkan Rp99.000**; akun yang sudah tiada → `not_found`.

**Konsekuensi:**
- Undangan berstatus `active` MENAHAN penghapusan (keputusan pemilik). Pesan penolakannya
  menyebut alasannya, dan RUNBOOK menjelaskan jalan keluarnya.
- Email konfirmasi diketik ulang dan dicocokkan DI SERVER dengan email akun target;
  salah ketik → nol penghapusan. Email ditampilkan sebagai `placeholder`, bukan nilai
  bawaan — menyalinnya dari layar tetap menuntut tindakan sadar.
- Kegagalan storage TIDAK membatalkan penghapusan yang sudah commit di DB; dilaporkan
  (`area: admin.delete-account.storage`). Kegagalan `deleteUser` menyisakan HANYA baris
  login dan dijawab pesan khusus, bukan "gagal" yang menyesatkan.
- `copy.marketing.legal.privacy` diselaraskan: menyebut verifikasi ke alamat email akun
  dan pengecualian retensi catatan pesanan. Janji di halaman publik kini cocok dengan
  yang benar-benar dilakukan kode.
- Kolom `user_id` yang kini nullable berarti kode baru TIDAK boleh menganggapnya selalu
  terisi. Tipe DB sudah mencerminkannya setelah regen berikutnya; sementara ini hanya
  jalur admin yang membaca baris yatim.

Uji unit: 13 tes aksi hapus akun. `pnpm test:db` (pgTAP) masih belum di CI — RPC ini,
seperti `admin_refund_order`, belum punya penjaga regresi otomatis.

---

## #54 — 2026-10-03 · pgTAP masuk CI sebagai job terpisah

**Keputusan:** job `db` baru di `ci.yml` menjalankan `supabase db start` + `supabase test db`.
Tiga berkas pgTAP ditambahkan: `admin_refund_order`, `admin_delete_account`, dan RLS
`orders`. Job ini **tidak** menahan `verify`.

**Alasan.** Unit test di repo ini me-MOCK setiap RPC, jadi tak satu pun menyentuh SQL-nya.
Konsekuensinya bukan teoretis: `admin_refund_order` (#52) lolos review, lolos `typecheck`,
dan lolos seluruh unit test dengan bug yang membuat **setiap refund add-on gagal** —
parameter OUT bernama `invitation_id` menaungi kolom `momen_albums.invitation_id`. Hanya
menjalankan fungsinya yang menemukan itu. `admin_delete_account` (#53) punya risiko sejenis
dengan taruhan lebih tinggi: bila FK dikembalikan ke `CASCADE`, riwayat pesanan lenyap
tanpa satu pun test merah.

`orders` ikut diuji karena ia tabel uang yang sampai audit ini tak punya test DB sama
sekali, dan karena §6b migrasi awal mencabut hak per-kolom untuk `profiles`/`invitations`/
`rsvps` tetapi MELEWATKAN `orders` — grant kolomnya masih terbuka, jadi yang menahan
pelanggan menulis ulang `status`/`amount_idr` miliknya sendiri hanyalah ketiadaan policy
UPDATE. Itu perlu dijaga sungguhan, bukan diasumsikan.

**Ditolak:**
- *Menggabungkan ke job `verify`* — `supabase db start` perlu ~2 menit dan menyalakan
  Docker; kegagalan infrastruktur akan menyamar jadi kode yang rusak dan menahan lint,
  typecheck, serta build yang tak ada hubungannya.
- *Menguji hanya lewat blok rollback manual* (metode yang menemukan bug #52) — itu
  pengujian SATU KALI, bukan regresi. Berguna saat merancang, tak berguna enam bulan lagi.
- *Menguji `anon` saja pada RLS* — kebocoran yang sesungguhnya adalah antar-PELANGGAN.
  Berkas RLS menguji tiga identitas: pemilik, pengguna lain yang LOGIN, dan anon.

**Konsekuensi:**
- Repo ini tak punya branch protection, jadi job merah tetap tak menghalangi push. Nilainya
  ada pada `gh run list` sesudah push — yang memang sudah jadi kebiasaan wajib di sini.
- Baris yatim (`orders.user_id` NULL pasca-hapus-akun) ikut diuji TIDAK terlihat klien mana
  pun — konsekuensi langsung dari #53 yang sebelumnya hanya diyakini lewat penalaran
  `NULL = uuid` menghasilkan NULL.

---

## #55 — 2026-10-03 · Login diberi plafon PER-AKUN; hashing kunci diuji di tempat yang benar

**Keputusan:** `signInAction` menambah lapis `identity` per-email (8 percobaan / 15 menit)
di atas plafon per-jaringan yang sudah ada. Turnstile pada login **belum** dipasang.

**Alasan.** Audit B4. Satu-satunya penahan sebelumnya adalah 10 percobaan/menit per blok
jaringan, dengan argumen `identity` dibiarkan kosong — padahal `requestPasswordResetAction`
di berkas yang sama sudah memakai lapis itu. Credential stuffing datang terdistribusi dari
ribuan IP; botnet atau VPN murah membuat plafon per-jaringan praktis tak terbatas terhadap
SATU akun.

Taruhannya bukan sekadar gangguan: sekali masuk, penyerang melihat seluruh daftar tamu
berikut nomor HP-nya (UU PDP), dan dapat MENGGANTI nomor rekening amplop digital pada
undangan yang sudah aktif — hadiah uang tamu mengalir ke rekening lain, dan pemiliknya tak
menerima notifikasi apa pun karena email "kata sandi/akun berubah" belum ada (#51).

**Catatan metode yang layak diingat.** Test pertama yang saya tulis untuk ini —
"kunci lapis akun di-HASH, email tak pernah jadi kunci mentah" — GAGAL, dan gagalnya benar:
`tests/unit/auth-action-errors.test.ts` me-mock `staticRateKey` menjadi `` `${a}:${v}` ``,
sehingga assertion itu sebenarnya menguji mock saya sendiri, bukan hashing-nya. Seandainya
mock-nya kebetulan ikut meng-hash, test itu akan HIJAU tanpa menguji apa pun.

Invarian hashing dipindahkan ke `tests/unit/client-rate-limit.test.ts`, yang memakai fungsi
ASLI — dan `staticRateKey` ternyata memang belum punya test sama sekali, padahal ia satu-
satunya hal yang menjaga kunci limiter tidak menjadi daftar email pelanggan yang sedang
aktif di memori proses. Mutan L3 (mengembalikan nilai mentah) kini merah.

**Ditolak:**
- *Turnstile pada login setelah N kegagalan* — menuntut penghitungan kegagalan lintas
  permintaan DAN alur UI dua langkah (aksi memberi tahu form untuk merender widget, pengguna
  mengirim ulang). Nilainya nyata tetapi jauh lebih kecil daripada lapis per-akun ini, dan
  ia menambah friksi pada jalur masuk yang paling sering dipakai. Tetap terbuka.
- *Melaporkan kegagalan login ke Sentry* — kata sandi salah adalah galat pengguna yang
  wajar; melaporkannya akan membanjiri Sentry dengan salah ketik sehari-hari dan menenggelamkan
  kegagalan yang benar-benar perlu dilihat. Dikunci test.

**Konsekuensi:**
- Rate limit ini in-memory per-proses: reset saat deploy dan tak berlaku lintas instance.
  Untuk satu kontainer Easypanel itu cukup; bila kelak di-scale, penahan sesungguhnya harus
  pindah ke penyimpanan bersama. Sudah tercatat sebagai keterbatasan sejak `lib/rate-limit.ts`.
- **Leaked Password Protection di Supabase masih mati** (butir LAUNCH-CHECKLIST, temuan B5).
  Plafon ini memperlambat penebakan; ia tidak menolak kata sandi yang sudah bocor. Keduanya
  dibutuhkan, dan yang kedua adalah toggle dashboard milik pemilik.

Uji mutasi: 3 mutan, 3 merah.

---

## #56 — 2026-10-03 · Dashboard & panel admin berhenti menelan galat DB

**Keputusan:** bacaan DAFTAR di `(dashboard)` dan `(admin)` memakai `dataOrThrow`, bukan
`data ?? []`. `(admin)/admin/error.tsx` ditambahkan dalam commit yang sama.

**Alasan.** Temuan ini muncul bukan dari audit, melainkan dari VERIFIKASI audit: penguji
yang membantah temuan "boundary galat kurang" justru menemukan kebalikannya — seluruh
halaman `(admin)` (9 bacaan), `/dashboard`, `/dashboard/profil`, dan `undangan/baru`
memakai `const { data } = await …` tanpa memeriksa `error`.

Kelas kegagalannya sama dengan #45/#46, dan yang membuatnya mahal justru karena ia TIDAK
terlihat seperti kegagalan: satu kedipan DB menghasilkan layar yang sah dan meyakinkan —
"Belum ada undangan" bagi pemilik yang undangannya sedang aktif, tabel order kosong di
panel yang dipakai merekonsiliasi uang, pemilih tema tanpa satu pun pilihan, form profil
kosong yang mengundang pemilik mengetik ulang di atas data yang sebenarnya ada, dan nama
pembeli yang berubah jadi "—" pada kuitansi yang gunanya membuktikan pembayaran.

**Ditolak:**
- *Mengubah halaman `[id]` sekaligus* — di sana pola `notFound()` punya semantik sendiri
  dan beberapa sudah ditangani sadar (mis. jadwal yang tak terbaca di `aktifkan/page.tsx`,
  DECISIONS #44). Di luar lingkup; dikerjakan terpisah bila perlu.
- *`dataOrThrow` tanpa boundary admin lebih dulu* — tepat kesalahan yang diperingatkan
  #45: galat naik ke `global-error.tsx` yang mengganti seluruh dokumen, sehingga header,
  navigasi, dan jalan kembali ikut hilang. `error.tsx` masuk commit yang sama.
- *`SupportContact` di boundary admin* — admin adalah tim Merriva sendiri, bukan pelanggan
  yang perlu dialihkan ke alamat dukungan.

**Konsekuensi:**
- `listUsers` GoTrue di `/admin/pengguna` ikut diperiksa: galat di sana dulu menghasilkan
  daftar pengguna yang SEPARUH (loop paginasi berhenti diam-diam), yang lebih menyesatkan
  daripada kosong.
- Pembedaan "kosong" versus "gagal" kini dikunci test: daftar yang benar-benar kosong
  TETAP menampilkan ajakan, galat DB melempar. Mutan yang mengembalikan `data ?? []` merah.
- Pembaca kode berikutnya bisa tergoda "menyeragamkan" ini kembali ke pola `?? []` yang
  masih dipakai halaman `[id]`. Komentar di tiap lokasi menyebut alasannya, dan testnya
  yang akan menahan.

---

## #57 — 2026-10-03 · Tiga sisa audit: CSP parsial, pemindai secret & dependency, 404 pemilik

Tiga temuan kecil yang bertahan setelah verifikasi membantah bentuk aslinya. Digabung
karena ketiganya murah, tak saling bergantung, dan masing-masing terlalu kecil untuk ADR
sendiri.

**1. CSP: tiga direktif yang gratis.** Verifikasi membantah temuan "CSP setengah jadi"
(#27 sudah menolak CSP penuh secara sadar): `script-src` ber-nonce menuntut render
per-request, sementara `/[slug]` ISR karena mandat Lighthouse ≥90 / LCP <2,5 dtk. CSP
yang BISA dipasang di sana (`script-src 'self' 'unsafe-inline'`) tak mengurung XSS sama
sekali.

Yang tersisa benar dan tetap dikerjakan: `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`. Ketiganya tak menyentuh skrip inline maupun ISR — nol risiko
performa — dan dua terakhir menutup jalur eskalasi/eksfiltrasi **pasca-XSS** tanpa perlu
`script-src`. Diverifikasi aman lebih dulu: redirect Pakasir memakai
`window.location.assign` (navigasi, bukan form) dan tak ada satu pun form lintas-origin di
repo. `script-src`/`connect-src` TETAP ditolak — jangan ditambahkan tanpa mengukur ulang
dampaknya pada ISR.

**2. Pemindai secret & dependency di CI.** Sejarah git repo ini bersih hari ini
(diverifikasi audit); yang belum ada adalah mekanisme yang menjaganya tetap bersih. Satu
salah-tempel `SUPABASE_SERVICE_ROLE_KEY` ke berkas ter-commit akan masuk permanen ke
sejarah — dan kunci itu mem-bypass RLS di seluruh tabel. `gitleaks` menangkapnya di PR,
bukan enam bulan kemudian. Dependabot mingguan menutup sisi lain: jarak antara "CVE
diumumkan" dan "kami tahu" sebelumnya tak terbatas.

Pembaruan minor/patch DIKELOMPOKKAN jadi satu PR. Alasannya operasional, bukan teknis:
20 PR terpisah tiap minggu tak akan tertelaah oleh tim satu orang, dan yang tak tertelaah
sama saja dengan tak ada. Pembaruan KEAMANAN tetap dibuka Dependabot segera di luar jadwal.

**3. 404 bernada pemilik di dashboard.** Ada 20 pemanggilan `notFound()` di pohon
`/dashboard`, semuanya mendarat di `src/app/not-found.tsx` yang teksnya ditulis untuk
TAMU undangan — "undangannya sudah tidak aktif", dengan tombol ke beranda MARKETING.
Pemilik yang sekadar salah menyalin id dibuang keluar dari sesi kerjanya sambil diberi
kecemasan palsu bahwa undangannya mati. `(dashboard)/not-found.tsx` memakai salinan teks
sendiri dan mengembalikannya ke daftar undangan.

**Ditolak:** `(admin)/not-found.tsx` — panel admin memakai `redirect()` ke daftar, bukan
`notFound()`, pada hampir semua jalurnya; menambahkannya akan jadi kode mati.

**Koreksi (pemindaian pertama merah).** gitleaks menemukan 2 temuan, keduanya token tamu
PALSU di fixture test — `generic-api-key` adalah heuristik entropi, dan `guests.token`
memang string acak. Dua upaya perbaikan dicoba dan yang pertama DIBUANG:

1. `.gitleaks.toml` dengan `[[allowlists]] targetRules` — tak berpengaruh (konfigurasinya
   tak terbaca action, atau `targetRules` belum didukung versi gitleaks yang dibundelnya).
2. `// gitleaks:allow` per BARIS — berhasil, dan memang lebih tepat.

Allowlist ber-path untuk `tests/` sengaja TIDAK dipakai meski paling mudah: ia mematikan
aturan untuk seluruh direktori, sehingga JWT sungguhan — `SUPABASE_SERVICE_ROLE_KEY`
mem-bypass RLS di semua tabel — bisa lolos bila kelak tertempel di sebuah fixture. Penanda
per-baris menandai persis dua baris itu, terlihat oleh siapa pun yang membaca test-nya, dan
memaksa keputusan sadar untuk setiap fixture baru. Alat keamanan yang hanya berpura-pura
memeriksa lebih buruk daripada tidak ada.

---

## #58 — 2026-10-03 · Kebijakan privasi mencerminkan pemrosesan yang sebenarnya; tamu diberi tahu di titik pengumpulan

**Keputusan:** `copy.marketing.legal.privacy` diperluas (Album Momen, pengenal perangkat,
tempat pemrosesan, dasar pemrosesan, peran pengendali/pemroses, Sentry), dan komponen
`GuestPrivacyNote` dipasang di tiga formulir publik: RSVP, konfirmasi amplop, dan
onboarding Album Momen sebelum kamera terbuka.

**Alasan.** Sisa temuan legal yang bertahan setelah verifikasi membantah bentuk aslinya
(#57 mencatat bantahan itu: Pasal 21 UU PDP tidak mewajibkan penyebutan seluruh pemroses,
dan Album Momen sudah memberi notis tujuan di layar masuknya). Yang TETAP berdiri, dan
dikerjakan di sini:

- **Kategori data Album Momen tak pernah disebut.** Diverifikasi langsung di skema:
  `momen_photos` menyimpan `guest_name`, `device_id` (UUID dari localStorage), serta path
  foto `display`/`thumb`. Kebijakan lama hanya menyebut "nama, nomor WhatsApp, RSVP, dan
  ucapan" — tak satu kata pun tentang foto yang bisa memuat wajah tamu dan orang lain di
  acara. Ini celah paling sah dari seluruh temuan legal.
- **`localStorage` bukan cookie.** Kebijakan lama menyebut "cookie sesi" saja; pengenal
  perangkat tamu hidup di penyimpanan lokal peramban, dan cookie sesi tamu Album Momen
  bertanda tangan adalah hal ketiga lagi. Ketiganya kini dipisah namanya.
- **Transfer lintas yurisdiksi tak diungkap** padahal basis data di Singapura dan layanan
  email/anti-bot/pemantauan di luar Indonesia.
- **Kebijakan menjanjikan hak "menarik persetujuan"** padahal tak ada persetujuan yang
  pernah dikumpulkan — klaim yang justru melemahkan posisi hukumnya sendiri. Diganti
  bagian "Dasar pemrosesan" yang menyebut dasar yang BENAR: pelaksanaan perjanjian untuk
  layanan, kewajiban hukum untuk catatan pembayaran.
- **Peran atas data tamu hanya melimpahkan.** Kini dinyatakan hitam-putih: pengguna =
  pengendali, Merriva = pemroses, beserta kewajiban masing-masing.

**Sentry dimasukkan sekarang meski DSN belum diisi.** Menamai pemroses yang segera dipakai
bukan ketidakakuratan; tidak menamai yang dipakai adalah pelanggaran. Memasukkannya
sekarang juga menghapus satu langkah yang mudah terlupa saat DSN akhirnya diaktifkan.
Penyaringan PII (`sentry-scrub.ts`) ikut disebut karena itu yang membuat klaimnya jujur.

**Pemberitahuan di titik pengumpulan, bukan di halaman legal.** UU PDP menuntut
pemberitahuan SEBELUM data dikumpulkan. `/privasi` hanya tertaut dari footer halaman
marketing — permukaan yang takkan pernah tamu buka, karena tamu masuk lewat tautan
WhatsApp langsung ke `/{slug}`. Satu baris di bawah formulirnya adalah satu-satunya tempat
yang sah.

**Ditolak:**
- *`next/link` untuk tautan privasi* — ia mem-prefetch tujuannya. Mem-prefetch halaman
  marketing dari halaman undangan membebani tamu di 4G tanpa manfaat apa pun bagi mereka,
  dan halaman ini punya anggaran bundel 64 KB gzip. Anchor biasa, `target="_blank"` agar
  tamu yang sedang mengisi RSVP tak kehilangan isiannya.
- *Menyebut Merriva lebih dulu dalam notisnya* — tuan rumahlah pengendali datanya. Teks
  yang menyebut Merriva duluan salah secara hukum DAN menyesatkan tamu soal kepada siapa
  ia harus meminta penghapusan.
- *Checkbox persetujuan untuk tamu* — dasar pemrosesannya bukan persetujuan, dan menuntut
  centang di formulir RSVP menambah friksi pada jalur yang paling tipis toleransinya.

**Konsekuensi:**
- Teks kebijakan kini dikunci test terhadap apa yang BENAR-BENAR ada di skema. Bila kelak
  ada kategori data baru (mis. QR check-in Fase 2) dan kebijakannya tak diperbarui, testnya
  tak akan menangkapnya — itu batas yang jujur: test menjaga yang sudah diketahui, bukan
  yang belum.
- Anggaran bundel halaman undangan dijaga gerbang CI; komponen notis tak menambah
  dependency baru.

---

## #59 — 2026-10-03 · Syarat & Ketentuan, identitas pelaku usaha satu sumber, notis persetujuan

**Keputusan:** halaman `/syarat` dibuat dari `copy.marketing.legal.terms` (13 bagian),
identitas pelaku usaha hidup di SATU objek `copy.marketing.legal.merchant` yang dirender
di seluruh halaman legal, dan baris notis persetujuan dipasang di `/daftar` serta tepat di
atas tombol bayar.

**Alasan.** Audit A2, pemblokir launch terakhir di gelombang A. Tidak ada dokumen Syarat &
Ketentuan SAMA SEKALI — bukan tertunda, melainkan tak pernah direncanakan (nol butir di
LAUNCH-CHECKLIST maupun ROADMAP). Akibatnya tak ada dasar kontraktual untuk hal yang
**kodenya sudah kerjakan**: masa aktif berakhir (`cron/expire-invitations`), penghapusan
permanen 6 bulan (`cron/purge-expired`), penangguhan konten (`adminSuspendInvitation`),
dan penolakan refund setelah aktivasi. Pelanggan yang undangannya disuspend di hari-H
bisa menuntut dan Merriva tak punya satu klausul pun untuk berdiri di atasnya.

**Keputusan pemilik (2026-10-03):**
- **Usaha perseorangan** — bukan PT/CV. Blok identitas menyebut bentuk usahanya apa adanya.
- **Batas tanggung jawab = sebesar yang dibayarkan**, kerugian tidak langsung dikecualikan.
  Jujur dan bisa dipertahankan: produk ini menjual undangan Rp99–299 ribu, bukan asuransi
  acara. Klausulnya ditutup kalimat bahwa ia tidak mengurangi hak yang dijamin peraturan
  bersifat memaksa — tanpa itu, klausul pembatas justru batal demi hukum dan melemahkan
  seluruh dokumen.
- **Notis, bukan checkbox.** Dasar pemrosesannya perjanjian (#58), bukan persetujuan, jadi
  centang tak diwajibkan hukum; yang wajib adalah pemberitahuannya. Ini juga menghindari
  migrasi `tos_accepted_at` yang penguji audit nilai sebagai memenuhi kewajiban yang tak ada.

**Setiap klausul mencerminkan perilaku kode yang SUDAH ada** — retensi enam bulan,
penangguhan tanpa penghapusan isi, batas paket yang ditegakkan DB, pembagian peran
pengendali/pemroses. Itu disengaja dan diuji: kebijakan yang menjanjikan hal yang tak
dilakukan produknya adalah masalah yang lebih besar daripada tak punya kebijakan — persis
cacat yang ditemukan di `/privasi` (#58).

**Identitas pelaku usaha: satu sumber, kosong tetap benar.** `merchant` dirender oleh
`LegalPage`, dan hanya field yang TERISI yang muncul. Halaman tetap sah hari ini, dan
begitu pemilik mengisi `name` + `address`, satu suntingan mengisi /syarat, /privasi,
/refund, dan kuitansi sekaligus. Dua butir ditambahkan ke LAUNCH-CHECKLIST: mengisi
identitas (wajib sebelum menerima uang — PP 80/2019 & Permendag 31/2020, dan aggregator
pembayaran rutin menangguhkan merchant tanpa itu), dan peninjauan isi S&K oleh pemilik.

**Ditolak:**
- *Anchor biasa untuk tautan legal di /daftar & checkout* — lint `@next/next/
  no-html-link-for-pages` menolaknya, dan benar: argumen anggaran bundel 64 KB hanya
  berlaku untuk `/[slug]`, bukan permukaan dashboard/auth. `next/link` dipakai di sana;
  `GuestPrivacyNote` di halaman tamu tetap anchor (#58).
- *Menunggu keputusan badan usaha sebelum menulis S&K* — isi kontraknya tak bergantung
  padanya; hanya dua baris identitas yang bergantung, dan itu sudah dibuat satu sumber.

**Konsekuensi — batas yang jujur:** isi `/syarat` adalah draf yang disusun dari perilaku
kode, BUKAN dari penasihat hukum. Ia jauh lebih baik daripada tak ada dokumen sama sekali,
tetapi butir "ditinjau pemilik" di LAUNCH-CHECKLIST bukan formalitas — terutama batas
tanggung jawab dan klausul konten.

---

## #60 — 2026-10-04 · Jejak eksekusi cron di DB + status di panel admin

**Keputusan:** tabel `cron_runs` (SATU baris per job, di-upsert tiap jalan), helper
`recordCronRun`, dan kartu status di `/admin` yang menandai job **basi** dan **belum
pernah jalan**. Keempat route cron juga akhirnya memanggil `reportHandledError` pada
jalur 503-nya.

**Alasan.** Empat cron memegang kewajiban hukum (retensi UU PDP), komersial (aktivasi
order lunas), dan kontraktual (pengingat H-14), tetapi tak ada satu pun cara mengetahui
mereka berhenti. Kegagalan dijawab `{ok:false}` 503 yang hanya jadi exit code curl di
panel Easypanel — tak masuk Sentry, tak terlihat di mana pun. Dan NON-EKSEKUSI lebih
buruk lagi: job yang dihapus, salah ketik, atau mati setelah redeploy **tidak mengirim
apa pun**. `/api/health` pun hanya memprobe PostgREST.

**Keputusan pemilik (2026-10-03):** tabel + panel, bukan dead-man switch eksternal
(healthchecks.io). Batasnya diterima sadar dan dicatat: ini terlihat **bila dilihat** —
ia tidak mendorong notifikasi. Nilainya tetap nyata karena sebelumnya bahkan MELIHAT pun
tak mungkin tanpa membuka Easypanel.

**Yang paling penting bukan "gagal", melainkan "basi".** Status `ok: true` dari jalan
sukses tiga hari lalu TIDAK berarti job itu masih hidup — dan itulah mode kegagalan yang
sesungguhnya. Mutan M2 (membuang cek basi) dan M6 (`ok` lama tampak hijau) menguncinya.

**Ditolak:**
- *Riwayat penuh (satu baris per eksekusi)* — tumbuh tanpa batas dan menuntut cron
  pembersih sendiri: cron untuk menjaga cron. Satu baris per job menjawab pertanyaan yang
  sebenarnya ("kapan terakhir jalan, apakah berhasil") tanpa perawatan.
- *Ambang basi = 1× jadwal* — jitter penjadwal atau redeploy yang kebetulan bertepatan
  akan memerahkan panel tiap minggu, dan alarm yang terlalu sering berakhir diabaikan.
  Dipakai 2×. Mutan M3 menguncinya.
- *`recordCronRun` yang melempar* — jejak adalah pendamping, bukan efek utama. Kegagalan
  mencatat tidak boleh menggagalkan purge retensi yang sudah berhasil. Ia menelan
  galatnya sendiri, dan bila DB-nya yang mati, `last_run_at` yang membasi adalah sinyal
  yang benar.

**Konsekuensi:**
- `JADWAL_JAM` di `status.ts` HARUS cocok dengan perintah cron di panel Easypanel
  (LAUNCH-CHECKLIST Fase 3). Bila jadwalnya kelak diubah di sana tanpa diubah di sini,
  panel akan menuduh job yang sehat — kebalikan dari masalah yang hendak diselesaikan.
- `cron_runs` ber-RLS aktif TANPA policy sama sekali: hanya service_role yang
  menyentuhnya. anon & authenticated tak melihat nama job maupun pesan galat.
- Pesan galat dipotong 300 karakter dan sengaja tanpa detail baris — cron ini menyentuh
  data tamu, dan pesan Postgres bisa memuat nilai kolom.
- **Masih belum ada:** notifikasi dorong. Bila tak ada yang membuka `/admin` selama
  sebulan, job yang mati tetap tak diketahui sebulan. Itu konsekuensi langsung dari
  pilihan di atas, bukan kelalaian.

Uji mutasi: 5 mutan, 5 merah.

## #61 — 2026-10-04 · Upgrade paket bayar SELISIH: penandanya kolom pada ORDER, bukan paket semu

**Keputusan:** kolom `orders.purpose` (`'purchase' | 'upgrade'`, default `'purchase'`),
cabang ketiga di `activate_paid_order` yang HANYA menukar `invitations.package_id`,
`UPGRADABLE_STATUSES = {active}` terpisah dari `PAYABLE_STATUSES`, halaman
`/dashboard/undangan/[id]/upgrade` dengan poll sendiri, dan cabang upgrade di
`admin_refund_order`.

**Keputusan pemilik (2026-10-04):** bayar selisih harga, masa aktif TIDAK di-reset.

**Kenapa kolom pada order, bukan baris `packages` semu.** Paket tujuan upgrade adalah
paket undangan biasa (`premium`) dan HARUS tetap begitu: `orders.package_id` dibaca
kuitansi, riwayat pesanan, dan `invitations.package_id`. Baris semu
"upgrade_basic_premium" akan membekukan selisih harga di dalam katalog — basi begitu
harga paket berubah — dan menuntut indireksi untuk menemukan paket tujuannya.
`packages.kind` juga tak bisa dipakai: yang membedakan order ini memang bukan paketnya,
melainkan EFEKNYA.

**Tiga jenis order, satu jalur uang:**
`purchase + invitation` → undangan active, `active_until` dihitung ·
`purchase + addon_momen` → album dibuat, undangan tak disentuh ·
`upgrade + invitation` → `package_id` ditukar, sisanya tak disentuh.

**Kolom ini WAJIB difilter di KEDUA arah — dan itu temuan, bukan kerapian.** Order
upgrade memakai paket yang sama dengan aktivasi tetapi nominalnya hanya selisih. Tanpa
`.eq("purpose","purchase")` di `createCheckoutAction`, pemilik yang punya order upgrade
menggantung lalu menekan "Perpanjang" akan DIPAKAIKAN ULANG order Rp100.000 itu dan
mendapat masa aktif penuh dengan membayar selisihnya. Kebocoran ini diciptakan oleh
fitur baru di dalam kode LAMA yang tak berubah satu baris pun. Mutan "filter purpose
dibuang" menguncinya.

**`active_until` dinilai dari apa yang TIDAK berubah.** Satu baris `set` yang ikut
tersalin dari cabang aktivasi sudah cukup untuk menjual masa aktif penuh seharga
selisih, tanpa galat di mana pun. `supabase/tests/database/order_upgrade.test.sql`
menguji ketidakberubahan `active_until`, `published_at`, dan `status` secara eksplisit —
unit test me-MOCK RPC ini, jadi tak satu pun dari mereka menyentuh SQL-nya.

**Dua penahan yang ditemukan dengan MENJALANKAN RPC-nya,** bukan dengan membacanya:
- undangan yang **kedaluwarsa saat pembayaran berjalan** → `held`, paket tak ditukar.
  Premium tanpa masa aktif tak bernilai, dan menimpa `suspended` lewat jalur pembayaran
  akan membatalkan moderasi admin.
- undangan yang **sudah memegang paket tujuan** (kedaluwarsa → diperpanjang dengan
  Premium sementara order upgrade menggantung) → `held`. Tanpa `package_id is distinct
  from`, penukarannya jadi no-op senyap: pelanggan membayar selisih untuk sesuatu yang
  sudah dimilikinya dan RPC melaporkan sukses.

**Poll sendiri, bukan `checkPaymentStatusAction`.** Jalur undangan berhenti di status
UNDANGAN `active` — dan undangan pembeli upgrade SELALU `active`, jadi order upgrade tak
akan pernah direkonsiliasi di sana. Jebakan yang sama persis sudah ditemukan pada add-on
Album Momen (AUDIT-2026-09-04 KUA-2b); berkas ini mengikuti pola itu, bukan membuat pola
ketiga.

**Refund order upgrade menurunkan paket, bukan mencabut undangan.** Tanpa cabangnya,
refund berakhir di cabang undangan, menemukan order aktivasi yang masih lunas, dan
menyimpulkan `refunded_still_paid` — benar bahwa undangan tak dicabut, tetapi
`package_id` tetap di paket yang baru saja dikembalikan uangnya: pelanggan dapat uangnya
kembali DAN tetap memegang Premium. Sekaligus hitungan "order lunas lain yang menopang"
kini memfilter `purpose = 'purchase'`: order upgrade tak pernah membeli masa aktif, jadi
keberadaannya tak boleh membuat undangan tampak masih tertopang ketika aktivasi
satu-satunya justru yang direfund.

**Ditolak:**
- *Melebarkan `PAYABLE_STATUSES` dengan `active`* — komentar di `invitation-status.ts`
  sendiri sudah memperingatkannya. Dua jalur menagih nominal BERBEDA untuk paket yang
  sama; satu status di keduanya berarti pelanggan memilih jalur termurah untuk hasil yang
  sama. Test menjaga kedua himpunan tetap tak beririsan.
- *Kredit dari nominal order lunas terakhir, bukan harga katalog* — lebih "adil" pada
  kasus harga berubah, tetapi tak terdefinisi pada aktivasi manual admin (tanpa order)
  dan pada aktivasi gratis. Katalog = satu sumber, dan angka yang dilihat pelanggan
  adalah angka yang ditagih.
- *Mengizinkan upgrade tanpa `package_id`* — tak ada yang bisa dikreditkan, jadi
  tagihannya menjadi harga PENUH lewat jalur yang tak memberi periode baru. Itu tagihan
  paling buruk yang bisa dihasilkan fitur ini; ditolak dengan pesan menuju dukungan.
- *Prorata menurut sisa hari* — tidak disetujui dan tidak diminta. Dicatat sebagai
  pertanyaan terbuka di bawah.

**Konsekuensi:**
- Premium berdurasi **12 bulan** sementara Basic **6**. Upgrade membayar selisih penuh
  (Rp100.000) tetapi TIDAK membawa tambahan durasi itu. Karena itu halaman upgrade
  menyebut tanggal berakhir + sisa hari dan satu kalimat eksplisit bahwa masa aktif tak
  diperpanjang. **Keadilan harganya patut ditinjau pemilik** — menyentuh struktur harga,
  jadi tidak diubah sendiri.
- Kuitansi & riwayat tak boleh menilai dari `packages.kind` saja lagi: `buysActivePeriod`
  dan `orderKindLabel` memerlukan `purpose`. Tanpa itu kuitansi upgrade mencetak "Masa
  aktif dibeli: 12 bulan" — pada dokumen bukti pembayaran itu keterangan yang salah.
- Kuitansi email punya bentuk ketiga (`renderUpgradeReceiptEmail`): yang lama mengaku
  "undangan Anda kini aktif" dan menyiratkan periode baru.
- Pesan kuota tamu & foto (`"Tingkatkan paket…"`) akhirnya punya tombol. Sebelum ini ia
  instruksi tanpa tujuan — temuan B3 di audit.
- Order upgrade lunas yang paketnya tak pernah naik mendapat kartunya sendiri di
  `/dashboard/pesanan`: undangannya tetap `active`, jadi kartu "pembayaran masuk,
  undangan belum aktif" tak akan pernah menyalakannya.
- Tombol "Lanjutkan pembayaran" tak boleh lagi menebak tujuannya dari `kind`
  (`pendingPaymentPath`). `/bayar` berkunci pada status UNDANGAN dan langsung
  menyatakan "Pembayaran berhasil! Undangan Anda kini aktif" bila undangannya
  `active` — keadaan SETIAP pembeli upgrade. Layar sukses untuk pembayaran yang
  belum terjadi.
- **Hasil RPC baru WAJIB dipetakan di `adminRefundOrderAction`.** `refunded_downgraded`
  mula-mula jatuh ke `refund_failed`: refundnya berhasil di DB sementara admin membaca
  "gagal", lalu percobaan kedua menjawab "hanya order Lunas yang bisa direfund" — yang
  terbaca seolah refundnya tak pernah terjadi. Uang sungguhan dipindahkan manual di
  dashboard Pakasir berdasarkan bacaan itu, jadi pesan yang salah di sini berisiko
  refund ganda. Ditemukan dengan membaca pemetaannya, bukan oleh typecheck.

**Sisa: `plan(N)` pgTAP kini dijaga unit test** (`tests/unit/pgtap-plan.test.ts`). Push
pertama B3 memerahkan CI dengan "Bad plan. You planned 20 tests but ran 21" — ke-21
assertion-nya LULUS, yang salah hanya angkanya. Job `db` adalah satu-satunya bagian CI
yang tak bisa dijalankan dari mesin pengembang (butuh `supabase start`), jadi salah
hitung baru terlihat setelah push: satu putaran CI untuk satu angka. Test itu
menghitung assertion di setiap berkas, membandingkannya dengan `plan()`, dan sekalian
memastikan tiap berkas ditutup `finish()` + `rollback`.

Uji mutasi: 22 mutan, 22 merah (13 jalur checkout/katalog/label + 6 poller + 2 rute
lanjut-bayar + 1 pemetaan hasil refund), ditambah 3 mutan penjaga plan pgTAP. Satu mutan
ekuivalen (urutan pemeriksaan `purpose` vs `kind` pada kombinasi tak terjangkau) dibunuh
dengan memaku aturan presedensinya, karena aturan itu sama di `orderKindLabel` dan kedua
RPC.
Uji langsung RPC terhadap skema cloud (blok rollback) sebelum ada satu baris TypeScript.

---

## #62 — 2026-10-04 · Aturan header Next MENIMPA, bukan menggabung; email berhenti gagal diam-diam; font lepas dari jaringan saat build

Empat sisa gelombang C audit, diverifikasi adversarial lebih dulu (12 temuan bertahan,
0 terbantah) sebelum satu baris pun diubah.

### 1. CSP hilang justru di `/dashboard` dan `/admin`

**Temuan:** aturan `headers()` Next diterapkan berurutan dengan **penugasan biasa per
kunci** (`resHeaders[key] = value`) — yang terakhir menang, tidak digabung. Aturan
`/dashboard/:path*` yang hanya menyetel `frame-ancestors` karena itu MENGHAPUS
`object-src`, `base-uri`, dan `form-action` dari seluruh permukaan ter-auth. Dibuktikan
dengan `curl -D -`:

```
/          → object-src 'none'; base-uri 'self'; form-action 'self'
/dashboard → frame-ancestors 'none'          ← semua yang lain lenyap
/admin/order → frame-ancestors 'none'
```

**Kenapa ini lebih buruk daripada sekadar celah:** `base-uri` dan `form-action` adalah
penutup jalur eksfiltrasi PASCA-XSS, dan yang bisa dieksfiltrasi justru ada di
dashboard — cookie sesi, token tamu, `gift_notes`, tombol refund admin. Sementara
komentar di `next.config.ts` DAN DECISIONS #57 sama-sama menyatakan perlindungan ini
global, jadi siapa pun yang membaca repo menyimpulkan ia terpasang. Tak ada satu test
pun yang menyentuh security header.

**Keputusan:** aturan dipindah ke `config/security-headers.ts` (modul polos, tanpa
dependensi) dengan `BASE_CSP` sebagai SATU sumber dan `AUTH_CSP = \`${BASE_CSP}; frame-ancestors 'none'\``
— diturunkan, bukan disalin: menyalin literalnya akan menciptakan ulang drift yang sama
begitu satu direktif ditambahkan.

**Ditolak:**
- *Menulis ulang string lengkap di `noFrameHeaders`* — persis drift yang sedang ditambal.
- *Test "setiap aturan ber-kunci CSP memuat ketiga direktif"* — tidak menguji
  penimpaannya sama sekali, dan akan lolos pada aturan masa depan yang menimpa
  `Referrer-Policy` atau `Permissions-Policy` (kelas cacat sama, kunci beda). Testnya
  meniru perilaku Next lalu meng-assert header EFEKTIF per jalur perwakilan.
- *Mengimpor `next.config.ts` dari Vitest* — berkas itu meng-import `@sentry/nextjs` di
  baris pertama; seluruh SDK akan terseret ke graph jsdom tanpa guna.

**Catatan jujur:** tiruan `source → regex` di test MULA-MULA salah — ia menuntut garis
miring sehingga menyimpulkan `/dashboard` polos tak terkena aturan ter-auth. Yang
membantahnya bukan penalaran melainkan `curl` ke server nyata. Pada `:name*`,
path-to-regexp membuat garis miring di DEPANNYA ikut opsional.

### 2. Kegagalan email tak terlihat siapa pun

`src/server/email/notify.ts` adalah SATU-SATUNYA berkas di `src/server/` yang tak memakai
`reportHandledError` (16 berkas lain memakainya), dan komentarnya mengklaim "Sentry
menangkap console" — **tidak benar**: tak ada `captureConsoleIntegration` di ketiga
`Sentry.init`. Klaim itulah yang membuat celahnya terlihat sudah tertutup. Kuitansi
dikirim SEKALI pada transisi `activated` tanpa retry, jadi satu kegagalan Resend =
bukti pembayaran hilang permanen bagi pelanggan yang SUDAH membayar. `sendExpiryReminder`
lebih buta lagi: `catch { return "error"; }` membuang objek galatnya.

**Keputusan:** `reportHandledError` ditambahkan di empat titik (kuitansi: status error +
catch; pengingat: status error + catch) dan di `admin/log.ts`.

**Ditolak:**
- *MENGGANTI `console.*` dengan `reportHandledError`* — meski itu bunyi harfiah temuan
  audit. `NEXT_PUBLIC_SENTRY_DSN` masih kosong dan `Sentry.init` ber-`enabled: NODE_ENV
  === "production"`, jadi `reportHandledError` **no-op hari ini**; mengganti akan
  menghapus satu-satunya tujuan yang berfungsi (stdout → log Easypanel) dan membuka
  jendela tanpa sinyal sama sekali sampai Fase 6. Keduanya dipasang berdampingan; tak
  ada aturan `no-console` di ESLint sehingga biayanya nol.
- *Mengirim `message` galat Resend ke Sentry* — pesan `validation_error` rutin mengutip
  isi field `to`, yaitu alamat email pelanggan, dan `scrubSentryEvent` hanya meredaksi
  token tamu. Komentar bukan gerbang: **field `message` dihapus dari `SendEmailResult`**
  sehingga tak ada yang bisa dilaporkan secara tak sengaja. Yang dibawa `code`
  (`error.name` Resend — enum tertutup) + `statusCode`, karena `application_error` lahir
  dari tiga jalur runtime berbeda yang hanya dibedakan olehnya. Aman dihapus: `grep`
  membuktikan `message` tak pernah dikonsumsi siapa pun.

### 3. Font lepas dari jaringan saat build

> **Ralat (commit berikutnya, hari yang sama):** bagian ini mula-mula hanya
> memindahkan DUA font marketing, dan saya menyatakan build "tak lagi butuh
> jaringan ke Google". Itu **salah cakupan**: sepuluh tema memakai 20 keluarga
> font Google lain, dan kegagalan build berikutnya justru datang dari sana
> (`src/themes/aria/index.tsx` → Inter). Ketergantungannya baru benar-benar
> hilang setelah ke-20 keluarga ikut di-self-host — lihat #64.

`next/font/google` self-hosted bagi PERAMBAN, tetapi Next mengunduh berkasnya dari Google
**saat build** — jadi `pnpm build` di CI dan di Docker build yang jadi deploy Easypanel
sama-sama bergantung pada `fonts.googleapis.com`. Ketergantungan itu gagal nyata pada
2026-10-04: CI merah pada commit yang tak menyentuh font, hijau pada re-run tanpa
perubahan. Di CI = satu re-run; di deploy produksi = deploy gagal saat perbaikan mendesak
perlu dikirim.

**Keputusan pemilik (2026-10-04):** self-host berkasnya. Dua font variabel subset `latin`
di `src/fonts/` (~112 KB), `next/font/local`, rentang bobot sama seperti sebelumnya.
Diverifikasi di peramban: kedua font `loaded`, `--mrv-display`/`--mrv-body` terpasang,
tampilan identik.

### 4. Ikon situs — dan kenapa TIDAK di root

Tak ada favicon sama sekali (`/favicon.ico` → 404). Satu `icon.svg` memakai warna mark
`opengraph-image.tsx`.

**Diletakkan per route group, BUKAN di `src/app/`.** Ikon di root diwarisi `/[slug]`,
yaitu halaman undangan TAMU — dan **"Tanpa watermark Merriva" adalah fitur yang dijual di
paket Premium**. Menaruh merek kami di tab undangan pelanggan Premium akan menggerusnya
dari pintu belakang. Diverifikasi: `/harga`, `/masuk`, `/dashboard` masing-masing dapat
ikon ber-hash sendiri; `/andi-sinta-demo` nol tautan ikon. Konsekuensi yang diterima:
tab `not-found.tsx` global dan `global-error.tsx` tetap tanpa ikon.

Butir "empat direktif CSP gratis" ditutup sebagai **tak berlaku**: direktif keempat itu
tak pernah ada — tiga yang disebut #57 memang sudah terpasang, hanya tersapu di
permukaan ter-auth (bagian 1 di atas).

---

## #63 — 2026-10-04 · Setiap `return` senyap di jalur uang & email kini meninggalkan jejak

Lanjutan #62 untuk tiga temuan gelombang C yang tersisa di dimensi observabilitas.

### Prasyarat kuitansi yang dibuang tanpa jejak

`notifyOrderPaid` punya empat `return` sebelum email terkirim, dan SETIAP query-nya
membuang `error` lewat destrukturisasi. `.maybeSingle()` menjawab `data: null, error:
null` untuk 0 baris — bentuk yang **identik** dengan `data: null, error: <gangguan DB>`.
Jadi "kuitansi tak terkirim karena ordernya hilang" dan "Postgres sedang bermasalah"
terlihat sama persis: tidak terlihat sama sekali.

Satu cabang yang paling mahal ditemukan skeptis, bukan oleh temuan aslinya: bacaan
`packages` memilih TEMPLATE (`pkg?.kind === "addon_momen"`). Bila gagal, order add-on
Album Momen diam-diam dikirimi **kuitansi aktivasi undangan** — "undangan Anda kini
aktif", lengkap dengan masa aktif dan link undangan. Kuitansi yang SALAH, terkirim, tanpa
jejak. Karena itu cabang ini melapor tetapi **tetap mengirim**: kehilangan kuitansi
sepenuhnya lebih buruk daripada nama paket yang kosong.

`!order.user_id` sengaja TETAP senyap: akun yang dihapus meninggalkan `orders` ber-`user_id`
NULL demi pembukuan (A6) — itu bukan galat, dan melaporkannya hanya menjadi derau tetap.
`profiles` juga diabaikan: `full_name` memang nullable dan kegagalannya kosmetik.

### Aksi uang admin tanpa satu pun telemetri

`src/server/actions/admin.ts`: nol `reportHandledError`. Galat RPC refund menjadi
`?msg=refund_failed` lalu lenyap. Kini 12 titik: galat RPC pada aktivasi manual,
perpanjang, suspend, refund, reinstate, ganti-pemilik — plus cabang **fallthrough** tiap
aksi.

**Fallthrough itu yang paling berharga,** dan alasannya konkret: `refunded_downgraded`
(B3) pernah jatuh ke sana dan terbaca "gagal" oleh admin padahal refundnya BERHASIL di
DB — dengan risiko refund ganda manual di dashboard Pakasir. TypeScript tak bisa
menangkapnya (`result` bertipe `string`). Di titik itu `error` bernilai null, jadi
pesannya dirakit sendiri; `toError(null)` hanya akan menghasilkan "unknown error".

**Ditolak:** *melaporkan cabang `!parsed.success`* — itu validasi FORMAT, bukan kerusakan
sistem. Melaporkannya berarti satu isu Sentry tiap salah ketik, sekaligus memasukkan
input mentah tak tervalidasi ke `extra` yang tak disaring `sentry-scrub`. Konsisten dengan
repo: tak satu pun dari 16 pemakai `reportHandledError` duduk di cabang validasi.

### `notify.ts` akhirnya punya test — dan uji mutasi mengubah kodenya

Berkas itu **nol test** sebelum ini. 21 test baru mengunci pemilihan template, tiap
`return` senyap, dan larangan PII.

Dua mutan BERTAHAN pada putaran pertama, keduanya celah nyata di test, bukan di kode:
- *hasil RPC refund tak dikenal tak dilaporkan* — tak ada test yang menyentuhnya;
- *galat DB diganti `Error` generik* — test hanya memastikan "ada laporan", bukan **objek
  galat mana**. Itu penting: `reportHandledError` menyusun nama isu Sentry dari `code`
  Postgres (`SupabaseError:57014`), jadi melaporkan `Error("undangan hilang")` menyatukan
  seluruh gangguan DB menjadi satu isu yang tak bisa didiagnosis. Test kini meng-assert
  identitas objeknya.

**Satu mutan EKUIVALEN mengubah kodenya.** `if (invErr || !inv)` tak bisa dibunuh: supabase-js
tak pernah mengembalikan baris berbarengan dengan galat, jadi `!inv` sudah menangkap kedua
keadaan dan `invErr ||` adalah cabang yang tak pernah dieksekusi. Alih-alih menerima mutan
ekuivalen, kondisinya disederhanakan menjadi `if (!inv)` — `error`-nya tetap dipakai untuk
DIAGNOSIS (`invErr ?? new Error(...)`), bukan untuk DETEKSI. Berlaku untuk keempat bacaan.

Uji mutasi: 10 mutan, 10 merah (setelah dua perbaikan test dan satu penyederhanaan kode).

---

## #64 — 2026-10-04 · Seluruh font tema ikut di-repo; build benar-benar lepas dari Google + gerbang deploy

### Ralat atas #62 bagian 3

#62 memindahkan dua font MARKETING ke `next/font/local` dan menyatakan build tak lagi
butuh jaringan ke Google. **Itu salah cakupan.** Sepuluh tema memakai **20 keluarga font
Google lain**, dan kegagalan build berikutnya datang persis dari sana
(`src/themes/aria/index.tsx` → Inter). Tiga kegagalan dalam satu hari, semuanya
`next/font/google`, semuanya lolos saat di-re-run tanpa perubahan apa pun — jadi ini
bukan gangguan jaringan sesekali, melainkan ketergantungan yang memang rapuh.

**Keputusan pemilik (2026-10-04):** self-host ke-20 keluarga. 75 berkas woff2 subset
`latin`, 1,4 MB di repo.

**Instance STATIS per bobot, bukan font variabel.** Google CSS2 mengembalikan file
variabel bila diminta rentang bobot, tetapi di sini tiap (keluarga, bobot, style) diminta
terpisah sehingga yang turun adalah instance statis — SAMA dengan yang selama ini diunduh
`next/font/google` untuk tema. Alasannya menghindari regresi visual: instance statis
di-hint per bobot, sementara interpolasi variabel di bobot 500 bisa berbeda tipis. Pada
halaman undangan, peramban juga hanya mengunduh bobot yang benar-benar dipakai.

**`preload: false` WAJIB terbawa.** `next/font/local` default-nya `true`, sementara
seluruh tema sengaja `false` (AUDIT-2026-09-04 PER-1): `next/font` meng-emit
`<link rel=preload as=font>` untuk SETIAP tema yang tergabung di graph modul `/[slug]` —
bukan hanya tema yang dipakai — yaitu 116 berkas / 2,03 MB per pembukaan undangan.
Diverifikasi ulang setelah migrasi: `/andi-sinta-demo` mengembalikan **nol** tautan
preload font.

Diverifikasi di peramban pada undangan nyata: `--er-disp-a`/`--er-body-a` terpasang,
Fraunces (300/400/500 + italic) dan Instrument Sans (400/500/600) berstatus `loaded`,
tampilan tak berubah.

### Gerbang deploy: pemicu yang dipindah, bukan `needs:` yang ditambahkan

Butir audit "gerbang deploy `needs: verify`" ternyata **tak berlaku apa adanya**: tak ada
job deploy di GitHub Actions sama sekali. Easypanel auto-build saat push ke `main`, dan
webhook-nya berjalan PARALEL dengan CI — jadi commit ber-CI-merah sudah hidup di produksi
beberapa menit kemudian, dan satu-satunya yang mengetahuinya adalah orang yang mengecek
`gh run list` SESUDAHNYA. Itu deteksi, bukan pencegahan. Gerbang yang sebenarnya cocok
(required status check) terkunci: `gh api …/branches/main/protection` → 403 "Upgrade to
GitHub Pro".

**Keputusan pemilik (2026-10-04):** branch `production` yang dipromosikan CI.

**Penjaga `if:` WAJIB, dan ketiadaannya akan membuat obatnya lebih berbahaya daripada
penyakitnya.** `ci.yml` juga terpicu `pull_request:` tanpa filter branch. Job promote yang
hanya ber-`needs: [verify, db]` akan ikut jalan pada SETIAP PR hijau — termasuk PR
Dependabot — dan pada event `pull_request` `github.sha` adalah merge commit yang BERINDUK
`main`, sehingga `git push <sha>:refs/heads/production` SAH sebagai fast-forward dan
BERHASIL. Hasilnya: kode yang belum di-merge naik ke produksi otomatis. Karena itu
`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.

Didorong **tanpa `--force`**, sengaja: server GitHub menolak bila bukan fast-forward,
sehingga `production` tak pernah bisa mundur atau bercabang diam-diam.

**Belum berlaku sampai pemilik mengubah branch yang diawasi Easypanel** dari `main` ke
`production` (LAUNCH-CHECKLIST Fase 1). Sebelum itu job ini hanya memelihara cermin yang
tak dipakai — aman, tetapi bukan gerbang. Itu dicatat sebagai butir checklist, bukan
diasumsikan selesai.

---

## #65 — 2026-10-05 · Reset pengingat H-14 yang hilang dua kali, dan test yang menghentikannya

**Temuan:** `activate_paid_order` tidak lagi me-reset `reminder_sent_at`. Diverifikasi di DB
PRODUKSI, bukan hanya di berkas: fungsi itu tak memuat `reminder_sent_at` sama sekali,
sementara `admin_extend_invitation` masih.

**Riwayatnya — dua kali hilang, keduanya diam:**
- `20260730130000` menambahkan `reminder_sent_at = null` ("siklus aktif baru → pengingat
  H-14 baru");
- `20260826130000` (FASE H) membuat ulang fungsi itu untuk cabang add-on dan menjatuhkan
  barisnya;
- `20261004130000` (B3, upgrade paket — **commit saya sendiri kemarin**) membuat ulang lagi
  dan meneruskan kelalaian yang sama.

**Akibatnya menimpa pelanggan yang paling berharga.** Cron `expiry-reminders` menyaring
`.is("reminder_sent_at", null)`. Undangan yang pernah diperingatkan H-14 lalu DIPERPANJANG
membawa penanda lama selamanya → tak pernah diperingatkan lagi → masa aktifnya habis tanpa
satu pun email. Tak ada galat, tak ada angka di `cron_runs.stats`. Yaitu: justru orang yang
sudah terbukti mau membayar yang kehilangan undangannya diam-diam. `docs/ARCHITECTURE.md`
selama itu menjanjikan "di-reset saat perpanjangan" — janji yang sudah tidak benar.

**Asimetri yang disengaja, dan itu yang mudah salah:**
- cabang UNDANGAN (aktivasi, bayar ulang, perpanjangan, aktivasi manual admin) → **reset**,
  karena `active_until` dimajukan: siklus baru butuh pengingat baru;
- cabang UPGRADE → **tidak**, karena `active_until` tak berubah. Me-reset-nya akan mengirim
  pengingat KEDUA untuk periode yang sama;
- cabang ADD-ON → tidak menyentuh baris undangan sama sekali;
- hasil `held` (undangan ditangguhkan) → tidak, karena tak ada siklus baru yang dimulai.

**Kenapa ia bisa hilang dua kali: tak ada satu pun test yang menyentuhnya.** Lolos review,
typecheck, dan 1300+ unit test — karena unit test me-MOCK RPC ini.
`supabase/tests/database/reminder_reset.test.sql` (8 assertion) kini menguji keempat cabang
di atas; pembuatan-ulang berikutnya akan memerahkan CI, bukan diam.

**Cara menemukannya patut dicatat:** ia muncul sebagai temuan SAMPINGAN dari workflow
perancangan B7 (peringatan pra-purge), ketika penyerang menolak usul "pakai penanda monoton
tanpa reset" dengan menunjukkan bahwa pola `reminder_sent_at` yang dikutip sebagai preseden
**idempoten justru karena ada resetnya** — lalu memeriksa dan menemukan resetnya sudah tak
ada. Rancangan yang dibantah menyelamatkan bug yang sudah hidup di produksi.

---

## #66 — 2026-10-05 · Tiga kebocoran retensi yang ditemukan saat merancang email, bukan saat menulisnya

Workflow perancangan B7 (peringatan pra-purge) menghasilkan tiga temuan yang lebih besar
daripada emailnya sendiri. Ketiganya diverifikasi langsung di kode & DB sebelum disentuh.

### 1. Undangan DITANGGUHKAN tak pernah dipurge — data tamu tersimpan selamanya

Rantainya tertutup rapat dan tak ada yang melingkupinya: `admin_suspend_invitation` hanya
menyetel `status='suspended'` **tanpa menyentuh `active_until`**; `cron/expire-invitations`
hanya membalik `active` → `expired`; `purge_invitation_data` menolak apa pun selain
`expired`. Jadi nama tamu, nomor HP, isi ucapan, dan catatan amplop tersimpan **tanpa batas
waktu** — di luar retensi 6 bulan yang dijanjikan `/privasi` dan di luar UU PDP 27/2022.
Yang menanggungnya TAMU, yang tak melakukan apa pun; yang bermasalah host-nya.

**Keputusan pemilik (2026-10-05):** ikutkan ke retensi yang sama.

Jam retensinya **tidak berubah**: tetap `active_until`, yang justru tak disentuh suspend —
jadi tak ada tanggal baru yang perlu dikarang dan tak ada kolom baru. Indeks parsial
`invitations_purge_scan_idx` hanya mencakup `status='expired'` sehingga TIDAK melayani scan
yang diperlebar; diganti `invitations_purge_scan_v2_idx` dan yang lama di-drop karena
sepenuhnya tercakup.

**Batas cakupan dijaga DUA ARAH** (`purge_suspended.test.sql`): `suspended` harus ikut, dan
`active` harus tetap ditolak. Arah kedua jauh lebih berbahaya — `active` yang ikut terpurge
berarti menghapus data undangan yang sedang tayang untuk tamunya.

**Konsekuensi yang diterima sadar:** bila sengketa konten muncul >6 bulan setelah masa aktif
berakhir, bukti isinya sudah tiada. `admin_logs` (alasan suspend + admin pelakunya) dan
`orders` TETAP tersimpan; yang hilang hanya data pribadi tamu.

### 2. `/syarat` menjanjikan unduhan foto galeri yang tidak ada

Dokumen legal yang kami terbitkan menyuruh pelanggan "unduh yang Anda perlukan" untuk —
antara lain — **foto galeri**, padahal produk ini hanya punya tiga jalur unduh: XLSX tamu,
XLSX amplop, dan ZIP Album Momen. Menyuruh orang melakukan yang mustahil, untuk data yang
lalu kami hapus permanen, **memperburuk posisi kami secara hukum, bukan memperbaikinya**.

**Keputusan pemilik:** perbaiki kalimatnya sekarang, unduhan ZIP galeri masuk backlog.
Kalimatnya kini menyebut persis apa yang bisa diunduh, dan mengatakan terus terang bahwa
foto galeri adalah berkas yang pemilik unggah sendiri sehingga aslinya perlu disimpan.

### 3. Foto Album Momen tak terjangkau justru saat akan dihapus

`/dashboard/undangan/[id]/momen` me-`return` kartu "aktifkan undangan dulu" SEBELUM
merender `MomenManager` — satu-satunya tempat tautan ZIP berada. Begitu undangan tak lagi
aktif, pemilik mendarat di layar itu dan menyimpulkan foto tamunya terkunci di balik
perpanjangan. Lalu retensi menghapusnya.

Yang membuatnya paling mahal: **foto Album Momen satu-satunya yang tak bisa dibuat ulang** —
tamu yang memotretnya, tak ada salinan di mana pun. Route ZIP-nya sendiri TIDAK pernah
memeriksa status undangan (hanya kepemilikan + status album), jadi datanya selalu
terjangkau; yang hilang hanya PINTUNYA.

Kartu itu kini menawarkan unduhan bila albumnya punya foto, dan tetap berbunyi "aktifkan
dulu" bila kosong — diverifikasi kedua cabangnya di peramban.

**Pola yang berulang hari ini:** ketiganya ditemukan saat MERANCANG sesuatu yang lain.
Penyerang rancangan menolak usul "tautkan ke halaman kelola Momen" dengan memeriksa halaman
itu sendiri — dan menemukan pintunya tertutup. Lihat juga #65, yang lahir dari penolakan
serupa.

---

## #67 — 2026-10-05 · Peringatan pra-purge: data pribadi tak lagi dihapus tanpa pemberitahuan

`docs/DATA-MODEL.md` sudah **menjanjikan** "email pengingat sebelum penghapusan" yang tak
pernah dibuat, dan `/syarat` menyuruh pelanggan mengunduh datanya sebelum tenggat — tanpa
pernah memberi tahu kapan tenggat itu tiba. Cron `purge-expired` menghapus permanen tamu,
RSVP, `gift_notes`, `invitation_events`, objek media, dan foto Album Momen **tanpa satu pun
import email**.

### Jendela dihitung dengan MEMBALIK arahnya

Tanggal purge per baris TIDAK dihitung dengan `active_until + 6 bulan`: penjumlahan itu tak
simetris dengan `retentionCutoffIso` yang memakai `setUTCMonth(m - 6)` dan meluber (31
Agustus − 6 bulan → 3 Maret; 3 Maret + 6 bulan → 3 September ≠ 31 Agustus). Sebagai
gantinya `now` yang digeser ke depan lalu dilewatkan ke fungsi cutoff yang SAMA:

    baris jatuh tempo dalam ≤ d hari  ⟺  active_until < dueWithinIso(now, d)

Dengan itu peringatan dan purge mustahil bergeser satu terhadap yang lain. Rumusnya pindah
ke `src/server/cron/retention.ts` — satu definisi, dua fase.

### Penanda terikat SIKLUS, tanpa satu pun RPC perlu me-resetnya

Dua kolom (`purge_warned_at`, `purge_final_warned_at`), dan **tak ada kolom "siklus"**.
Penanda dianggap milik siklus berjalan bila nilainya > `active_until`; perpanjangan selalu
memajukan `active_until`, jadi penanda lama basi dengan sendirinya.

Itu disengaja dan alasannya empiris: pola "ingat reset di setiap RPC" sudah **terbukti
membusuk di repo ini** — `reminder_sent_at` hilang dua kali saat `activate_paid_order`
dibuat ulang (#65). Rancangan yang mengandalkan reset manual akan mengulang kesalahan yang
sama; rancangan yang basi sendiri tidak bisa.

### Gerbang purge: dua janji yang saling tarik

`bolehPurge` adalah fungsi MURNI yang diuji, bukan filter query:
- belum diperingatkan (atau penandanya dari siklus lama) → **tunggu**, jangan hapus —
  itu janji `/syarat` & `/privasi`;
- baru diperingatkan, jedanya belum lewat → **tunggu**, beri waktu menindaklanjuti;
- jauh lewat tenggat (21 hari) → **backstop**: hapus meski peringatan tak pernah terkirim.

Backstop-nya bukan kelalaian melainkan keseimbangan: pipeline email yang rusak tak boleh
menahan kewajiban retensi selamanya, karena **menyimpan data melewati batas adalah
pelanggaran yang berlawanan arah**. Jumlahnya dihitung terpisah di `cron_runs.stats` supaya
terlihat di `/admin`, bukan hilang di antara angka lain.

### Keputusan kecil yang menentukan

- **Menumpang `purge-expired`, bukan cron kelima.** Populasinya persis sama, dan dua baris
  `cron_runs` untuk satu rangkaian akan membuat kartu kesehatan di `/admin` ambigu.
- **Kadens 12 jam, bukan 24.** `idempotencyKey` Resend hanya berlaku 24 jam; kadens di
  bawah itu mencegah peringatan ganda bila penandaan gagal setelah email terkirim.
  `JADWAL_JAM` + LAUNCH-CHECKLIST diubah dalam commit yang sama, dan satu test mengunci
  angkanya beserta alasannya.
- **Tahap FINAL didahulukan.** Baris yang masuk antrean terlambat — cron mati beberapa
  hari, atau rilis pertama fitur ini — tak boleh menerima "30 hari lagi" saat sisanya tiga,
  dan tak boleh menerima dua email dalam satu run.
- **Satu templat, dua nada.** "H-30"/"H-7" adalah nama TAHAP, bukan isi: `daysLeft` dihitung
  per baris dari tanggal purge sebenarnya. `final` membalik urutan tombol — pada H-30
  memperpanjang masih wajar dipikirkan; pada H-7 menyelamatkan data lebih realistis
  daripada memutuskan membeli.
- **Pemilik tanpa akun (`user_id` NULL) DIHITUNG**, bukan dilewati diam-diam.
- **Penanda ditulis HANYA saat email benar-benar `sent`.** Menandai terlalu dini berarti
  gerbang purge meloloskan penghapusan untuk orang yang tak pernah diberi tahu.

Uji mutasi: 8 mutan, 8 merah — termasuk "gerbang purge jalan tanpa peringatan" dan
"backstop dibuang". Seleksi kandidatnya diuji langsung terhadap skema cloud.

Ketiga sisa B7 — notis kedaluwarsa, kuitansi aktivasi manual, email suspend — dikerjakan
di #68.

---

## #68 — 2026-10-05 · Tiga titik bisu terakhir: aktivasi manual, kedaluwarsa, penangguhan

Penutup B7. Tiga peristiwa yang mengubah keadaan pelanggan secara nyata dan sampai hari ini
berlangsung **tanpa sepatah kata pun** kepada orang yang terkena. Ketiganya tak punya
hubungan teknis satu sama lain; yang menyatukannya adalah bentuk cacatnya.

### 1. Kuitansi untuk aktivasi manual — pembayar transfer bank

Webhook, poller, dan cron semuanya memanggil `notifyOrderPaid`. `adminActivateInvitationAction`
tidak. Akibatnya pembayar di luar sistem — transfer bank, justru pelanggan yang paling butuh
bukti karena tak punya jejak gateway — adalah **satu-satunya** yang membayar penuh dan tidak
menerima apa pun.

Perbaikannya tiga baris, tetapi satu di antaranya menyingkap kenapa ia tak pernah ada:
`generateOrderCode()` ditulis **inline** ke argumen RPC, dan `admin_activate_invitation`
mengembalikan `(result, slug)` saja — jadi kode order yang baru dibuat **terbuang** begitu
loop selesai. Tak ada kode, tak ada kuitansi. Kodenya kini di-hoist, dan setelah loop ia
memegang percobaan TERAKHIR, yaitu percobaan yang sama yang menghasilkan `result`.

- **Gerbangnya `activated` SAJA**, tidak menumpang cabang `already_paid` di bawahnya. Secara
  analitis `already_paid` tak terjangkau di sini — RPC baru saja meng-`insert` order `pending`
  ber-kode segar dalam transaksi yang sama — tetapi ketakterjangkauan itu properti
  implementasi RPC, bukan kontraknya.
- **`await`, bukan `void`.** `detail()` memanggil `redirect()` yang melempar `NEXT_REDIRECT`;
  responsnya langsung dikirim dan promise yang menggantung bisa mati bersama request-nya.
- **`notifyOrderPaid` sekarang mengembalikan status kirim.** Pemanggil otomatis
  mengabaikannya — tak ada manusia di sana yang bisa menindaklanjuti. Aktivasi manual
  memakainya: hasil ≠ `sent` menjadi `activate_ok_no_email`, "Undangan aktif, kuitansi TIDAK
  terkirim, kabari pelanggan manual". Pesannya tetap "aktif", bukan "gagal" — admin yang
  membacanya sebagai kegagalan akan mengaktifkan ulang undangan yang sudah aktif. Ini
  sekaligus menutup kasus nyata: undangan tanpa pemilik (akun dihapus, A6) menghasilkan order
  ber-`user_id` NULL yang membuat `notifyOrderPaid` diam **by design**, tanpa laporan.

### 2. Notis "masa aktif berakhir"

Cron `expire-invitations` membalik status dan merevalidasi ISR. Halaman publiknya berubah
menjadi notis kedaluwarsa — dan pemilik mengetahuinya **dari tamunya**.

- **Satu kiriman, tanpa penanda dan tanpa retry.** UPDATE-nya sudah memindahkan status, jadi
  baris yang sama takkan terpilih lagi. Asimetri dengan peringatan pra-purge disengaja:
  peringatan itu MENGGERBANGI penghapusan permanen sehingga wajib ditandai hanya saat benar
  terkirim; notis ini tak menggerbangi apa pun — pengingat H-14 sudah terkirim, datanya utuh
  enam bulan, peringatan pra-purge masih menyusul. Kehilangannya merugikan, bukan merusak.
- **Yang dibatasi hanya emailnya (`NOTIFY_BATCH = 100`), bukan UPDATE-nya.** Membiarkan
  undangan yang masa aktifnya habis tetap tampil adalah cacat berbayar, dan memecah UPDATE
  per batch berarti sebagian undangan hidup sehari lebih lama dari yang dibeli. Resend
  berjalan ~2 permintaan/detik: 500 kiriman berurutan membuat job ini berjalan beberapa menit
  dan berisiko dibunuh runner cron SEBELUM `recordCronRun` — dan job sehat yang tak pernah
  melapor **dituduh mati** di `/admin`, kerusakan yang lebih besar daripada email yang hilang.
  Sisanya dilaporkan sebagai `notifyTruncated`: terlihat, bukan terpotong diam-diam.
- **Tanggal purge dari `purgeDueMs`**, fungsi yang sama yang dipakai peringatan pra-purge,
  sehingga dua email mustahil menyebut dua tanggal. Satu test menjaga tepat itu.
- **`idempotencyKey` per SIKLUS** (`expired/{id}/{epoch active_until}`): undangan yang
  diperpanjang lalu kedaluwarsa lagi berhak atas notis kedua, dan `active_until` selalu maju
  setiap perpanjangan — penanda siklus yang sudah tersedia tanpa kolom tambahan.

### 3. Penangguhan: dua kolom alasan, dan jalur banding

Penangguhan adalah satu-satunya tindakan **penegakan** di produk ini, dan ia berlangsung
paling bisu dari ketiganya.

**Keputusan pemilik (ditanyakan, bukan diasumsikan): dua kolom terpisah.** Kolom `reason`
sejak awal ditulis admin UNTUK admin dan hanya pernah mendarat di `admin_logs.detail`; isinya
wajar memuat nama pelapor, nomor telepon pihak ketiga, atau dugaan yang belum pasti. Memakai
teks itu sebagai isi email berarti satu-satunya pengaman adalah kehati-hatian admin saat
mengetik. Migrasi `20261005140000` menambah `p_public_reason`:

- **Di-drop lalu dibuat ulang, bukan `create or replace`** — menambah parameter mengubah
  signature, dan membiarkan versi 3-argumen hidup berdampingan membuat panggilan 3-argumen
  **ambigu**. REVOKE/GRANT dipasang ulang; diverifikasi bahwa hanya `postgres` + `service_role`
  yang boleh `execute` setelahnya.
- **`default null` ada demi urutan deploy**, bukan demi pemanggil di repo ini: migrasi
  mendahului deploy, jadi untuk sesaat DB baru dipanggil aplikasi lama.
- **`public_reason` tetap dicatat di `admin_logs`, termasuk saat kosong.** Tindakan penegakan
  harus meninggalkan rekam jejak tentang apa yang **dikatakan** kepada pelanggan, bukan hanya
  apa yang diputuskan secara internal.
- **Jalur banding selalu dicetak**, ada alasannya maupun tidak. Penangguhan tanpa cara
  membantahnya bukan moderasi.
- **Email pencabutan ikut dibuat.** Tanpanya, pelanggan yang bandingnya DITERIMA tak pernah
  diberi tahu — ia hanya bisa menebak dengan membuka tautannya sendiri, dan itu lebih merusak
  kepercayaan daripada tak pernah mengirim email penangguhan sejak awal. Isinya mengikuti
  `new_status` dari RPC, bukan asumsi: reinstate memulihkan status dari `active_until`,
  sehingga undangan yang masa aktifnya sudah lewat menjadi `expired` dan **belum tampil**.

### Temuan sampingan: satu `?` mematikan pemeriksaan tipe argumen RPC

Diverifikasi empiris, bukan dibaca dari dokumen. `src/types/database.ts` awalnya diberi
`p_public_reason?: string | null`. Dengan satu properti saja ditandai opsional, TypeScript
**berhenti menolak properti berlebih** pada argumen `rpc()` untuk fungsi itu —
`p_public_reason_SALAH` lolos `tsc --noEmit` sepenuhnya, dan baru gagal saat dijalankan.
Pada fungsi tanpa properti opsional (`admin_extend_invitation`) nama ngawur tetap ditolak.
Karena itu tipenya dibuat **wajib** meski SQL-nya `default null`: setiap pemanggil di repo ini
memang selalu mengirimnya, dan pengamannya kembali menyala — dibuktikan dengan memasang nama
parameter yang salah lalu memastikan `tsc` memerah.

### Verifikasi

- **33 mutan, 33 mati** (15 + 18). Yang paling berharga: "catatan internal dikirim ke
  pelanggan", "email dikirim ulang untuk `already_suspended`", "kuitansi dirakit dari kode
  order BARU", "tanggal purge notis ditebak +6 bulan", "reinstate selalu mengaku tampil
  kembali".
- **Dua lubang di test saya sendiri ditemukan oleh mutan, bukan oleh review:** `indexOf` yang
  mengembalikan −1 membuat perbandingan urutan tombol kebetulan menjawab benar (email yang
  kehilangan satu jalan keluar akan lolos sebagai lulus), dan assertion jalur banding yang
  hanya membaca versi teks sehingga penghapusan dari versi HTML tak terlihat.
- **Satu test saya ternyata menegaskan properti yang justru sengaja ditolak** — bahwa subjek
  peringatan berbeda antar-tahap. Subjeknya memang mengikuti SISA HARI, bukan nama tahap;
  testnya diganti untuk menjaga yang benar.
- **Migrasi + 9 assertion pgTAP diuji terhadap skema cloud** dalam blok yang di-rollback,
  karena job `db` adalah satu-satunya bagian CI yang tak bisa dijalankan dari mesin ini.
  Dalam prosesnya terbentur lagi: `now()` **stabil per-transaksi**, sehingga dua baris
  `admin_logs` dalam satu transaksi bercap waktu identik dan `order by created_at desc limit 1`
  tidak menentukan. Assertion-nya dibaca lewat isi, bukan urutan.
- Version drift MCP pada `purge_suspended` (tercatat `20261004175937`, berkasnya
  `20261005100000`) sekaligus dirapikan — bila dibiarkan, `supabase db push` kelak menerapkan
  ulang berkas yang sudah jalan.

**Konsekuensi:** seluruh email di atas tetap no-op sampai `RESEND_API_KEY` + domain terverifikasi
siap, dan `/admin` akan menampilkan `notified: 0` dengan `notifyFailed` terisi sampai saat itu —
itu jujur, bukan alarm palsu.

---

## #69 — 2026-10-12 · Audit kesiapan konfigurasi: dokumen yang akan diikuti pemilik ternyata menyesatkan di sembilan titik

Pemilik meminta dipandu melalui konfigurasi go-live. Jawaban yang benar bukan menulis
panduan baru — `LAUNCH-CHECKLIST.md` (9 fase), `DEPLOYMENT.md`, dan `AUTH-SETUP.md`
sudah ada dan `AUTH-SETUP.md` terbukti akurat. Yang dibutuhkan adalah **memeriksa
apakah panduan yang akan diikuti itu masih benar**, karena dokumen yang salah lebih
berbahaya daripada dokumen yang tak ada: ia dipercaya.

Dipetakan 147 kebutuhan konfigurasi dari kode oleh lima agen (env · Supabase ·
Pakasir+Turnstile · Resend · deploy/cron/Sentry/storage), tiap irisan lalu DIBANTAH
oleh peninjau skeptis, ditutup satu kritikus kelengkapan. Hasil: **25 koreksi** atas
pemetaan dan **51 kebutuhan yang tak tercatat di dokumen mana pun**.

### Satu cacat kode: kadens `expiry-reminders` bertentangan dengan dirinya sendiri

`src/app/api/cron/expiry-reminders/route.ts` menuntut kadens **≤12 jam** di
docstring-nya sendiri, dengan alasan yang benar: "tandai hanya saat terkirim" bersifat
at-least-once, jadi email yang terkirim tetapi gagal menandai `reminder_sent_at` akan
terpilih lagi — dan satu-satunya penjaga kirim-ganda adalah `idempotencyKey` Resend
yang hanya berlaku **24 jam**. Kadens 24 jam menaruh retry-nya persis di tepi jendela
itu.

Sementara `JADWAL_JAM` menulis `24` dan LAUNCH-CHECKLIST menulis "harian". Pemilik yang
mengikuti checklist memasang kadens yang kode sendiri sebut berisiko pengingat ganda.

Ini kelalaian **#67**: argumennya identik dengan yang dipakai menaikkan `purge-expired`
24→12, dan saudara kembarnya terlewat walau alasannya sudah tertulis di repo berbulan-
bulan. Diperbaiki, dan satu test kini mengunci angkanya (mutan "kembali ke 24" merah).

### Yang paling berbahaya bukan yang hilang, melainkan yang hijau saat rusak

Pola yang berulang di hampir semua temuan: salah-konfigurasi terburuk justru **tidak
menghasilkan galat**.

- **`/api/health` menjawab `200 ok` ketika env Supabase KOSONG SAMA SEKALI.** Sehat
  dihitung `db !== "down"`, dan env kosong menghasilkan `"not_configured"`. Container
  tanpa env Supabase dinilai sehat oleh HEALTHCHECK Docker dan UptimeRobot sementara
  setiap halaman melempar 500. Restart loop yang didokumentasikan hanya terjadi pada
  "ada kunci tapi salah" — "tidak ada kunci" justru lolos hijau.
- **`NEXT_PUBLIC_APP_URL` kosong tak menimbulkan galat apa pun** (default
  `http://localhost:3000`) tetapi dari situ diturunkan daftar hostname sah token
  Turnstile. Semua form Turnstile tertolak, dengan gejala yang MENYESATKAN: RSVP
  berbunyi "Terlalu banyak percobaan" (pesan rate limit), dan reset kata sandi
  menjawab **sukses palsu** "tautan sudah dikirim" — tanpa galat dan tanpa Sentry.
- **Allow list redirect auth yang kurang** tidak menolak apa pun: GoTrue mem-fallback
  ke Site URL, pengguna mendarat di beranda dengan `?code=` yang tak pernah ditukar →
  tetap tidak login, tanpa pesan, tanpa jejak. Diverifikasi langsung di sumber
  `@supabase/auth-js`: `signInWithOAuth` merakit URL secara LOKAL tanpa request
  jaringan dan SELALU mengembalikan `error: null`, sehingga cabang penanganan galat
  di `auth.ts` tak pernah tereksekusi karena allow list.
- **`TURNSTILE_SECRET_KEY` kosong = gagal-tutup total** dengan satu `console.error`
  per permintaan dan **nol event Sentry** (tak lewat `reportHandledError`).

### Album Momen sudah dijual sekarang, dan tak ada tombol mematikannya

Migrasi `20260826110000` men-seed kelima paket add-on `is_active = true`, dan `momen_5`
**gratis + self-service tanpa pembayaran**. `MOMEN-SPEC.md` §94 melarang menjual add-on
sebelum media pindah R2 (Supabase free 1 GB ≈ 7 album penuh). Tetapi `/admin/paket`
menyaring `kind='invitation'` dan tak ada route admin untuk add-on — satu-satunya cara
mematikannya adalah SQL. Pelanggan pertama bisa mengisi kuota 1 GB lewat tier gratis,
tanpa satu rupiah masuk.

### Dua janji produk yang belum punya infrastrukturnya

- **`halo@merriva.id` belum bisa MENERIMA email.** Verifikasi domain Resend hanya
  memberi hak mengirim; SPF/DKIM tidak membuat kotak masuk. Alamat itu sudah tercetak
  di `/syarat`, `/privasi`, `/refund` sebagai kanal resmi permintaan hapus data UU PDP,
  dan sejak #68 juga sebagai **jalur banding** email penangguhan. Butuh record MX.
  Terkait: `send.ts` mengirim tanpa `reply_to` dengan `EMAIL_FROM` default `noreply@` —
  untuk email pra-purge ("data Anda akan dihapus") ketidakmampuan membalas adalah soal
  kepatuhan, bukan layanan.
- **Objek media tidak punya backup apa pun.** Supabase Pro mem-backup Postgres, bukan
  Storage; R2 juga tidak. Karena path media disimpan RELATIF dan URL dibangun saat
  render, restore DB mengembalikan baris `media` yang menunjuk objek yang tak ada
  salinannya di mana pun. Untuk produk yang menyimpan foto pernikahan pelanggan, itu
  keputusan yang harus sadar sebelum klien berbayar pertama.

### Uji terima Fase 7 yang tak bisa dieksekusi sebagaimana tertulis

"Bayar production nominal kecil (Rp10.000, **paket uji**)" mustahil: `/admin/paket`
hanya meng-UPDATE (tak ada INSERT paket di seluruh repo) dan checkout memvalidasi kode
paket terhadap `z.enum(["basic","premium"])`. Satu-satunya cara adalah **menurunkan
harga `basic` sementara** — yang terbit ke publik SEKETIKA karena aksinya me-revalidate
`/` dan `/harga`, dan checkout mengambil harga otoritatif dari DB. Selama jendela uji
siapa pun bisa membeli Basic pada harga itu.

### Koreksi angka yang akan memicu alarm palsu

`DEPLOYMENT.md` dan checklist menyuruh memverifikasi "**12 tabel**, `packages` **2
baris**". Nyatanya **15 tabel** (semuanya ber-RLS) dan **7 baris** packages. Pemilik yang
menghitung 15 lalu menyangka migrasi gagal akan menerapkannya ulang tanpa perlu. Dan
`/api/health` tak bisa dipakai sebagai bukti migrasi masuk: probe-nya sengaja tak
bergantung skema, jadi project yang terjangkau tapi KOSONG tetap menjawab `db: up`.

### Yang ternyata SUDAH tertangani — sama berharganya untuk dicatat

- Tabel **kosong** aman: `/harga` dan `/tema` punya empty state eksplisit. Yang
  mematikan adalah tabel yang **belum ada** — PostgREST galat → pra-render `throw` →
  `pnpm build` berhenti. Jadi "migrasi dulu, baru build" adalah syarat agar image bisa
  lahir, bukan preferensi urutan.
- Tema (10) dan paket undangan ter-seed migrasi dan cocok 1:1 dengan `themeRegistry`:
  butir Fase 4 "paket & harga" + "tema aktif" adalah penyesuaian, bukan prasyarat.
  Yang benar-benar kosong di project prod baru hanya `songs` dan `profiles.role=admin`.
- Font tidak butuh jaringan saat build (#64 terbukti bertahan), CSS tema digenerate
  saat build, CSP tak akan memblokir host CDN, middleware tak menyentuh halaman tamu,
  dan aktivasi pembayaran menyegarkan ISR di SEMUA jalur (bukan hanya webhook).
- `cron_runs` "RLS tanpa policy" di advisor Supabase adalah **INFO yang benar by
  design** — `revoke all from anon, authenticated` + grant hanya `service_role`.
  Menambahkan policy justru melonggarkannya.

**Keputusan:** `DEPLOYMENT.md` dikoreksi di tempatnya dengan penanda revisi (bukan
ditulis ulang — pemilik mungkin sudah membaca versi lama dan perlu melihat APA yang
berubah), `LAUNCH-CHECKLIST.md` ditambah 23 butir beserta sebab-kerusakannya, dan
`JADWAL_JAM` disamakan dengan route-nya. `AUTH-SETUP.md` tidak disentuh — ia akurat.

**Konsekuensi:** `MOMEN_SESSION_SECRET` dan penanda 🏗️ build-arg kini ada di tabel
lampiran, yaitu tabel yang benar-benar disalin pemilik saat mengisi Environment
Easypanel. Keduanya sebelumnya hanya ada di `.env.example`.

---

## #70 — 2026-10-13 · Unduhan ZIP foto galeri, dan satu tombol yang selama ini 404

Backlog #66 ditutup. `/syarat` dan email peringatan pra-purge H-30/H-7 menyuruh pemilik
mengunduh datanya sebelum retensi menghapusnya, sementara foto galeri adalah satu-satunya
data yang **tak punya jalan unduh**: daftar tamu punya ekspor `.xlsx`, Album Momen punya
ZIP, galeri tidak. #66 membuat teksnya jujur mengakui itu; entri ini membangun unduhannya.

### Dibangun dari preseden, bukan dari nol

Route ZIP Album Momen sudah memecahkan bagian yang sulit: `client-zip` dengan generator
async yang menarik satu foto pada satu waktu, STORE tanpa kompres ulang (WebP sudah
terkompres), sehingga memori VPS tetap ~1 foto untuk album berapa pun. Route galeri
mengikuti bentuk yang sama. Dua perbedaan yang disengaja:

- **Klien RLS, bukan `service_role`.** Policy `media_select` sudah membatasi ke
  `owns_invitation`, jadi kepemilikan ditegakkan dua kali — cek eksplisit di route plus
  lantai RLS — dan route ini tak memerlukan kunci yang mem-bypass RLS sama sekali. Route
  Momen butuh admin karena `momen_albums`; route galeri tidak, jadi tak diberi.
- **`purged_at` → 410 Gone, bukan 404.** Barisnya ada, isinya yang sudah tidak ada.
  Bedanya penting bagi pemilik yang bertanya kenapa unduhannya gagal; 404 akan terbaca
  "salah alamat".

Keduanya SENGAJA tidak memeriksa `invitations.status`: undangan `expired` justru pelanggan
yang paling membutuhkan route ini, karena itulah keadaan yang menuju purge.

### Cacat yang ditemukan sambil membangun: tombol Momen yang 404

Route ZIP Momen menolak apa pun selain `momen_albums.status = 'active'`. Tetapi halaman
`/dashboard/undangan/[id]/momen` menawarkan tombol "Unduh semua foto (ZIP)" begitu
`photo_count > 0`, **tanpa** memeriksa status album. Refund add-on mengarsipkan album
(`admin_refund_order` → `refunded_album_archived`), jadi kombinasi "add-on direfund +
undangan tidak aktif" membuat pemilik melihat tombol yang dijanjikan `archivedBody` —
*"foto yang sudah terkumpul masih bisa Anda unduh. Foto ini hanya ada di sini: tamu Anda
yang memotretnya"* — lalu mendapat 404.

Arah perbaikannya ditentukan oleh teks yang **sudah dibaca pelanggan**, bukan oleh selera:
`archived` adalah keadaan PENAGIHAN, bukan pernyataan bahwa datanya tak ada lagi. Yang
benar-benar menghapus data adalah purge, dan itu kini dijaga `purged_at` di kedua route.

### Batas yang tak bisa dihilangkan, dan karena itu harus dikatakan

ZIP-nya berisi **varian 1600 px, bukan berkas asli pemilik**. Foto dikompres di browser
menjadi dua varian WebP sebelum diunggah (SPEC §4.4) — server tidak pernah menerima,
apalagi menyimpan, berkas kamera aslinya. Tak ada arsitektur di repo ini yang bisa
mengembalikannya.

Kalimat `/syarat` karena itu kini menyebut galeri **beserta batas itu**. Riwayatnya
disimpan di komentar kode karena ia dua kali hampir menjadi janji yang tak ditepati:
versi pertama menyuruh "unduh yang Anda perlukan" untuk semua butir termasuk galeri yang
tak bisa diunduh; #66 mengakui ketiadaannya; #70 membangunnya. Menyebut "foto galeri bisa
diunduh" tanpa menyebut 1600 px akan menjadi janji ketiga yang salah.

`copy.email.purgeWarning.unduhHint` diperbarui dengan batas yang sama — tanpa itu
kalimatnya berubah dari kurang-berguna menjadi menyesatkan.

### Tombolnya ditaruh di halaman TAMU, dan itu bukan sembarang pilihan

`sendPurgeWarning` mengarahkan pemilik ke `/dashboard/undangan/{id}/tamu`. Sebelum ini
tautan email itu mendarat di halaman yang **tak punya unduhan foto sama sekali** — jadi
email yang berbunyi "unduh data Anda" mengirim orang ke tempat yang tak bisa
melakukannya. Kartu unduhan di halaman itu yang menutup lingkaran tersebut.

### Verifikasi

14 test, dan **7 mutan 7 mati** — termasuk "galeri mengunduh thumbnail 400 px" (memberi
pemilik berkas yang tak berguna untuk apa pun), "penjaga `purged_at` dibuang", "foto gagal
TIDAK dilewati" (satu foto rusak menggagalkan seluruh unduhan menjelang purge), dan
"album terarsip ditolak lagi" — mutan terakhir itu adalah regresi cacat yang baru
diperbaiki, jadi testnya memang menahannya.

**Catatan proses:** commit sebelumnya (`4d2b013`) mendarat dengan CI **merah** karena
`pnpm typecheck` dijalankan SEBELUM berkas test terakhir ditulis dan tidak diulang —
`lint` dan `test` hijau menutupi tipe mock yang salah. Gerbang `production` menahannya
(branch itu tetap di commit hijau sebelumnya), dan itu pertama kalinya gerbang #64
benar-benar menghentikan sesuatu. Ketiga pemeriksaan dijalankan ulang bersamaan di entri
ini.

---

## #71 — 2026-10-13 · Satu daftar env, satu perintah, dan dua berkas yang menunjuk project berbeda

Pemilik meminta "satu env yang sama untuk test dan produksi agar mudah diisi dan tidak ada
yang terlewat". Permintaan literalnya tak bisa dipenuhi, tetapi keluhannya sah — dan
penyebabnya ditemukan saat memeriksa.

### Kenapa satu berkas untuk keduanya tidak mungkin, dan tidak diinginkan

`.dockerignore` membuang `.env*` dari konteks build, jadi **tak ada berkas env yang pernah
masuk ke image**: nilai produksi yang sebenarnya hidup di panel Easypanel, dan enam di
antaranya harus pula diteruskan sebagai `--build-arg` karena Next meng-inline setiap
`NEXT_PUBLIC_*` saat `next build`.

Lebih penting: satu berkas untuk dev DAN produksi berarti setiap `pnpm dev` menyambung ke
Supabase produksi — menulis baris nyata, mengirim email nyata lewat Resend, memanggil
Pakasir nyata. Untuk produk yang menyimpan data tamu pelanggan, itu bukan kenyamanan
melainkan jalan menuju insiden.

### Yang ditemukan: dev sudah setengah jalan ke sana

Repo ini punya `.env` DAN `.env.local`, dan keduanya menunjuk **project Supabase yang
berbeda** — `.env` ke project cloud (yang pemilik tetapkan sebagai produksi), `.env.local`
ke stack lokal `127.0.0.1:54321`. Itu sendiri setup yang benar.

Masalahnya presedensi: Next memuat `.env` sebagai lapis **terendah**, termasuk saat
`pnpm dev`. Tiga variabel (`MOMEN_SESSION_SECRET`, `CRON_SECRET`, `PEXELS_API_KEY`) yang
tak ada di `.env.local` sudah diambil dari `.env` — dan bila `.env.local` hilang atau salah
nama, seluruh dev jatuh ke kredensial produksi **tanpa satu pun peringatan**.

### Yang dibangun

- **`.env.example` menjadi DAFTAR INDUK.** Satu berkas yang menjelaskan tiga tempat,
  menandai keenam build-arg, dan untuk setiap variabel menyebut nilai dev vs prod beserta
  AKIBAT KONKRET bila kosong. Bukan daftar nama; daftar konsekuensi.
- **`pnpm env:check [--prod]`.** Menyebut apa yang kosong + akibatnya, mana yang build-arg,
  variabel mana yang diam-diam diwarisi dari `.env`, dan memperingatkan bila kedua berkas
  menunjuk project berbeda.
- **`.env.production.local`.** Satu berkas yang pemilik isi untuk produksi lalu disalin ke
  panel. Hanya dimuat saat `NODE_ENV=production`, jadi `pnpm dev` tak pernah menyentuhnya.
  Dipra-isi dari project cloud yang ter-link, dengan `MOMEN_SESSION_SECRET` dan
  `CRON_SECRET` dibangkitkan BARU — berbeda dari dev, sengaja. Pakasir TIDAK disalin dari
  `.env` karena nilainya identik dengan `.env.local`, jadi kemungkinan besar sandbox.

### Anti-drift dijaga CI, bukan ingatan

Manifestnya dipisah ke `scripts/env-manifest.mjs` agar bisa diuji, dan
`tests/unit/env-manifest.test.ts` menjaga tujuh properti: tak ada variabel di kode yang
belum terdaftar, tak ada entri yatim, setiap variabel wajib menjelaskan akibat kosongnya,
tak ada rahasia ber-prefix `NEXT_PUBLIC_`, hanya `NEXT_PUBLIC_*` yang boleh ditandai
build-arg, setiap variabel ada di `.env.example`, dan **daftar build-arg cocok persis
dengan `ARG` di Dockerfile**.

Alasannya empiris: setiap daftar manual di repo ini sudah pernah membusuk —
`reminder_sent_at` hilang dua kali (#65), `MOMEN_SESSION_SECRET` tak pernah masuk lampiran
checklist (#69), kadens `expiry-reminders` bertentangan dengan route-nya sendiri
berbulan-bulan (#69). Validator yang daftarnya usang lebih berbahaya daripada tak ada
validator, karena ia menjawab "LENGKAP".

### Satu pelajaran teknis

Pemindai anti-drift awalnya memelihara daftar nama berkas yang dikecualikan, karena berkas
yang menulis `process.env.X` di docstring-nya melaporkan variabel palsu bernama `X`. Itu
obat yang salah — daftar semacam itu harus diperbarui setiap kali ada docstring baru, yaitu
persis jenis daftar yang test ini ada untuk mencegah. Diganti: **buang komentar sebelum
memindai**, dan hanya komentar yang jelas (blok, baris yang dimulai dengan tanda komentar).
Komentar di TENGAH baris sengaja dibiarkan: memotongnya akan menelan kode setelah URL di
dalam string, dan false negative jauh lebih berbahaya daripada false positive di sini.

**Verifikasi:** 10 test, 7 mutan 7 mati — termasuk "entri dibuang dari manifest", "entri
hantu ditambahkan", "rahasia server ditandai build-arg", "komentar tidak dibuang saat
memindai", dan "ARG dibuang dari Dockerfile". 1467 test hijau.

**Konsekuensi:** nilai produksi masih harus disalin manual ke panel Easypanel — tak ada API
Easypanel di sini. Yang hilang hanyalah keharusan mengingat apa saja yang perlu disalin.

---

## #72 — 2026-10-13 · Migrasi Pakasir v1 → v2, tujuh hari sebelum v1 dimatikan

Pemilik mengabarkan ada pembaruan Pakasir. Yang ditemukan: **API v1 dihentikan 20 Oktober
2026**, dan integrasi kita seluruhnya v1. Halaman yang memuat pengumuman itu adalah halaman
yang JUGA mendokumentasikan webhook, `transactiondetail`, `transactioncancel`, dan
`paymentsimulation` — kalimatnya berbunyi "Integrasi API v1 **ini**" tanpa merinci endpoint,
jadi cakupannya ambigu. Di jalur uang, ambigu berarti harus diasumsikan yang terburuk.

### Dokumen vendor tidak dipakai sebagai dasar — API-nya dipanggil

Seluruh bentuk di bawah berasal dari pemanggilan API sandbox sungguhan. Itu bukan
kehati-hatian berlebihan: **dokumen Pakasir terbukti salah dua kali dalam satu hari.** Ia
menulis `expired_at` padahal API mengirim `expires_at`, dan menjanjikan `va_number: ""`
yang sebenarnya tak ada sama sekali. Mengode dari dokumen akan menghasilkan dua
`undefined` tanpa satu pun galat.

Tiga penemuan yang menentukan seluruh rancangan:

- **Status dan pembatalan v2 berkunci `txn_id`, bukan `order_id`.** Keduanya **tidak ada di
  dokumen mana pun** — ditemukan dengan menebak URL lalu dibedakan dari route yang tak ada
  lewat bentuk pesan galatnya: `{"message":"Transaction not found","data":null}` (format
  API, route ADA) versus `{"message":"Not found"}` (route tak ada). Konsekuensinya kolom
  baru `orders.txn_id`, karena tanpanya order yang SUDAH DIBAYAR tak bisa diverifikasi.
- **`create-transaction` bersifat `find-or-create`, berkunci `order_id` SAJA.** Dibuktikan:
  `order_id` + body sama mengembalikan `txn_id` identik. Itu menguntungkan — percobaan ulang
  checkout tak menggandakan transaksi. Tetapi `order_id` sama dengan **amount BERBEDA**
  mengembalikan transaksi LAMA dengan HTTP 200 dan **mengabaikan amount baru diam-diam**.
- **Plafon 2 permintaan/detik itu nyata.** 429 benar-benar terjadi pada panggilan ketiga.

### Rencana dibantah sebelum kodenya ditulis

Empat penyerang dengan lensa berbeda (kehilangan uang · tenggat & yang tak terdokumentasi ·
kontrak kode · operasi) menyerang rencana migrasi: **46 keberatan, 15 memblokir**. Yang
terpenting mengubah arah:

**Handler webhook akan menolak SETIAP webhook v2, secara senyap dan permanen.** Skema lama
MEWAJIBKAN `project`; payload v2 tak mengirimnya. Bentuk tak dikenal dijawab **400**, dan
400 diperlakukan Pakasir sebagai final sehingga ia berhenti mencoba ulang. Jadi begitu
Pakasir beralih, tak satu pun undangan teraktivasi lewat jalur itu — dan `safeParse` yang
gagal tak memanggil `reportHandledError`, jadi tak ada yang tahu. Diperbaiki: skema menerima
**kedua versi** dan hanya mewajibkan dua field yang benar-benar dipakai (`order_id`,
`amount`), dan bentuk tak dikenal kini **503 + dilaporkan** — bentuk yang tak kita kenali
adalah kegagalan KITA, bukan payload cacat, dan 400 membuang satu-satunya percobaan ulang
gratis yang kita punya.

**Premis "webhook Pakasir TANPA signature" sudah kedaluwarsa.** Penyerang menyebut header
`X-Secret`; pembacaan pertama saya atas dokumen mengatakan tak ada verifikasi webhook —
saya salah, dan ada halaman `/p/webhook` terpisah yang belum saya baca. v2 mengirim
`X-Secret` yang nilainya dilihat/di-reset di bagian bawah halaman detail project. Premis itu
dikoreksi di SPEC §4.8 dan CLAUDE.md. **Kesimpulannya tidak berubah**: verifikasi otoritatif
tetap wajib, dan header itu ADITIF. `unset` sengaja TIDAK menolak — menolak akan mematikan
seluruh aktivasi pembayaran bila pemilik belum menyalin secret-nya saat deploy, kegagalan
yang jauh lebih mahal daripada webhook tak tersaring.

**Nominal yang benar-benar ditagih menjadi tak terverifikasi.** Respons `payment_link` hanya
`{txn_id, payment_link}` — tak ada nominal di dalamnya — sementara find-or-create akan
mengembalikan transaksi lama bila `order_id` pernah dipakai dengan nominal lain. Di v1
nominal tertulis di dalam URL sehingga mustahil berbeda; v2 menghapus jaminan itu. Diambil
kembali: `createPaymentLink` memanggil status SEGERA setelah membuat dan menolak bila
nominal atau gema `order_id` tak cocok. Tanpa itu, pelanggan membayar nominal lama lalu
aktivasinya ditolak `mismatch` — sudah membayar, tak mendapat apa pun.

**Verifikasi tidak boleh menjadi operasi TULIS.** Rencana awal memulihkan `txn_id` yang
hilang dengan memanggil `create-transaction` (elegan, karena find-or-create juga berfungsi
sebagai penerjemah `order_id` → `txn_id`). Ditolak: jalur verifikasi dipicu endpoint webhook
publik, jadi itu berarti pemanggil tak dikenal bisa menerbitkan link pembayaran hidup.
`txn_id` yang hilang kini galat yang dilaporkan.

### Yang ternyata sudah benar, dan tidak disentuh

`reconcile.ts` menolak aktivasi bila `verification.amountIdr !== order.amount_idr` — garis
pertahanan terakhir yang membuat jebakan find-or-create tak bisa menghasilkan aktivasi
salah. `checkout.ts` sengaja memakai nominal dari ORDER, bukan harga paket saat ini, yang
justru cocok dengan kunci find-or-create. Urutan "EXPIRE dulu via RPC, BARU batalkan" di
cron tetap aman. Dan `paymentMethod` yang menjadi `null` tidak memecahkan apa pun: kolomnya
nullable, dan v1 pun mengembalikan `""` untuk transaksi `payment_link`.

### Keputusan yang dicatat karena bisa dipersoalkan

`txnId` masuk ke kontrak `PaymentGateway`, dan peninjau benar bahwa "txn" adalah istilah
Pakasir pada abstraksi yang justru ada agar bisa pindah gateway. Nama netral
(`providerRef`) ditimbang dan **ditolak**: ketika jalur uang bermasalah, yang menelusuri
butuh nama kolom DB kita COCOK dengan nama di dashboard Pakasir dan di payload webhook-nya.
Nama netral membeli portabilitas hipotetis dengan harga kebingungan nyata di jalur yang
paling mahal bila salah dibaca.

`revoke all (txn_id) on orders` juga ditimbang, dibuat, **lalu dibuang** setelah diuji
terhadap skema cloud: baris itu TIDAK BEREFEK. `orders` memakai grant tabel-level (default
Supabase) dan Postgres tak bisa mencabut sebagian kolom dari grant setingkat tabel —
setelah revoke dijalankan, 8 privilege kolom masih tercatat. Membiarkannya berarti memasang
keamanan palsu. Yang menggerbangi kolom ini sama dengan seluruh kolom `orders` lain: RLS.

### Verifikasi

`orders.txn_id` + **unique partial index** (dua order tak boleh berbagi satu transaksi)
diuji 5/5 terhadap skema cloud dalam blok rollback, termasuk bahwa dua order TANPA `txn_id`
tetap boleh berdampingan. **67 test baru, 10 mutan 10 mati** — termasuk "`project`
diwajibkan lagi", "secret kosong jadi MENOLAK", "verifikasi nominal pasca-create dibuang",
"cek host `payment_link` dibuang" (open-redirect: URL itu datang dari body respons API lalu
dipakai mengarahkan browser pelanggan), dan "arahkan pelanggan walau `txn_id` gagal
tersimpan". 1520 test hijau.

Kedua spec E2E jalur uang diperbaiki: URL `pay-v2/{txn_id}` tak lagi memuat `order_id`
maupun nominal, jadi keduanya kini dibaca dari DB — sumber otoritatifnya, yang dulu pun
hanya kebetulan sama dengan URL.

**Yang masih harus ditanyakan pemilik ke Pakasir**, karena tak bisa dijawab dari kode:
apakah `transaction-status` dan `cancel-transaction` v2 endpoint RESMI yang didukung, dan
apakah `paymentsimulation` v1 ikut dimatikan. Verifikasi pembayaran bergantung pada yang
pertama. `?redirect=` pada `pay-v2` juga tak bisa dipastikan dari sini (halamannya dirender
di klien), jadi jalur poll dirancang tidak bergantung padanya.

---

## #73 — 2026-10-13 · Backstop di bawah 24 jam, dan membedakan "jaringan kedip" dari "kontrak putus"

Tiga keberatan peninjau yang belum tertutup di #72. Ketiganya tentang hal yang sama:
kegagalan di jalur uang yang **tidak terlihat oleh siapa pun**.

### Tak ada rekonsiliasi di bawah 24 jam — dan v2 menaikkan risikonya

`expire-orders` hanya menyentuh order berumur > 24 jam (`PENDING_MAX_AGE_MS`), berapa pun
kekerapan jadwalnya. Jadi bila webhook hilang DAN pelanggan menutup tab sebelum poller
selesai (±6 menit), order yang sudah dibayar menggantung **sehari penuh** tanpa satu pun
sinyal. Satu-satunya jalur cepat yang tersisa adalah halaman poll, yang harus dibuka
pelanggan sendiri.

Dua hal dari migrasi v2 menaikkan peluang itu dari teoretis menjadi nyata: bentuk payload
webhook **berubah**, dan `?redirect=` yang membawa pelanggan kembali ke halaman poll
**tak bisa diverifikasi dari luar browser** (halaman `pay-v2` dirender di klien, jadi
ketiadaan param di HTML server bukan bukti ia dihormati).

Diperbaiki sebagai **pass kedua di cron yang sudah ada**, bukan cron kelima. Alasannya
operasional: pemilik sudah punya empat perintah cron untuk disetel di Easypanel, dan setiap
job tambahan adalah satu lagi yang bisa salah kadens — yang menurut #69 akan membuat panel
admin menuduh job sehat. Pass muda mengambil order `pending` berumur **10 menit – 24 jam**
dan HANYA memverifikasi & mengaktifkan; ia tak pernah membatalkan apa pun, karena order
semuda itu belum tentu ditinggalkan — pelanggannya mungkin sedang di halaman bayar Pakasir
saat itu. Ambang 10 menit dipilih agar tidak bersaing dengan webhook (tiba dalam hitungan
detik) maupun poller pelanggan atas plafon 2 permintaan/detik yang sama.

**Satu anggaran panggilan Pakasir untuk seluruh jalan** (`PAKASIR_BUDGET = 60`), dan pass
muda memakainya lebih dulu: di sanalah ada pelanggan yang mungkin sudah membayar dan sedang
menunggu, sedangkan pass kedaluwarsa adalah pembersihan yang boleh menunggu jalan
berikutnya. Tanpa anggaran, satu jalan bisa menuntut 200 panggilan (2 per order × 100),
hampir semuanya dijawab 429 → transien → `skipped` → tak ada yang beres, dan jalan
berikutnya mengulang kegagalan yang sama. Itu livelock sementara panel admin tetap hijau
karena job-nya "berhasil". Yang kehabisan anggaran dilaporkan sebagai `budgetHabis`.

### `verify_error` menyatukan dua kegagalan yang menuntut tindakan berbeda

"Jaringan kedip / 429 / 5xx" sembuh sendiri; "kontrak API putus" (401, 400, 404, bentuk
respons tak dikenal, `txn_id` tak tersimpan) **tidak akan pernah** sembuh dengan diulang.
Menyatukannya membuat yang parah tenggelam di antara yang biasa — dan itu risiko konkret,
bukan hipotetis: `transaction-status` v2 **tidak terdokumentasi**, jadi bila Pakasir
mengubah atau menghapusnya, laporan inilah satu-satunya yang akan memberi tahu kita.

`PakasirError.transient` (dibuat di #72) kini dipakai untuk memilah, dan outcome baru
`verify_broken` muncul. Perhatikan apa yang TIDAK berubah: keduanya tetap dilaporkan —
`transient` memilah area laporan, bukan membungkam salah satunya. Galat yang bukan
`PakasirError` (DNS, abort timeout) diperlakukan **transien**, fail-safe ke arah yang benar:
memperlakukannya "putus" akan menghentikan poll untuk gangguan jaringan biasa.

Di jalur webhook, `verify_broken` tetap dijawab **503 dan bukan 200**, meski retry takkan
menolong. Sebabnya 200 bersifat final: pembayaran nyata yang di-ack tanpa aktivasi akan
HILANG. Lebih baik Pakasir mengulang dengan sia-sia daripada kita kehilangan satu
pembayaran; yang menyelesaikannya laporan `payment.verify.broken`, bukan kode HTTP-nya.

Di ketiga poller, `verify_broken` → `error`, bukan `pending`. `pending` akan membuat poller
berputar sampai batasnya (±6 menit) lalu menyerah tanpa penjelasan, padahal pelanggan
mungkin sudah membayar. `error` menghentikan poll dan memunculkan jalur bantuan — yang
memang satu-satunya jalan keluar untuk kontrak yang putus. TypeScript yang menemukan ketiga
titik ini: menambah satu anggota ke discriminated union membuat ketiga `switch` gagal
compile, yang persis gunanya.

### `mismatch` adalah jalan buntu yang senyap

Cek `verification.amountIdr !== order.amount_idr` adalah garis pertahanan terakhir terhadap
jebakan `find-or-create` Pakasir v2 (berkunci `order_id` saja, mengabaikan amount baru).
Aktivasi memang ditolak — tetapi penolakan itu **tidak dilaporkan ke mana pun**, padahal
artinya pelanggan kemungkinan SUDAH membayar nominal yang salah dan tak akan pernah
menerima layanannya. Satu-satunya jalan keluarnya manual: refund, atau aktivasi manual
admin. Kini dilaporkan sebagai `payment.mismatch` dengan KEDUA nominal di dalam pesan —
tanpa keduanya, yang membaca Sentry tak tahu apakah pelanggan membayar lebih atau kurang.

**Verifikasi:** 16 test baru, 5 mutan 5 mati — termasuk "semua galat jadi `verify_broken`"
(yang akan menghentikan poll untuk gangguan jaringan biasa), "`mismatch` tak dilaporkan lagi",
dan "area laporan putus & transien disatukan". 1536 test hijau.

**Konsekuensi:** statistik cron bertambah (`mudaScanned`, `mudaActivated`, `mudaPending`,
`budgetHabis`) dan semuanya hanya terbaca lewat SQL, karena `/admin` tak merender kolom
`stats` — keterbatasan yang sudah dicatat di #69 dan belum diperbaiki.

---

## #74 — 2026-10-13 · Angka cron akhirnya dirender, setelah dua kali dicatat sebagai titik buta

`recordCronRun` sudah lama menulis kolom `cron_runs.stats`, dan `fetchCronStatus` sudah lama
TIDAK membacanya. Akibatnya `notified`, `notifyTruncated`, `budgetHabis`, `tanpaTxn`,
`cancelFailed`, `warnFailed`, `heldForWarning`, dan `backstop` hanya bisa dilihat lewat SQL.

Yang membuat entri ini layak dicatat bukan ukurannya, melainkan riwayatnya: celah ini
dicatat **dua kali** sebagai titik buta — #69 ("panel `/admin` TIDAK menampilkan satu pun
angka email") dan #73 ("semuanya hanya terbaca lewat SQL, keterbatasan yang sudah dicatat
di #69 dan belum diperbaiki") — dan dua kali jawabannya adalah menyuruh pemilik menjalankan
query. Itu jawaban yang buruk untuk sesuatu yang bisa dirender, terutama karena angka-angka
itu dibuat justru supaya kegagalan senyap menjadi terlihat. Angka yang hanya bisa dibaca
lewat SQL oleh orang yang sudah curiga tidak menyelesaikan masalah "tak ada yang curiga".

### Dua keputusan bentuk

**`Record<string, number>`, bukan tipe per-job yang ketat.** Tiap job punya kunci sendiri
dan kuncinya bertambah setiap kali ada fitur baru — tiga kali dalam dua hari terakhir saja
(#67, #72, #73). Tipe ketat akan menuntut perubahan kode untuk setiap angka baru, dan angka
yang lupa didaftarkan akan **hilang dari panel**: justru kegagalan yang panel ini ada untuk
mencegah.

**Kunci tanpa label tampil apa adanya** (`statLabel[k] ?? k`). Label Indonesia disediakan
untuk 23 kunci yang ditulis keempat cron hari ini, tetapi fallback-nya bukan kelonggaran —
ia yang membuat panel tak membusuk. Statistik yang ditambahkan kelak langsung muncul tanpa
perubahan kode, hanya dengan nama mentahnya. Satu test menjaga bahwa label yang sudah ada
tak terhapus, dan satu lagi menolak label yang hanya menyalin nama kuncinya — "label" yang
sama dengan kuncinya terlihat seperti sudah dilabeli padahal tidak, yang lebih buruk
daripada tak dilabeli.

### Nol ditampilkan, dan itu disengaja

`activated: 0` BERMAKNA — ia berbeda dari "tak ada angkanya". Nol ditampilkan dengan opasitas
rendah, bukan dibuang. Sebaliknya hanya angka yang > 0 DAN termasuk `STAT_PERHATIAN`
(`*Failed`, `*Truncated`, `budgetHabis`, `tanpaTxn`, `backstop`, `*NoOwner`) yang ditandai
amber. Sisanya (`scanned`, `activated`, `notified`) justru sehat bila besar; menandainya
akan membuat panel tampak merah setiap hari sampai orang berhenti mempercayainya — kegagalan
yang sama yang membuat ambang "basi" di `status.ts` dipasang pada DUA kali jadwal, bukan satu.

### Penyaring yang tampak berlebihan tetapi tidak

`stats` bertipe `jsonb`, jadi isinya bisa apa pun. `angkaSaja()` membuang non-angka,
`NaN`, `Infinity`, array, string, dan `null` — tanpa itu, satu job yang kelak menulis objek
bersarang akan merender `[object Object]` ke halaman admin. Lima dari tujuh mutan di berkas
ini menyerang penyaring itu, dan semuanya mati.

**Verifikasi:** 11 test, 7 mutan 7 mati — termasuk "nol dibuang", "non-angka diteruskan",
"stats tak diambil dari DB sama sekali", "satu label dihapus", dan "label disalin dari
kuncinya". 1547 test hijau.

**Konsekuensi:** `docs/LAUNCH-CHECKLIST.md` dikoreksi di dua tempat yang menyuruh pemilik
membaca `stats` lewat SQL. Tak ada lagi angka cron yang hanya hidup di DB.

---

---

## #75 — 2026-10-13 · Identitas visual: mark "Gerbang", satu sumber logo, ikon tetap di luar `/[slug]`

**Keputusan:** Logo Merriva ditetapkan: **mark "Gerbang"** — dua lengkungan (huruf `m`
kecil) sebagai gerbang/pelaminan acara dengan **titik marigold** yang terbit di antaranya —
plus **wordmark** `merriva` (Bricolage Grotesque 700, opsz 64, huruf kecil, tittle `i`
marigold). Palet tetap token `.mrv` yang sudah ada (plum `#241f2b`, krem `#efe7da`,
kertas `#fbf9f6`, marigold `#c68a3c`). Master SVG hidup di `public/brand/` (README di sana =
aturan pakai); semua turunan — favicon/ICO, ikon PWA + `site.webmanifest`, `apple-icon`,
OG, `og-default.png`, banner hero, kit sosial, PNG email — di-generate `pnpm brand:assets`
(Chromium Playwright). Di kode, brand dirender `<MerrivaLogo/>` (SVG inline, huruf
di-outline, warna via `currentColor` + token `--mrv-logo-*`) di header/footer marketing,
panel auth, dan dashboard. OG marketing beralih dari `opengraph-image.tsx` (font bawaan
`next/og`) ke `opengraph-image.png` statis berfont merek.

**Alasan:** PRD §"terbuka" sejak awal mencantumkan identitas visual sebagai pekerjaan
rumah; ikon lama adalah monogram M darurat gelombang audit, OG memakai sans-serif generik,
email masih memakai rose dari iterasi merek sebelumnya. Lengkungan dipilih (dibanding M
amplop/segel dan penyempurnaan monogram) oleh pemilik dari tiga konsep karena paling
bercerita untuk pernikahan DAN tetap netral untuk korporat/keluarga. Huruf di-outline agar
logo tidak bergantung font termuat (WebView WhatsApp sering memakai fallback) dan identik di
SVG, PNG, email, dan komponen. Varian favicon bergoresan lebih tebal ditambahkan karena di
16 px titik dan tiang tengah menyatu pada gambar master.

**Ditolak:** `favicon.ico` di `public/` root dan ikon di `src/app/` root — keduanya
diwarisi/diminta otomatis oleh halaman undangan tamu, padahal "tanpa watermark Merriva"
dijual di Premium; ikon tetap per route group (5 salinan kecil, disengaja). Rasterisasi
dengan `sharp` di skrip — build-script-nya dimatikan di `pnpm-workspace.yaml` dan ia bukan
dependency langsung; Chromium Playwright sudah ada dan merender SVG persis seperti peramban.
Menyisipkan logo gambar ke templat email — templat itu murni (tanpa `appUrl`); PNG email
disediakan di `public/brand/png/`, pemasangannya keputusan terpisah bersama penyelarasan
warna email (masih rose `#b8446a`).

**Konsekuensi:** `copy.brand.name` tetap sumber nama (aria-label tautan brand); teks
"Merriva" di header tidak lagi berupa teks DOM — smoke test E2E yang mencari heading
"Merriva" karenanya gagal, dan tak ada yang tahu karena **E2E belum dijalankan di CI
sama sekali**; test itu diganti menjadi dua: judul hero (dari `copy`) dan nama aksesibel
tautan brand. Manifest memakai `display: "browser"` (hanya ikon + warna tema, tanpa prompt
instal PWA) — naikkan ke `standalone` bila dashboard kelak sengaja dijadikan PWA. Badge
"Dibuat dengan merriva" tersedia sebagai SVG; pemakaiannya di tema menunggu keputusan
kontrak props tema.

### Yang diperbaiki saat aset diperiksa ulang

Tiga hal lolos pada gelombang pertama, dan ketiganya **senyap** — tak ada yang gagal
mem-build:

1. **Metadata C2PA ikut tersaji.** Tiap master membawa manifest content-credentials
   (±8,5 KB base64 di SVG, chunk `caBX` 5,7 KB di PNG) dan skrip meneruskannya ke
   turunan: `icon.svg` yang diminta setiap pengunjung berisi 95% metadata (8.955 B untuk
   gambar ±400 B), dan `favicon-16x16.png` 93% metadata (6.197 B → **385 B** setelah
   dibuang). Skrip kini memanggil `stripMeta()` sebelum merender; **master dibiarkan
   utuh** — provenans berkas arsip itu sah, yang tidak sah adalah menyajikannya ke
   peramban. Efek sampingnya `og-default.png` justru ikut mengecil.
2. **Salinan logo di `handoff/brand/`.** Dua PNG di sana dirender dari ikon monogram "M"
   darurat sebelum logo resmi ada, dan tidak ikut berganti — nyaris terunggah ke layar
   consent Google sebagai logo resmi. Dihapus; `handoff/brand/` kini arsip konsep saja,
   dan kebutuhan pihak ketiga diarahkan ke aset yang di-generate. Pelajaran yang
   dijadikan test: **tiap salinan logo di luar satu sumber kebenaran akan membusuk.**
3. **`theme_color` manifest (plum) ≠ `viewport.themeColor` (kertas).** Mewarnai permukaan
   yang sama lewat dua jalur; disamakan ke kertas, mengikuti header.

**Ditambahkan:** `tests/unit/brand-assets.test.tsx` menjaga yang tak terlihat — batas
paket Premium (**tak ada ikon di `src/app/` root, `[slug]`, maupun `/public/favicon.ico`
dan `/public/apple-touch-icon.png`**, dua berkas terakhir karena peramban memintanya dari
ROOT domain untuk halaman tanpa `<link rel=icon>`), daftar route group di test sama persis
dengan yang ditulis skrip, ikon manifest ada dan seukuran klaimnya, turunan bebas chunk
metadata, dan **geometri `<MerrivaLogo/>` (path, tebal goresan, titik, radius, warna
cadangan token) identik dengan `public/brand/merriva-mark.svg`**. `handoff` dan
`prototypes` ditambahkan ke `.dockerignore`: ±90 MB konteks build yang stage `runner`
memang tak pernah salin.

---

## #76 — 2026-10-14 · Login Google gagal senyap di produksi: gerbang yang menolak memulai

**Kejadian.** Login Google di produksi berakhir di halaman depan tanpa sesi. Tak ada galat
di peramban, tak ada galat di server, tak ada entri di Sentry. Satu-satunya petunjuk
terlihat di bilah alamat: `merriva.id/?code=192629c1-…`.

**Sebab.** `NEXT_PUBLIC_APP_URL` tak diisi sebagai build-arg di Easypanel, jadi `appUrl`
jatuh ke default `http://localhost:3000` dan `redirect_to` yang dikirim ke Supabase
menunjuk localhost. GoTrue menolaknya (tak ada di allow list) lalu **mem-fallback ke Site
URL**, sehingga `?code=` mendarat di beranda alih-alih `/auth/callback`. Tak ada yang
menukarnya menjadi sesi.

Jejak di `auth_logs` memastikan setiap mata rantai lain SEHAT, dan ini penting karena
menghemat jam-jam mencari di tempat yang salah: `/authorize` → "Redirecting to external
provider" (google) → `/callback` 302 dengan `auth_event.action: user_signedup`, lalu dua
kali `login`. Barisnya di `auth.users` ada, `email_confirmed`, dan **trigger profil ikut
jalan** (`profiles.full_name = "Abdul M"`). Yang membuktikan penukaran kode tak pernah
terjadi: `last_sign_in_at` **tetap NULL** setelah tiga kali login — dengan PKCE, kolom itu
baru terisi saat `exchangeCodeForSession`. Google dan Supabase tidak salah apa pun.

**Yang membuat ini layak dicatat:** kegagalan ini SUDAH DIRAMALKAN, kata per kata, di
`LAUNCH-CHECKLIST.md` — *"kegagalannya paling senyap dari semua: … pengguna mendarat di
BERANDA dengan `?code=…` yang tak pernah ditukar → tetap tidak login, tanpa pesan galat,
tanpa jejak Sentry"* — dan tetap terjadi. **Dokumen yang meramalkan kegagalan tidak
mencegahnya.** Hanya sesuatu yang dieksekusi yang mencegah.

### Keputusan

`signInWithGoogleAction` BERHENTI sebelum memulai tarian OAuth bila
`appUrlMasihDefault() && NODE_ENV === "production"`: melapor ke `auth.oauth.config` (area
terpisah dari `auth.oauth`, yang berarti "Google/Supabase menolak") lalu redirect ke
`/masuk?error=config`.

Pesannya **berbeda** dari "Gagal masuk dengan Google. Silakan coba lagi." dengan sengaja.
Menyuruh mencoba lagi pada salah konfigurasi adalah saran yang keliru: berapa kali pun
dicoba hasilnya sama, dan pengguna berakhir menyalahkan akun Google-nya sendiri.

Predikatnya `!process.env.NEXT_PUBLIC_APP_URL`, **bukan** perbandingan host permintaan
dengan `appUrl`. Perbandingan host terdengar lebih pintar tetapi dibaca dari header `Host`
di belakang Cloudflare + Easypanel, dan satu false positive di sana **mematikan login
Google untuk semua orang**. Variabel yang tak pernah diisi adalah fakta, bukan tebakan.

### Ditolak

**Meneruskan `?code=` dari beranda ke `/auth/callback`** (middleware). Ia akan membuat
login berhasil MESKIPUN konfigurasinya salah — menyembunyikan persis hal yang baru saja
kita bayar mahal untuk temukan, dan menambah permukaan di batas auth demi kasus yang tak
boleh ada setelah konfigurasinya benar. Menangani `searchParams` di halaman beranda juga
ditolak: itu membuat halaman paling penting menjadi dinamis dan menggugurkan ISR-nya.

**Melempar galat saat `appUrl` default di produksi.** Build CI tidak menyetel
`NEXT_PUBLIC_APP_URL` (job `Build` hanya memberi dua variabel Supabase), jadi gerbang
build-time akan memerahkan CI untuk alasan yang salah.

**Konsekuensi:** `appUrlMasihDefault()` tersedia untuk pemakai `appUrl` lain yang sama
rapuhnya — hostname Turnstile, tautan email, `metadataBase` — bila kelak ingin dipagari
juga. 7 test, 11 mutan 11 mati.

---

## #77 — 2026-10-14 · `request.url` berbohong di mode standalone: redirect auth jadi relatif

**Kejadian.** Setelah `NEXT_PUBLIC_APP_URL` diperbaiki (#76), login Google berhasil —
kode ditukar, cookie sesi benar-benar tertulis — lalu peramban dikirim ke
**`https://0.0.0.0:3000/dashboard`** dan berhenti di ERR_ADDRESS_INVALID. Pengguna
menyimpulkan "login gagal" untuk login yang sebenarnya BERHASIL: tekan kembali, buka
`/dashboard` manual, sesinya ada.

**Sebab, diverifikasi di sumber `next@16.2.11` yang terpasang** (bukan dugaan dari gejala):

```js
// next/dist/server/next-server.js — attachRequestMeta
const protocol = req.headers['x-forwarded-proto']?.includes('https') ? 'https' : 'http';
const initUrl = this.fetchHostname && this.port
  ? `${protocol}://${this.fetchHostname}:${this.port}${req.url}`
  : this.nextConfig.experimental.trustHostHeader
    ? `https://${req.headers.host || 'localhost'}${req.url}` : req.url;
```

Header `Host` HANYA dibaca di cabang kedua, dan cabang itu mati karena `trustHostHeader`
tidak dinyalakan. `next.config.ts` memakai `output: "standalone"` dan Dockerfile stage
`runner` menyetel `HOSTNAME=0.0.0.0` + `PORT=3000`, jadi `fetchHostname` terisi dan cabang
pertama menang. `https`-nya datang dari `x-forwarded-proto` Cloudflare — itulah yang
membuat URL-nya tampak meyakinkan sambil tetap mustahil dibuka.

`/auth/callback` dan `/auth/confirm` sama-sama mengambil `origin` dari sana. Hanya
`searchParams`-nya yang sehat: path dan query tetap persis seperti yang dikirim peramban.

### Keputusan: `Location` RELATIF

`src/lib/relative-redirect.ts`. Peramban menyelesaikan `Location` relatif terhadap URL yang
IA minta, jadi tujuannya selalu benar tanpa bergantung pada konfigurasi apa pun — termasuk
bila `NEXT_PUBLIC_APP_URL` kelak salah lagi. Pola ini sudah hidup di repo:
`api/og/[slug]` menjawab `Location: /og-default.png` dan test-nya sudah menjaga itu.

Tiga detail yang bukan selera:

- **Cookie tetap ikut.** Ini pertanyaan terpenting — bila tidak, login akan tampak berhasil
  TANPA sesi, kegagalan yang lebih buruk daripada yang sedang diperbaiki. Diverifikasi di
  `next/dist/server/route-modules/app-route/module.js`: `appendMutableCookies` dipasang ke
  Response APA PUN yang handler kembalikan, bukan hanya ke hasil `NextResponse.redirect()`.
- **Persen-encoding wajib.** `NextResponse.redirect()` meng-encode diam-diam lewat
  `String(new URL(...))`; `Location` yang dirakit tangan tidak. `safeNextPath` meloloskan
  spasi (0x20 di atas ambang 0x1f) dan UTF-8, dan nilai header di luar Latin-1 tidak
  konforman serta bisa diperlakukan berbeda oleh Traefik maupun Cloudflare. Normalisasi
  lewat basis boneka `http://n` mengembalikan encoding itu — tanpa langkah ini perbaikan
  kasar hanya ditukar dengan cacat halus.
- **303, dan 301/308 TERLARANG.** Peramban men-cache 301/308 secara permanen; sekali
  `/auth/callback → /dashboard` ter-cache, setiap login berikutnya mati, termasuk jalur
  galatnya.

### Ditolak

**`NextResponse.redirect(new URL(next, appUrl))`.** Bekerja, tetapi memasang ulang
ketergantungan yang baru saja menggigit. Lebih spesifik: `/auth/confirm` dicapai lewat
`token_hash` dan TIDAK menuntut cookie PKCE, jadi ia bisa sah-sah saja diminta dari host
lain (tautan email disunting, proxy korporat, `www.` bila kelak di-DNS-kan) — dan di situ
obat ini melempar pengguna ke host yang tak memegang cookie yang baru saja ditulis.

**`experimental.trustHostHeader: true`.** Perbaikan satu baris yang menukar bug dengan
kerentanan: header `Host` dikendalikan klien, dan memercayainya membuat setiap URL turunan
origin — termasuk tautan reset sandi — bisa diarahkan penyerang. Next menggerbangi flag ini
justru karena itu.

### Yang ikut diperbaiki

`/auth/callback` dan `/auth/confirm` tidak punya SATU PUN `reportHandledError`, padahal
`signInWithGoogleAction` melaporkan sisi pemberangkatannya. Jadi separuh tarian OAuth yang
justru rusak adalah separuh yang tak terlihat: "verifier PKCE hilang" dan "kode kedaluwarsa"
tak bisa dibedakan dari "pengguna membatalkan". Kini keduanya melapor di area terpisah
(`auth.callback.exchange`, `auth.confirm.verify`); `token_hash` TIDAK pernah ikut — ia
kredensial sekali pakai — sedangkan `type` ikut karena ia memisahkan "verifikasi pendaftaran
gagal" dari "reset sandi gagal", dua masalah dengan obat berbeda.

**Verifikasi:** 15 test, 13 mutan 13 mati. Fixture permintaannya SENGAJA berhost
`0.0.0.0:3000`: dengan `localhost` setiap test lulus tanpa menguji apa pun, karena
`localhost` kebetulan host yang benar di mesin pengembang — persis cara bug ini lolos ke
produksi. Test `/auth/confirm` wajib menyebut `next` eksplisit, karena `safeNextPath` jatuh
ke `/dashboard` dan test tanpa `next` akan tetap hijau walau jalur reset sandi rusak lagi.

**Belum dikerjakan.** Sapuan empat lensa menemukan kandidat lain (tautan email tanpa gerbang
`appUrlMasihDefault()`, `appUrl` tanpa normalisasi garis miring, hostname Turnstile vs
apex/www, rantai `x-forwarded-for` di belakang Cloudflare+Traefik). Tiga dari empat
pemverifikasi berhenti di batas kuota sesi, jadi temuan itu BELUM dibantah dan sengaja
tidak dieksekusi di sini — mencatatnya sebagai "belum diverifikasi" lebih jujur daripada
memperbaiki sesuatu yang belum tentu rusak.

---

## #78 — 2026-10-14 · Tiga gerbang keamanan yang gagal senyap — dan satu yang ternyata tidak ada

Sapuan empat lensa setelah #77 (`request.url` berbohong) mencari segala keputusan yang
bergantung pada host atau topologi. Tiga temuan terverifikasi dan diperbaiki; satu
**terbantah oleh fakta lapangan**, dan itu dicatat di sini supaya tak "diperbaiki" kelak.

### 1. Gerbang hostname Turnstile membatalkan dirinya sendiri

`allowedTurnstileHosts()` memuat `"localhost"` dan `"127.0.0.1"` **tanpa syarat**,
sementara komentarnya sendiri menyatakan alasan gerbang itu ada: *"Site key bersifat publik
→ tanpa cek hostname, token yang di-solve dari origin pihak ketiga bisa lolos."* Kedua entri
itu justru PRA-MENYETUJUI sebuah origin pihak ketiga.

Serangannya tidak rumit: baca `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dari HTML (memang publik),
sajikan halaman di `http://localhost:8080` di mesin sendiri dengan site key itu, selesaikan
tantangan, kirim tokennya ke Server Action produksi. `siteverify` menjawab
`success: true, hostname: "localhost"` — dan daftar lama menerimanya. Hasilnya pembuatan
akun massal dan email-bombing lewat reset kata sandi.

Kini keduanya hanya ditambahkan di luar `NODE_ENV === "production"`. Fungsinya juga
di-`export` dan menerima `base` opsional supaya keempat cabangnya bisa diuji tanpa membangun
ulang modul demi satu variabel env — sebelumnya ia tak punya satu test pun.

### 2. Sinyal topologi IP hanya `console.warn` — jebakan yang SUDAH pernah ditemukan

`warnTopologyOnce` memancarkan dua kondisi yang komentarnya sendiri sebut *"seharusnya
TIDAK PERNAH muncul"*, lewat `console.warn` saja. Tidak ada `captureConsoleIntegration` di
ketiga `Sentry.init`, jadi kondisi itu memang tak akan pernah muncul **bagi siapa pun**.

Yang membuatnya pantas dicatat: jebakan ini **sudah pernah ditemukan dan didokumentasikan**
di `email.receipt` (`notify.ts`) — komentar lama di sana mengklaim "Sentry menangkap
console", klaim itu salah, dan justru klaim itulah yang membuat celahnya tampak tertutup.
Temuannya ditutup di satu tempat dan dibiarkan di tempat lain.

Taruhannya konkret: `cf-rejected` berarti `cf-connecting-ip` DIABAIKAN dan rate limit
memakai **IP edge Cloudflare**, sehingga semua tamu di balik edge itu berbagi satu bucket
/24. Di resepsi 300 tamu, RSVP dan buku ucapan menabrak plafon dalam hitungan detik — pada
hari yang tak bisa diulang. Pemicunya bisa sesederhana `cloudflare-ips.json` yang basi.

Kini dilaporkan ke `security.client-ip.topology`, **tanpa nilai IP** (UU PDP) — `source`
sudah cukup untuk tahu harus memperbaiki apa. `console.warn` dipertahankan karena ia
satu-satunya yang berfungsi sebelum DSN diisi; pola dua-tujuan yang sama dengan
`email.receipt`.

### 3. Cookie sesi Supabase tanpa `Secure`

`DEFAULT_COOKIE_OPTIONS` milik `@supabase/ssr` berisi
`{ path, sameSite: "lax", httpOnly: false, maxAge }` — **tanpa `secure`**. Dokumentasi
vendor tidak menyebutkannya; nilainya hanya terlihat dari kodenya, jadi tak ada yang akan
menemukannya dengan membaca dokumen (pola yang sudah jadi catatan tersendiri di proyek ini).

Tanpa `Secure`, satu-satunya penahan access + refresh token pemilik agar tak berjalan di
atas HTTP polos adalah HSTS — yang baru mengikat SETELAH satu respons HTTPS diterima dan
tidak selalu bertahan di WebView tertanam, jalur utama produk ini.

Ditambahkan `cookieOptions: { secure: NODE_ENV === "production" }` di **kedua** pemanggil.
Keduanya wajib: middleware menulis ulang cookie sesi pada tiap navigasi, jadi menambal satu
sisi saja akan ditimpa sisi lain pada request berikutnya — perbaikan yang terlihat selesai
padahal tidak. Aman ditambahkan sendirian: `cookieOptions` di-sebar DI ATAS default
(`{ ...DEFAULT_COOKIE_OPTIONS, ...cookieOptions }`, diverifikasi di `dist/main/cookies.js`),
jadi `path`/`sameSite`/`maxAge` tetap utuh. `httpOnly` sengaja TIDAK disentuh —
`lib/supabase/browser.ts` membaca cookie ini lewat `document.cookie`.

### Yang TERBANTAH: skenario apex vs `www`

Sapuan melaporkan bahwa `turnstile.ts` menerima varian `www` sementara semua nilai
turunan-host lain apex-only, sehingga pengguna yang datang lewat `www.merriva.id` akan
menulis cookie PKCE host-only di sana dan gagal login. Mekanismenya benar — cookie Supabase
memang host-only — tetapi premisnya tidak: **`www.merriva.id` tidak di-resolve sama sekali**
(diperiksa langsung: apex 200, `www` gagal koneksi). Tidak ada yang bisa tiba di sana.

Jadi tidak ada perubahan kode untuk ini. Ia menjadi catatan OPS: **bila kelak record `www`
ditambahkan** (default yang sangat umum di Cloudflare), pasang Redirect Rule
`www.merriva.id/*` → `https://merriva.id/$1` **pada saat yang sama** — tanpa itu, celahnya
baru lahir. Memasang pagar middleware sekarang berarti menjaga pintu yang belum ada.

### Kebisingan juga diputuskan, bukan dibiarkan

`verifyTurnstile` melaporkan kegagalan `siteverify` **hanya** untuk kelas salah-pasang
(`missing-input-secret`, `invalid-input-secret`, `bad-request`, `internal-error`). Penolakan
bot adalah kerja normal yang terjadi terus-menerus; melaporkannya akan membanjiri Sentry
sampai orang berhenti membacanya — dan saat itulah yang penting ikut tak terbaca. Ambang
yang sama sudah dipakai `STAT_PERHATIAN` di panel admin (#74).

**Verifikasi:** 21 test di dua berkas, 17 mutan 17 mati — termasuk "localhost kembali
diterima tanpa syarat", "IP mentah ikut ke laporan", "dedup hilang", "SEMUA penolakan
dilaporkan", "`cookieOptions` dihapus di sisi middleware saja", dan "`httpOnly` ikut
disetel". Test PDP memeriksa SELURUH panggilan laporan, bukan hanya yang pertama: laporan
kedua yang kelak ditambahkan dengan niat baik adalah persis cara IP mentah akan masuk ke
Sentry tanpa ada yang menyadarinya.

**Belum dikerjakan.** Sepuluh kandidat lain dari sapuan (tautan email tanpa gerbang
`appUrlMasihDefault()`, `appUrl` tanpa normalisasi garis miring, cache-busting OG, ICS)
belum dibantah — tiga dari empat pemverifikasi berhenti di batas kuota sesi.

---

## #79 — 2026-10-14 · "Gunakan tema ini" membuang temanya

**Kejadian.** Pengguna membuka `/preview/tema/eternal-rose`, menekan **Gunakan tema ini**,
dan mendarat di `/dashboard` — dasbor kosong, tanpa penjelasan, setelah menyatakan dengan
sangat jelas tema apa yang ia mau.

**Sebab.** Tombol itu menunjuk `/daftar` begitu saja (`theme-showcase.tsx`), dan `/daftar`
memantulkan pengguna yang sudah login ke `/dashboard`. Temanya tidak pernah ikut ke mana
pun. Kartu di katalog `/tema` (`theme-poster.tsx`) punya cacat yang sama persis.

Tak ada yang gagal: tautannya sah, redirect-nya sah. Yang hilang hanya niat pengguna —
dan itu tidak pernah muncul di log mana pun.

**Yang membuatnya pantas dicatat:** jalur sesudahnya sudah benar sejak lama.
`createInvitationAction` memang mengakhiri dengan `redirect('/dashboard/undangan/{id}/edit')`
— tujuan yang diharapkan pengguna. Fiturnya tidak kurang; hanya satu `href` yang memutus
rantainya di awal.

### Keputusan

Temanya dibawa lewat `?tema={slug}` ke `/dashboard/undangan/baru`, dan kontraknya hidup di
satu modul (`src/lib/theme-cta.ts`): nama parameter, pembuat tautan, saringan bentuk, dan
pencocokan katalog. Tiga berkas memakainya — dua penaut dan satu pembaca — dan nama
parameter yang salah ketik di salah satunya **tidak menimbulkan galat apa pun**, ia hanya
diam-diam kembali membuang pilihan pengguna. Kegagalan yang sama, hanya lebih sulit dilihat;
karena itu kontraknya tidak boleh ditulis manual di tiga tempat.

Dua lapis pemeriksaan, dan keduanya perlu:

- **Bentuk** (`themeFromParam`): hanya `[a-z0-9-]{1,64}`. Nilainya berasal dari bilah alamat
  dan diputar ULANG ke dalam `?next=` saat pengunjung diminta masuk, jadi ia harus dibatasi
  sebelum disambung.
- **Keberadaan** (`preselectFromCatalog`): dicocokkan dengan katalog AKTIF. Slug yang rapi
  tetapi sudah dinonaktifkan lolos saringan bentuk, dan meneruskannya menghasilkan form
  dengan **pilihan hantu**: `themeSlug` terisi tema yang tak ada di daftar, tombol lanjut
  gagal validasi, dan tak satu pun kartu tampak terpilih.

`category` ikut dikembalikan, bukan dibiarkan pada bawaan `wedding`: pemilih tema di form
DISARING oleh kategori, jadi tema korporat/keluarga yang terpilih akan lenyap dari daftar.
`wedding` diutamakan bila tema mendukung keduanya supaya kasus terbanyak tidak berpindah
tab tanpa alasan.

### Rantai `next` ikut disambung

`requireUser()` dulu selalu `redirect("/masuk")` tanpa tujuan — jadi bahkan setelah tautannya
benar, pengunjung yang belum login (yaitu SASARAN UTAMA tombol ini) tetap mendarat di dasbor
kosong. Kini `requireUser(next?)`, dan dua tautan yang memutus rantai di tengah ikut
diperbaiki: `/masuk` → `/daftar` dan `/daftar` → `/masuk` sama-sama meneruskan `next`, serta
`/daftar` memakai `safeNextPath(next)` untuk pengguna yang ternyata sudah login.

**Diketahui belum tertutup:** pendaftaran lewat EMAIL berakhir di "cek email Anda" tanpa
redirect, dan tautan konfirmasinya dibangun dari `emailRedirectTo: ${appUrl}/auth/confirm`
yang tidak membawa `next`. Jadi pendaftar email tetap kehilangan temanya; pendaftar Google
tidak, karena `signInWithGoogleAction` membaca `next` dari form. Menutupnya berarti
menyuntikkan `next` per-pendaftaran ke `emailRedirectTo` — perubahan tersendiri, bukan
tempelan di sini.

**Verifikasi:** 23 test, 14 mutan 14 mati — termasuk "showcase kembali menunjuk `/daftar`",
"showcase memakai slug tema lain", "nama parameter berubah hanya di penaut", "preselect tak
mencocokkan katalog", "form mengabaikan kategori", dan "`requireUser` membuang tujuan".

---

## #80 — 2026-10-14 · Tujuan yang bertahan melintasi konfirmasi email

Menutup celah yang dicatat terbuka di #79: pendaftar lewat EMAIL kehilangan tema yang baru
saja ia pilih, karena pendaftaran berakhir di layar "cek email Anda" tanpa redirect.

### Temuan yang mengubah rancangannya

Rencana awal — selipkan `next` ke `emailRedirectTo` — **tidak akan sampai ke mana pun.**
Tautan di email tidak dibangun oleh kode ini. Ia dibangun templat di dasbor Supabase, dan
templat yang dipakai proyek ini (`docs/AUTH-SETUP.md` §2) memakai `{{ .SiteURL }}`:

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
```

`emailRedirectTo` karena itu hanya divalidasi GoTrue terhadap daftar izin Redirect URL; ia
tidak pernah muncul di peramban. Kode di `signUpAction` tampak mengendalikan tautan itu
padahal tidak — komentar ditambahkan di sana supaya pembaca berikutnya tak mengulang
kesimpulan yang sama.

### Keputusan: dititipkan lewat cookie, bukan lewat tautan

`src/lib/auth/after-confirm.ts`. `signUpAction` menitipkan tujuan ke cookie
`mrv_after_confirm` (path `/auth`, 2 jam, `httpOnly`, `sameSite=lax`, `secure` di produksi);
`/auth/confirm` mengambilnya sekali lalu membuangnya.

`sameSite=lax`, bukan `strict`: tautan email adalah navigasi tingkat-atas dari konteks luar,
dan `strict` justru menahan cookie pada satu-satunya permintaan yang membutuhkannya.

Empat sifat yang bukan selera:

- **`next` di URL MENANG atas cookie.** Templat reset kata sandi menuliskan tujuannya
  sendiri (`next=/reset-password/ubah`). Bila cookie menang, titipan dari pendaftaran lain
  bisa membajak sesi recovery yang berumur pendek — pengguna tak pernah sampai ke form ganti
  kata sandi, dan tautannya sudah hangus.
- **Disanitasi ULANG saat dibaca.** Nilainya datang kembali dari peramban; "kita sendiri
  yang menulisnya" bukan jaminan apa pun.
- **Tidak hangus bila verifikasi gagal.** Tautan kedaluwarsa itu lumrah; menghanguskan niat
  pengguna pada percobaan pertama membuat percobaan berikutnya mendarat di tempat yang salah.
- **Dititipkan juga untuk email yang SUDAH terdaftar.** Keduanya menjawab hal yang sama ke
  pengguna demi anti-enumerasi, jadi keduanya harus BERPERILAKU sama — cookie yang hanya
  muncul pada email baru adalah pembeda yang bisa diamati dari luar.

### Keterbatasan yang disengaja

Cookie hanya ada di peramban tempat pendaftaran dimulai. Mendaftar di laptop lalu membuka
email di ponsel → tujuannya hilang dan pengguna mendarat di `/dashboard`, persis seperti
sebelum perubahan ini. Ini peningkatan untuk kasus yang bisa ditingkatkan, bukan jaminan;
pemulihannya pun wajar, temanya tinggal dipilih lagi di form buat-undangan.

### Ditolak

**Mengubah templat email** agar memakai `{{ .RedirectTo }}` atau `{{ .Data.next }}`. Itu
menggantungkan fitur produk pada satu kolom teks di dasbor yang **tak terjangkau test mana
pun**, menuntut daftar izin Redirect URL menerima query string (perilaku yang tak
terdokumentasi), dan `{{ .RedirectTo }}` yang kosong akan merusak seluruh tautan — menukar
"tema hilang" dengan "akun tak bisa diaktifkan".

**Catatan penting untuk pengujian:** jalur daftar-email **belum pernah sekali pun berhasil di
produksi** — `auth.users` hanya berisi satu akun Google dan satu admin buatan manual. Jadi
rantai ini hijau di test tetapi BELUM terbukti ujung-ke-ujung; membuktikannya menuntut
Custom SMTP aktif dan satu pendaftaran sungguhan (LAUNCH-CHECKLIST Fase 4).

**Verifikasi:** 20 test, 11 mutan 11 mati — termasuk "cookie mengalahkan `next` di URL",
"titipan hangus walau verifikasi gagal", "tanpa sanitasi ulang", dan "`next` tak dikirim
form". Mutan terakhir itu LOLOS pada putaran pertama: `signUpAction` diuji dengan FormData
buatan sendiri yang selalu memuat `next`, sedangkan form sungguhan boleh jadi tidak — lubang
yang hanya terlihat karena mutannya dijalankan.

---

## #81 — 2026-10-14 · Templat email bawaan: akun aktif, pengguna diberi tahu sebaliknya

**Kejadian.** Pendaftaran email pertama yang berhasil di produksi. Email terkirim,
pengguna mengklik tautannya, dan melihat **"Tautan tidak valid atau sudah kedaluwarsa.
Silakan minta ulang."** Padahal akunnya sudah aktif, dan tautan baru mustahil menolong —
tokennya sudah terpakai.

**Bukti (diperiksa langsung, bukan disimpulkan dari tampilan):**

| Sumber | Nilai |
|---|---|
| `auth.users` | `email_confirmed_at = 08:56:02`, `last_sign_in_at = NULL` |
| `auth_logs` 08:56:02 | **`GET /verify` → 303**, `action: user_signedup` |
| `auth.flow_state` | `authentication_method = "email/signup"`, baris MASIH ADA |
| | `created_at 08:44:16.636` → `auth_code_issued_at 08:56:02.545` = **705,9 detik** |

`GET /verify` adalah endpoint `{{ .ConfirmationURL }}`. Templat kustom `{{ .TokenHash }}`
(AUTH-SETUP §2) akan menghasilkan **`POST /verify`** — panggilan `verifyOtp` dari server
kita. Jadi templat di dasbor **masih bawaan**: GoTrue memverifikasi di sisinya sendiri,
lalu melempar `?code=` (PKCE) ke `/auth/confirm`, yang hanya mengenali `token_hash`.

### Rencana yang HAMPIR dipasang, dan kenapa dibatalkan

Rencana awal: terima juga `code` di `/auth/confirm` dan tukar dengan
`exchangeCodeForSession` — "dukung kedua bentuk tautan". Tinjauan adversarial membatalkan
premisnya dengan dua keberatan, keduanya cocok dengan data produksi di atas:

1. **Reset kata sandi akan ikut MATI.** Pada penukaran PKCE, `amr` diisi dari
   `flow_state.authentication_method` — `"recovery"` / `"email/signup"` / `"oauth"` —
   **bukan** `"otp"` seperti pada `verifyOtp`. `isFreshEmailGrant`
   (`src/lib/auth/email-grant.ts:46`) menolak apa pun selain `"otp"`, jadi pengguna akan
   mendarat di `/reset-password/ubah` **dalam keadaan sudah login**, mengisi kata sandi
   baru, lalu ditolak "Tautan atur ulang sudah kedaluwarsa" — selamanya, karena setiap
   tautan baru menghasilkan `amr` yang sama. Dan tak ada satu test pun yang akan merah:
   `tests/unit/lib/email-grant.test.ts` justru MENEGASKAN penolakan itu. Hari ini yang
   rusak hanya konfirmasi pendaftaran; rencana itu akan menambah regresi.
   Ironinya terbalik dari catatan #51: di sana memakai `"recovery"` akan mengunci semua
   orang — pada jalur PKCE, MENOLAK `"recovery"`-lah yang mengunci semua orang.
2. **Ia tak akan menyembuhkan kasus yang dilaporkan.** `flow_state` PKCE kedaluwarsa
   **300 detik sejak DIBUAT** (yaitu sejak menekan "Daftar"), bukan sejak tautan diklik.
   Jedanya di insiden ini 705,9 detik. Pengguna nyata membaca email beberapa menit
   kemudian, jadi mayoritas tetap gagal — sambil tokennya sudah hangus.

Yang saya verifikasi sendiri: baris `email-grant.ts:46`, isi `auth.flow_state`,
`auth_logs`, dan `auth.users` di atas. Nilai `amr` hasil penukaran PKCE dan angka 300
detik berasal dari reproduksi lokal + pembacaan sumber GoTrue oleh peninjau; keduanya
konsisten dengan data produksi (baris `flow_state` memang menyimpan
`authentication_method`, dan baris itu masih ada ⇒ kodenya tak pernah ditukar).

### Keputusan

**Kodenya TIDAK ditukar.** `/auth/confirm` mengenali `code`, melapor ke
`auth.confirm.default-template`, lalu **berkata jujur**:

- tautan pendaftaran → `/masuk?error=aktif`: *"Akun Anda sudah aktif. Silakan masuk
  dengan email dan kata sandi Anda."* Itu bukan penghalusan — akunnya memang aktif, dan
  pengguna punya kata sandi yang baru saja ia buat;
- tautan reset (dikenali dari `next=/reset-password/ubah`) → `/masuk?error=email-config`.
  Di jalur ini tak ada kabar baik yang bisa disampaikan, dan "coba lagi" adalah saran
  yang akan menghasilkan hasil yang sama persis.

**Obatnya tetap satu: ganti templatnya.** `verifyOtp` tak menyentuh `flow_state` sama
sekali — umurnya diatur `otp_expiry`, bukan 300 detik — dan ia bekerja lintas-peramban
(daftar di laptop, buka email di ponsel). AUTH-SETUP §2 dan LAUNCH-CHECKLIST kini memuat
peringatan bahwa langkah ini SUDAH pernah terlewat, plus **verifikasi 1 menit**: klik satu
tautan uji lalu lihat Logs → Auth — `POST /verify` berarti templat kustom aktif,
`GET /verify` berarti masih bawaan.

**Bila kelak templat bawaan memang ingin didukung**, keduanya harus dikerjakan DALAM SATU
commit: menerima `code` DAN meluaskan `isFreshEmailGrant` ke
`{ "otp", "recovery", "email/signup" }` (cek timestamp + ambang 30 menit + penolakan
timestamp masa depan tetap berlaku untuk semuanya). Mengerjakan separuhnya akan mematikan
pemulihan kata sandi tanpa satu pun test memerah.

**Verifikasi:** 26 test, 17 mutan 17 mati — termasuk "cabang `code` dihapus", "reset tak
dibedakan", "SEMUA dianggap reset", dan "pesan 'akun aktif' disalin dari pesan lama".
Mutan terakhir itu penting: inti perbaikan ini ada pada KATA-KATANYA, dan menyalin pesan
lama ke kode galat baru akan lolos setiap pemeriksaan struktural sambil tetap menyuruh
pengguna mencari tautan yang sudah terpakai.

---

## #82 — 2026-10-14 · Storage media pindah ke disk VPS (driver `local`) sebagai jembatan ke R2

**Pemicu yang dilaporkan.** "Unggah foto error." Yang sebenarnya terjadi berbeda
dan lebih sempit: unggahnya **berhasil**.

| Bukti | Nilai |
|---|---|
| `storage.objects` | `inv/85d261d6-…/3bca4756-…/{400,1600}.webp` ADA, 10:34:18 |
| `public.media` | 1 baris — RPC `insert_gallery_media` juga sukses |
| Log container | `Error: NEXT_PUBLIC_MEDIA_URL belum di-set` ×2 |
| `docker inspect` | `NEXT_PUBLIC_MEDIA_URL=` **kosong**, `STORAGE_DRIVER=supabase` |

Jadi yang rusak adalah RENDER sesudahnya: `/dashboard/undangan/<id>/edit`
memanggil `storage.getPublicUrl()` untuk setiap baris `media`, dan
`getMediaBaseUrl()` sengaja gagal-keras di runtime produksi bila basisnya
kosong. Selama galeri masih kosong, halaman itu hidup; foto pertama yang
terunggah membunuhnya. Gerbangnya bekerja persis seperti yang dirancang —
yang belum ada adalah hostnya.

**Keputusan pemilik:** sementara ini media disimpan di VPS sendiri, bukan
menunggu R2. Maka ada driver ketiga.

### Bentuknya

`STORAGE_DRIVER=local` + `NEXT_PUBLIC_MEDIA_URL=https://merriva.id/media`.
Berkas ditulis ke `MEDIA_ROOT` (default `data/media`, relatif cwd → `/app/data/media`
di container) dan disajikan route **`/media/[...path]`** dari domain sendiri —
jadi aturan §6.4 "jangan pernah serve media dari URL vendor" tetap utuh dan
pindah ke R2 nanti tetap berarti "ganti env", bukan ganti kode.

Yang dipilih dengan sadar:

- **Disajikan app Next, bukan subdomain/nginx terpisah.** Tanpa DNS dan
  sertifikat baru. Nama objek immutable (UUID/hash) → `max-age=31536000,
  immutable`, Cloudflare yang menanggung hari-H dan origin hanya tersentuh
  sekali per objek.
- **Berkas dibaca utuh ke memori, bukan di-stream.** Objeknya ratusan KB sampai
  ±3MB dan sudah dibatasi di sisi unggah; yang dibeli adalah penanganan `Range`
  yang sederhana. Bila kelak ada video, ini yang pertama diganti.
- **`Range` tetap diimplementasikan** (206/416). Tanpanya menggeser posisi lagu
  tak berfungsi dan Safari/iOS bisa menolak memutar audio sama sekali.
- **Tulis-ke-sementara lalu `rename`.** Tamu yang meminta objek saat unggah
  berjalan mendapat 404 atau berkas utuh, tak pernah foto separuh — dan karena
  header cache-nya `immutable`, foto separuh akan tersimpan di Cloudflare sampai
  undangannya kedaluwarsa.
- **Daftar-putih dua lapis di `lib/storage/local-path.ts`**, dipakai bersama oleh
  driver dan route penyaji supaya aturannya tak bisa bercabang: segmen path
  hanya `[A-Za-z0-9._-]` **dan** `.`/`..` ditolak terpisah (titik wajib sah —
  nama berkas punya ekstensi — jadi regex sendirian tidak menahan traversal);
  ekstensi di luar daftar dijawab 404 walau berkasnya ada. Ini route tanpa
  autentikasi yang membaca filesystem; tamu undangan memang harus bisa
  membukanya tanpa akun.
- **Route menjawab 404 bila driver aktif bukan `local`**, supaya ia tak
  menganggur sebagai pembaca berkas di produksi yang memakai R2.

### `STORAGE_DRIVER` yang salah ketik kini GAGAL-KERAS

Pola lama `name === "r2" ? R2 : Supabase` membuat `lokal`, `Local`, atau sisa
spasi diam-diam berarti Supabase. Dengan dua driver itu kosmetik; dengan tiga ia
berbahaya: foto ditulis ke satu tempat sementara `NEXT_PUBLIC_MEDIA_URL`
menunjuk tempat lain, dan yang terlihat hanyalah foto 404 tanpa sebab.
`getStorageDriver()` sekarang melempar dan menyebut nilai yang salah.

### Harga yang diterima

Satu disk, tanpa replikasi, tanpa backup bawaan — **dan sebuah jebakan senyap**:
bila `MEDIA_ROOT` tidak ditimpa volume yang di-mount, unggah tetap "berhasil" ke
lapisan container yang dibuang setiap deploy, lalu seluruh foto klien hilang
pada rebuild berikutnya tanpa satu pun galat. Tak ada cara yang jujur untuk
mendeteksi itu dari dalam app (direktori yang ter-mount dan yang tidak sama saja
bagi `fs`), jadi yang menjaganya adalah LAUNCH-CHECKLIST, DEPLOYMENT, dan
komentar di Dockerfile — plus verifikasi nyata saat cutover: tulis berkas,
redeploy, baca lagi.

Juga sah hanya selama app berjalan **satu replika**. Dua replika = foto yang
diunggah ke replika A tak terlihat dari replika B.

**Konsekuensi yang menyenangkan:** alasan Album Momen dinonaktifkan
(LAUNCH-CHECKLIST Fase 4: Supabase free 1 GB ≈ 7 album penuh) tak lagi mengikat
di disk 125 GB. Mengaktifkannya kembali tetap keputusan pemilik — itu struktur
paket, bukan infrastruktur.

**Verifikasi:** 76 test baru (daftar-putih path, parse `Range`, driver, route),
dan di produksi: unggah → redeploy → objek masih terbaca.

---

## #83 — 2026-10-14 · Foto bernama: tombolnya tak pernah ada, dan membuatnya membuka lubang retensi

**Yang dilaporkan.** "Tidak ada tombol untuk upload foto mempelai pria dan wanita."

Benar, dan separuh fiturnya ternyata sudah terpasang sejak lama:

| Lapisan | Status sebelum ini |
|---|---|
| SPEC §4.4 langkah 2 | menuntutnya: *"Mempelai pria & wanita + nama orang tua, urutan anak, **foto masing-masing**"* (corporate: *"logo perusahaan"*) |
| Skema | ADA — `photo` pada person, `coverPhoto`, `logo` (`storagePathSchema`) |
| Server | ADA — `groomPhotoUrl`/`bridePhotoUrl`/`coverPhotoUrl` di `invitation-data.ts` |
| Tema | ADA — dirender, dengan fallback monogram inisial bila kosong |
| **Editor** | **tidak ada** — `CoupleStep` merender empat isian teks dan berhenti |

Jadi kolomnya mustahil terisi, dan setiap undangan selamanya memakai monogram.
Yang terlihat seperti "fitur belum jadi" sebenarnya "fitur jadi, pintunya tak
pernah dipasang".

### Yang ditemukan sebelum menulis satu baris UI

`purge_invitation_data` mengumpulkan objek untuk dihapus HANYA dari tabel
`media` dan `momen_photos`. Foto bernama tak punya baris tabel — pathnya hidup
di dalam `invitations.content`. Dan beberapa baris di bawahnya, fungsi yang
sama menimpa `content` menjadi `'{}'`.

Urutannya, kalau tombolnya dipasang begitu saja: satu-satunya rujukan ke objek
itu DIHAPUS, objeknya TIDAK. Foto wajah mempelai tertinggal di storage
selamanya, tak ada baris mana pun yang menunjuknya, dan cron melaporkan
`purged` dengan jujur. Tak ada yang terlihat salah dari luar — dan itulah
bentuk kegagalan yang paling buruk untuk kewajiban UU PDP 27/2022 yang
dijanjikan `/privasi`.

Belum pernah menggigit justru KARENA tombolnya tak ada. Menambahkan tombol
tanpa menambal ini akan mengubah cacat laten menjadi cacat nyata pada klien
berbayar pertama.

**Migrasi `20261014120000` mendahului tombolnya, bukan menyusulnya.** Panennya
diletakkan SEBELUM scrub, dan ikut `media_paths` — bukan kolom kembalian baru —
karena foto bernama memakai bentuk objek yang sama persis dengan galeri: satu
prefix berisi `1600.webp` + `400.webp`. Pemanggil sudah meng-expand tiap entri
lewat `mediaObjectPaths`, jadi tak ada `drop function`, tak ada perubahan tipe
kembalian, tak ada perubahan TypeScript. `admin_delete_account` ikut sembuh
tanpa disentuh: ia mengakumulasi `media_paths` dari fungsi ini.

### Keputusan desain yang tidak kelihatan dari luar

- **Aksi unggah TIDAK menyentuh database.** `content` dimiliki autosave editor
  yang mengirim SELURUH objeknya tiap beberapa detik. Bila aksi ikut menulis,
  autosave berikutnya — yang form-nya belum tahu ada foto baru — menimpanya
  kembali jadi kosong, dan fotonya "hilang" tanpa satu pun galat. Jadi aksi
  menaruh objek lalu mengembalikan PATH; form yang memegangnya, autosave yang
  menyimpannya. Harganya: objek yatim bila tab ditutup sebelum autosave —
  tak berbahaya dan tak tertebak, sama seperti yatim pada galeri.
- **Setiap unggah menghasilkan UUID BARU, bukan nama tetap per jenis.** Media
  disajikan `max-age=31536000, immutable`; menimpa path yang sama berarti
  Cloudflare dan peramban tamu menyajikan foto LAMA sampai undangannya
  kedaluwarsa. Mengganti foto = path baru + objek lama dihapus.
- **Yang disimpan PREFIX, bukan path objek.** Inilah yang membuat jalur purge di
  atas bekerja. `invitation-data.ts` karena itu diubah memakai `displayPath(p)`;
  sebelumnya ia memperlakukan nilai `content` sebagai path objek penuh — kontrak
  yang tak pernah teruji karena tak pernah ada datanya.
- **Dua varian dipakai di dua tempat berbeda:** tema menerima `1600.webp` (foto
  mempelai ada di bawah lipatan, tak memengaruhi LCP, dan wajah yang pecah lebih
  mahal daripada byte-nya), editor memakai `400.webp` untuk kotak pratinjau 80px
  — pemilik sering mengedit dari HP.
- **Penghapusan dipagari bentuk path penuh** (`isNamedPhotoPath`), bukan
  `startsWith`. Path datang dari klien dan storage tak mengenal kepemilikan:
  tanpa pencocokan penuh terhadap `invitationId` pemanggil, pemilik undangan
  sendiri bisa mengirim path undangan ORANG LAIN dan menghapus fotonya.

### Yang TIDAK ikut dikerjakan

`/api/og` masih tak memakai `coverPhoto` sama sekali, jadi janji SPEC §4.5
("OG image … nama + tanggal di atas foto cover") tetap belum terpenuhi. Kini
fotonya sudah bisa diisi; menyambungkannya ke OG adalah pekerjaan terpisah.

**Verifikasi:** 1822 unit test hijau, 22 mutan 22 mati — termasuk "gerbang hapus
memakai startsWith", "photoId tetap", "URL yang masuk ke form bukan path", dan
"tema diberi prefix, bukan varian display". Sisi SQL dijaga pgTAP
`purge_named_photos.test.sql` (job `db` di CI menjalankan migrasi pada Postgres
bersih lalu mengujinya); ekspresi panennya juga diperiksa langsung di DB
produksi terhadap enam bentuk `content`, termasuk `content` yang bukan objek.

---

## #84 — 2026-10-14 · Penyesuaian foto mempelai: dipanggang saat unggah, tema tak tersentuh

Foto mempelai pertama yang diunggah langsung memperlihatkan masalahnya: wadah di
tema berbentuk POTRET, sedangkan foto yang dipilih pemilik jarang berbentuk itu
— `object-fit: cover` lalu memotong seenaknya, dan wajahnya bisa tergeser keluar.

Ada dua tempat penyesuaian itu bisa hidup.

| | Dipanggang saat unggah | Non-destruktif (fokus + zoom disimpan) |
|---|---|---|
| Kontrak props tema | tak berubah | **berubah** (TANYA DULU, CLAUDE.md) |
| Berkas tema | 0 | 6 `sections.tsx` + tipe |
| Ketepatan per tema | ±7% | tepat |
| Ubah lagi kemudian | unggah ulang | kapan saja |

**Pemilik memilih yang dipanggang** (14 Okt 2026) — dan ukuran "±7%" itu bukan
tebakan: keenam tema yang merender foto mempelai memakai wadah potret yang
rapat.

| tema | tinggi / lebar |
|---|---|
| meridian, noir | 1,25 (4:5) |
| kirana | 1,24 |
| verdant | 1,267 |
| eternal-rose | 1,333 (3:4) |
| barakah | 1,35 |

Pangkasan dibuat **4:5 (1,25)** — yang PALING LEBAR di antaranya. Akibatnya tema
hanya memangkas sedikit di SISI dan tak pernah memotong atas-bawah, tempat wajah
berada. Terburuk (barakah) kehilangan ±7% lebar.

### Yang dipilih dengan sadar

- **Keadaan disimpan sebagai `zoom` + titik tengah ternormalisasi**, bukan kotak
  piksel. Titik tengah tetap berarti sama ketika zoom berubah, jadi memperbesar
  tak menggeser wajah keluar bingkai — cacat paling umum pemangkas buatan
  sendiri. Penjepitan hanya ada di SATU tempat (`cropFrom`), sehingga kotaknya
  tak pernah keluar gambar dan tepi kosong mustahil muncul.
- **Batas keluaran dihitung dari sisi TERPANJANG**, bukan dari lebar seperti
  galeri. Foto 4:5 yang lebarnya dibatasi 1600px menghasilkan tinggi 2000px —
  berkas lebih berat daripada foto galeri, untuk wadah yang justru lebih kecil.
- **Tak pernah memperbesar melebihi piksel sumber.** Memperbesar hanya menambah
  byte tanpa menambah detail.
- **Slider, bukan cubit dua jari.** Slider bekerja sama di tetikus dan sentuh,
  dan tak berebut gestur dengan penggeseran halaman. `touch-none` pada kanvas
  wajib: tanpanya, menyeret di HP menggulung halaman alih-alih menggeser foto.
- **Inline, bukan modal.** Proyek ini belum punya primitif Dialog, dan pemilik
  sering mengedit dari HP — panel yang mengembang di tempat tak perlu perangkap
  fokus dan tak tertutup papan ketik layar.
- **Tanpa dependency baru.** Pemangkas siap pakai (mis. `react-easy-crop`)
  menawarkan cubit dua jari dan rotasi; keduanya tak dipakai di sini, sedangkan
  geometrinya ±60 baris dan justru lebih mudah diuji sebagai fungsi murni.
  Catatan jujur: MCP context7 GAGAL TERSAMBUNG di sesi ini
  (`CONNECT_TIMEOUT`), jadi keputusan ini diambil dari penalaran, bukan dari
  riset praktik terbaik seperti biasanya.

**Harga yang diterima, dan dikatakan apa adanya:** setelah tersimpan, menyesuaikan
ulang hanya bisa MEMPERBESAR — tepi yang sudah terpangkas tak ada lagi. Untuk
mundur, pemilik mengunggah ulang dari galeri HP. Alternatifnya (menyimpan foto
asli yang tak pernah disajikan) ditawarkan dan tidak dipilih.

### Koreksi yang ikut dibawa commit ini

`coverPhoto` dan `logo` **tidak dirender tema mana pun** — `grep coverPhotoUrl`
di seluruh `src/themes` tak menghasilkan apa pun, dan `/api/og` pun belum
memakainya. Keduanya tetap di-resolve server dan ikut terhapus saat retensi
(#83), tetapi tak ada yang menampilkannya. Saat memasang ketiga bidang di #83
saya menyebut foto sampul "tampil di layar pembuka" — itu keliru. Bidangnya
tetap ada karena datanya sah dan akan terpakai, tetapi keterangannya kini
berbunyi apa adanya: *"Tersimpan, tetapi belum ditampilkan tema mana pun."*
Pemangkas sengaja TIDAK dipasang pada keduanya: tanpa wadah tema, rasio
pangkasnya hanya akan jadi tebakan.

**Verifikasi:** 15 mutan 15 mati. Dua di antaranya sempat lolos dan keduanya
salah saya, bukan mutan cacat: test "zoom dijepit" membandingkan `MAX_ZOOM`
dengan DIRINYA SENDIRI (melonggarkan batas jadi 99 tetap hijau), dan kasus
"minimal 1px" memakai angka yang membulat ke 1 dengan sendirinya sehingga tak
pernah menyentuh penjaganya.

---

## #85 — 2026-10-14 · Kosakata section kanonik + test konformansi tema (fase 1a)

Fase 1a dari [THEME-CONTRACT.md](THEME-CONTRACT.md), disetujui pemilik sebelum
tema ke-11 ditulis. Isinya tiga hal, dan dua di antaranya memperbaiki cacat yang
sudah ada.

### Kosakata yang bercabang

Sepuluh tema pertama ditulis satu per satu, dan masing-masing menamai sendiri
bagian yang sama:

| sebelum | sesudah | tema |
|---|---|---|
| `intro` | `hero` | meridian, lumina, prisma |
| `opening` | `hero` | aria, festa |
| `principals` | `couple` | lumina |
| `rundown` | `agenda` | prisma |
| `event` | `schedule` | prisma |

Id section bukan nama internal: ia tersimpan di `settings.custom.sections`,
menentukan label di editor tampilan, dan menentukan apakah pengaturan pemilik
bisa ikut berpindah saat ia berganti tema. Sinonim membuat ketiganya mustahil.

`copy.appearance.sectionLabels` ikut dirapikan — kelima label sinonim dibuang.
Entri yatim di sana membuat nama lama terasa masih sah dan mengundang tema
berikutnya memakainya lagi; test kontrak kini menolak yang yatim.

### Dua cacat yang ditemukan karena akhirnya ADA yang memeriksa

1. **EMPAT tema membuat layar pembuka bisa disembunyikan** (`toggle: true`) —
   `aria`, `festa`, `kirana`, `lumina` — padahal CUSTOMIZER-SPEC §3 mewajibkan
   hero & rsvp selalu tampil. Dugaan awal saya dua; test yang menemukannya,
   bukan pembacaan saya. Keempatnya lolos lint, typecheck, dan seluruh unit test
   selama berbulan-bulan.

2. **Jebakan yang justru akan DIBUKA oleh rename.** Logika urutan bawaan disalin
   di sepuluh `index.tsx`, dan salinan itu hanya menanyakan `isSectionVisible`.
   Selama hero bernama `intro`/`opening`, ia tak ada di `SECTION_KEYS` sehingga
   selalu tampil. Begitu dinamai `hero` — yang ADA di `SECTION_KEYS` —
   `settings.sections.hero = false` bisa menyembunyikannya. Hal yang sama
   berlaku untuk `rsvp`, yang memang sudah bisa disembunyikan begitu sejak awal.

   Keduanya ditutup `defaultSectionOrder()`: satu salinan untuk DELAPAN tema
   berjalur tunggal, dan `toggle: false` menang lebih dulu sebelum toggle lama
   ditanya. UI editor kebetulan tak pernah menampilkan toggle hero/rsvp, jadi
   tak ada data produksi yang terdampak — tetapi "kebetulan tak terjangkau dari
   UI" bukan jaminan.

3. **`aria` dan `prisma` ternyata berbentuk DUA JALUR**: satu cabang untuk
   `resolved` (customizer) dan satu JSX legacy yang sama sekali tak membaca
   `options.sections` — `aria` bahkan tak mendaftarkan `countdown` di sana.
   Helper tak bisa dipasang tanpa menyatukan kedua jalur, dan itu akan mengubah
   tampilan. Jadi keduanya dibiarkan dua-jalur, tetapi pelanggaran kontraknya
   ditutup langsung: `showRsvp` yang semula menanyakan toggle lama kini `true`,
   sama artinya dengan `toggle: false` di delapan tema lain. Menyatukan kedua
   jalur dicatat sebagai pekerjaan terpisah — ia keputusan tampilan, bukan
   keputusan kontrak.

### Test konformansi

`src/lib/customizer/theme-contracts.test.ts` diperluas: berjalan atas SELURUH
registry dan menolak tema yang tak punya `hero`/`rsvp` dengan flag yang benar,
memakai id di luar kosakata tanpa awalan `x-` + label, punya id ganda, atau
belum terdaftar di `themeRegistry` / `demoDataRegistry` / `themeCatalogMeta`.

Inilah inti fase 1a: DoD yang selama ini hidup di dokumen jadi dijaga CI. Tema
ke-30 sama amannya dengan tema ke-11 — dan ketiga temuan di atas muncul pada
menit pertama test ini dijalankan, bukan dari seseorang yang kebetulan curiga.

**Verifikasi:** 1935 test hijau · 103 assert kontrak atas 10 tema · 9 mutan 9
mati pada `section-vocab` + `default-order` (termasuk "sinonim lama dimasukkan
kembali" dan "`toggle:false` tak lagi menang").

### Kenapa sekarang

Produksi berisi **3 undangan, 0 aktif, 0 yang punya `settings.custom`**.
Mengganti id section hari ini = nol migrasi data. Setelah ada klien berbayar dan
tiga puluh tema, hal yang sama menjadi migrasi betulan atas kolom JSONB.

### Yang SENGAJA belum dikerjakan

Blok `media` di `options.ts` dan foto non-destruktif (THEME-CONTRACT §2–§3)
adalah fase **1b** — keduanya mengubah kontrak props tema, dan dipisah supaya
perubahan kosakata ini bisa diverifikasi sendirian.

Label section masih satu per id, belum sadar kategori: `couple` selalu
"Mempelai", padahal lumina memakai bagian itu untuk kategori lain juga. Dicatat,
tidak dikerjakan.

---

## #86 — 2026-10-14 · Foto non-destruktif + slot media per tema (fase 1b)

Fase 1b dari [THEME-CONTRACT.md](THEME-CONTRACT.md). Ia membatalkan sebagian
#84 — dengan sengaja, dan pada satu-satunya momen ketika itu masih gratis.

### Rasio pangkas pindah dari BERKAS ke TEMA

#84 memanggang pangkasan 4:5 ke berkas yang diunggah. Itu benar selama
kesepuluh tema berwadah potret serupa, dan salah pada hari pertama ada tema
lanskap. Pemilik memutuskan pindah sebelum tema ke-11 ditulis.

Sekarang berkasnya disimpan UTUH dan yang tersimpan di `content` hanyalah angka:

```ts
photo: { path: "inv/<inv>/foto/<uuid>", x: 0.38, y: 0.22, zoom: 1.6 }
```

Tema menerapkannya lewat satu helper bersama, satu baris per `<img>`:
`objectPosition` + `transform: scale()` dengan `transformOrigin` DISAMAKAN —
tanpa penyamaan itu, memperbesar menarik gambar ke tengah wadah dan wajah yang
sudah dibidik justru bergeser keluar.

Yang didapat: ganti tema tak merusak foto · penyesuaian bisa diubah kapan saja
tanpa unggah ulang · mutu tak pernah turun bertingkat · tema lanskap tinggal
menulis `aspect: 16/9`.

**Nol migrasi.** Skema menerima string telanjang dan menormalkannya ke titik
tengah, jadi dua foto yang sudah terlanjur tersimpan tetap sah. Angka yang rusak
jatuh ke bawaan lewat `.catch()` alih-alih melempar — `content` satu kolom
JSONB, dan satu titik fokus karangan tak boleh membuat nama mempelai serta
jadwal ikut hilang dari editor.

### Kodenya BERKURANG

Pemangkas kanvas (`photo-cropper.tsx`), `crop.ts`, dan `cropToVariants` dihapus.
Penyesuai sekarang memakai CSS yang sama persis dengan tema, jadi pratinjau di
editor bukan lagi tiruan — ia perilaku yang sama. Tak ada lagi kanvas keluaran,
`drawImage`, atau penghitungan ukuran varian.

Matematika pergeseran dipindah ke `lib/image/focus.ts` sebagai fungsi murni.
Pembaginya LUAPAN NYATA foto di dalam bingkai, bukan lebar bingkai: foto yang
nyaris sebentuk bingkai akan terasa melompat, dan panorama terasa macet —
keduanya terbaca sebagai "penyesuaiannya rusak", bukan "faktornya kurang pas".

Satu penjaga dibuang karena terbukti tak terjangkau: `pembagi > 0` sudah
menangani bingkai 0 px, gambar belum termuat, dan NaN sekaligus.

### Slot media: editor berhenti menebak

`ThemeOptions.media.slots` menyatakan foto apa yang BENAR-BENAR dirender sebuah
tema, lengkap dengan rasio wadahnya. Editor merender bidang unggah persis dari
daftar itu. Konsekuensinya langsung terlihat, dan semuanya jujur:

- **Enam tema** mendeklarasikan `groom` + `bride` dengan rasio asli wadahnya
  (eternal-rose 3/4 · barakah 4/5,4 · kirana 150/186 · meridian & noir 4/5 ·
  verdant 150/190).
- **Empat tema — aria, festa, lumina, prisma — tidak merender foto mempelai
  sama sekali.** Pemilik yang memakai tema itu kini tak melihat bidang
  unggahnya. Itu bukan fitur yang hilang; bidangnya memang tak pernah
  menghasilkan apa pun di sana.
- **`cover` dan `logo` tak dideklarasikan satu tema pun**, jadi bidangnya hilang
  dari editor. Ini menutup janji palsu yang saya pasang di #83 dan saya akui di
  #84: keduanya bisa diunggah, tak pernah tampil di mana pun.

### Tinjauan yang menangkap kesalahan saya

Lima tema dikerjakan paralel dengan acuan eternal-rose buatan saya. **Tiga agen
secara terpisah melaporkan lubang yang sama di acuan itu**: komponen perantara
`Couple` masih bertipe `string | null` sementara `PersonCard` di dalamnya sudah
`PhotoView | null`. Saya melewatkannya karena memangkas keluaran `tsc` dengan
`head -12` — galatnya ada, terpotong. Dua agen menolak menyalin lubang itu dan
menambalnya di temanya masing-masing; satu lagi menyebutnya tanpa menyentuh
berkas di luar batasnya. Semuanya saya verifikasi sendiri di kode sebelum
menerima.

**Verifikasi:** 1953+ test hijau · 133 assert kontrak atas 10 tema · 18 mutan 18
mati, termasuk "string telanjang tak lagi dinormalkan", "transformOrigin
tertinggal di tengah", "pembagi memakai lebar bingkai", dan "foto baru mewarisi
penyesuaian foto lama".

### Yang tersisa

Keempat tema tanpa foto mempelai layak diberi foto — itu pekerjaan art
direction, bukan kontrak. `/api/og` masih belum memakai foto sampul (SPEC §4.5),
dan selama tak ada tema yang mendeklarasikan slot `cover`, bidangnya pun tak
tersedia untuk diisi.

---

## #87 — 2026-10-14 · `pnpm theme:new` — tema baru lahir sudah memenuhi kontrak (fase 2)

Fase 2 dari [THEME-CONTRACT.md](THEME-CONTRACT.md), dikerjakan sebelum tema
ke-11 supaya tema ke-11 sampai ke-30 murah.

### Masalah yang diselesaikan

Menambah satu tema menyentuh **enam tempat di luar folder temanya**:
`registry.ts`, `theme-options-registry.ts`, `demo-data-registry.ts`,
`catalog-meta.ts`, satu migrasi seed `themes`, dan `pnpm thumbs`.

Yang terlewat **tidak pernah menimbulkan galat**. Ia hanya membuat tema tak
muncul di katalog, atau muncul lalu gagal dirender, atau tak bisa dipilih saat
membuat undangan karena `theme_id`-nya tak pernah ada. Semuanya baru ketahuan
dari orang yang membukanya.

`pnpm theme:new <slug>` membuat tujuh berkas tema dan mendaftarkannya ke keempat
registry + menulis migrasi seed. Penyisipan registrinya **idempoten** —
menjalankan ulang setelah gagal di tengah jalan tak menggandakan baris, dan
registry dengan dua baris untuk satu tema gagal build dengan pesan yang tak
menunjuk penyebabnya.

### Buktinya, bukan klaimnya

Scaffold dijalankan sungguhan membuat tema `scaffold-uji`, lalu diperiksa:
`tsc --noEmit` **bersih**, eslint **bersih**, dan test konformansi **146 assert
hijau** — tanpa satu pun suntingan tangan. Temanya kemudian dihapus; yang
tertinggal hanya scriptnya.

Latihan itu menemukan satu cacat nyata di template: `formatEventDateTime`
mengembalikan `FormattedEvent | null`, bukan string, sehingga section Jadwal tak
akan typecheck. Tanpa menjalankannya sungguhan, cacat itu akan diwarisi setiap
tema baru.

### Yang sengaja dipilih

- **`is_active = false` di migrasi seed.** Tema baru tak boleh muncul di katalog
  sebelum art direction & DoD-nya selesai (THEME-PORTING §5). Menyalakannya
  adalah keputusan sadar, bukan efek samping dari membuat berkas.
- **Kerangkanya polos tetapi BENAR** — tersambung ke data yang tepat, memenuhi
  kontrak, langsung hijau. Menyalin tema yang sudah ada akan membawa serta art
  direction orang lain, dan itu justru yang harus diganti.
- **Template dipisah** ke `theme-templates.mjs`: isinya kode dalam string,
  dengan setiap backtick di-escape. Mencampurnya dengan logika scaffold membuat
  keduanya sulit dibaca.

### Dua jaring baru

1. **`tests/unit/theme-scaffold.test.ts`** menjaga TEMPLATENYA: id section harus
   lolos `isKnownSection`, hero/rsvp berflag benar, slot media dikenal, dan
   sinonim lama (`intro`, `opening`, `principals`, `rundown`, `event`) ditolak.
   Test konformansi menjaga tema yang SUDAH ada; ini menjaga tema yang BELUM
   ada — tanpanya, kosakata yang berubah akan membuat setiap tema baru lahir
   melanggar, dan yang menemukannya adalah orang yang sedang mengerjakan art
   direction, jauh dari penyebabnya.
2. **Pemeriksaan seed** di test konformansi: setiap slug di `themeRegistry`
   harus muncul di salah satu migrasi. Ini melengkapi daftar §5 THEME-CONTRACT
   yang terakhir belum terpasang.

**Verifikasi:** 134 assert kontrak · 33 test scaffold · tema hasil generate
bersih di typecheck, lint, dan konformansi tanpa suntingan.

---

## #88 — 2026-10-14 · Identitas pelaku usaha: dari butir checklist menjadi gerbang

`/syarat`, `/privasi`, dan `/refund` sudah lengkap sejak AUDIT-2026-10-01, dan
`copy.marketing.legal.merchant` sudah jadi satu sumber untuk ketiganya. Yang tak
pernah terisi adalah DATANYA: `name` dan `address` masih string kosong.

Halaman legal menangani itu dengan **anggun** — field kosong tak dirender, jadi
ketiganya tetap terbaca benar. Dan keanggunan itulah bahayanya: tak ada galat,
tak ada bagian yang rusak, tak ada satu pun tanda bahwa sesuatu yang diwajibkan
PP 80/2019 & Permendag 31/2020 sedang hilang. Satu-satunya yang akan memberi
tahu adalah aggregator pembayaran — saat menangguhkan akun merchant, biasanya
setelah uang pelanggan sudah masuk.

Butir checklist tak cukup untuk itu. Checklist dibaca oleh orang yang ingat
membacanya.

**Sekarang `createCheckoutAction` menutup sendiri:** di PRODUCTION, selama
`merchantIdentityReady()` false, ia melapor ke `checkout.merchant-identity` lalu
menolak — SEBELUM menyentuh database, jadi tak ada baris `orders` setengah jadi
untuk pembayaran yang memang tak boleh terjadi.

Tiga hal yang dipilih dengan sadar:

- **Hanya production.** Alur pembayaran harus tetap bisa ditelusuri di dev &
  staging; gerbang yang menghalangi pengembangan akan dimatikan orang, dan
  gerbang yang dimatikan tidak menjaga apa pun.
- **Pesannya memberi jalan, bukan menyuruh mencoba lagi.** Pembeli tak bisa
  memperbaiki ini sendiri, jadi ia diberi alamat email yang benar-benar
  menolong — bukan "coba lagi nanti" yang akan dipatuhinya berkali-kali.
- **`name` + `address` sebagai minimum.** `owner` dan NPWP/NIB menyusul bila
  ada. Yang paling mungkin terjadi adalah nama terisi dan alamat tertunda —
  karena itu "cukup salah satu" harus tetap dibaca BELUM SIAP.

**Verifikasi:** 8 mutan 8 mati, termasuk "alamat tak diperiksa", "aktif juga di
dev", "menolak diam-diam tanpa melapor", dan "pesannya menyuruh coba lagi".

---

## #89 — 2026-10-15 · _Secure password change_ Supabase TIDAK diaktifkan

**Keputusan:** biarkan `security_update_password_require_reauthentication = false`
di project cloud. Re-autentikasi sebelum penggantian kata sandi ditegakkan
**aplikasi**, bukan GoTrue. Butir LAUNCH-CHECKLIST Fase 6 yang dulu berbunyi
"aktifkan _Secure password change_" diubah menjadi larangan eksplisit.

**Alasan:** mengikuti butir lama itu akan mematahkan **kedua** jalur kata sandi
sekaligus. Dengan toggle itu hidup GoTrue menuntut `nonce` pada
`updateUser({ password })`, sementara aplikasi memanggilnya tanpa nonce di dua
tempat — `updatePasswordAction` (jalur reset) dan form ganti sandi di profil
(`src/server/actions/auth.ts`). Hasilnya: tak seorang pun bisa menyetel kata
sandi, dan gejalanya hanya "coba lagi" generik, persis kelas kegagalan yang
sudah dua kali menggigit project ini (#76, #81).

Yang hendak dilindungi toggle itu sudah ada, dan lebih ketat daripada yang
ditawarkannya:

- **Jalur profil** memverifikasi kata sandi saat ini lewat `signInWithPassword`
  pada klien terpisah. Ini dibangun justru karena parameter `current_password`
  Supabase **diabaikan diam-diam** — dokumen vendor menjanjikannya, runtime
  tidak melakukannya.
- **Jalur reset** menuntut `isFreshEmailGrant`: hanya sesi yang baru lahir dari
  klik tautan email (≤ 30 menit) yang boleh menyetel sandi tanpa sandi lama.
  Sesi dashboard biasa ditolak — perbaikan AUDIT-2026-10-01 B1, ketika
  `getUser()` tak-null masih menjadi satu-satunya syarat.

**Ditolak:** (a) aktifkan toggle lalu kirim `nonce` dari aplikasi — menambah satu
email bolak-balik pada alur yang sudah terbukti, demi penjagaan yang sudah
dipunyai; (b) aktifkan "karena checklist bilang begitu" tanpa uji — inilah yang
hampir terjadi, dan satu-satunya alasan tidak terjadi adalah kodenya dibaca
lebih dulu.

**Konsekuensi:** penjagaan ini hidup di `src/server/actions/auth.ts`, bukan di
setelan dasbor. Siapa pun yang menyederhanakan kedua jalur itu kelak menghapus
satu-satunya re-autentikasi yang ada — 36 test di tiga berkas
(`auth-action-errors`, `change-password-action`, `lib/email-grant`) menjaganya,
dan ADR ini menjelaskan kenapa dasbornya sengaja dibiarkan "longgar".

---

## #90 — 2026-10-15 · Foto sampul = pratinjau tautan, dan ia wajib JPEG

**Keputusan:** `/api/og` kini merender `content.coverPhoto` sebagai latar penuh
(SPEC §4.5 akhirnya terpenuhi: "nama + tanggal di atas foto cover"). Foto sampul
dipakai **hanya** di sana — bukan di halaman undangan — dan punya varian ketiga
`og.jpg` di samping `1600.webp` + `400.webp`. Label editornya diganti menjadi
"Foto untuk pratinjau tautan".

**Alasan — dua temuan probe, bukan dokumen:**

1. **Satori tidak bisa meraster WebP, dan gagalnya TANPA SUARA.** Diberi WebP ia
   mencatat `Unsupported image type: image/webp` lalu tetap menghasilkan PNG
   yang sepenuhnya sah — hanya tanpa fotonya. Probe: kontrol PNG 26.620 byte
   berisi gambar, WebP 4.515 byte berisi latar kosong, JPEG 172.430 byte berisi
   gambar. Tanpa varian JPEG, pratinjau WhatsApp akan "berhasil" selamanya
   sambil tak pernah memuat satu wajah pun. Karena itu aturannya keras: `og`
   yang bukan `image/jpeg` DITOLAK saat unggah, bukan disimpan dengan nama
   menyesatkan — route `/media` menentukan tipe dari EKSTENSI, jadi berkas
   bukan-JPEG bernama `og.jpg` akan disajikan sebagai `image/jpeg` lalu gagal
   diam-diam di satori.
2. **Satori MENDUKUNG `object-fit`, `object-position`, `scale`, dan
   `transform-origin`.** Diprobe dengan gambar berisi detail khas: `scale(3)`
   dengan origin kiri-atas benar-benar memperbesar sudut kiri-atas. Karena itu
   penyesuaian geser-zoom pemilik diterapkan SAAT RENDER lewat `fotoStyle` yang
   sama dengan tema — tidak dipanggang ke berkas saat unggah. Memanggangnya akan
   membuat pratinjau BASI pada geseran berikutnya.

**Bug yang ditemukan probe sebelum terbit:** `fotoStyle` memancarkan
`transform: undefined` saat `zoom === 1`. Peramban mengabaikannya; satori
MELEMPAR (`Invalid transform value`). Karena `zoom: 1` adalah bawaan setiap foto
yang baru diunggah, bentuk lama membuat `/api/og` gagal 500 justru pada kasus
yang paling sering. Helper kini menghilangkan kuncinya, dan satu test menjaga
agar tak ada nilai `undefined` yang lolos.

**Ditolak:**

- **Foto sampul juga tampil di gerbang cover tema** — menyentuh `cover.tsx`
  KESEPULUH tema (tak satu pun menampilkan foto hari ini), masing-masing butuh
  perlakuan visual sendiri, dan foto layar penuh menjadi elemen LCP sehingga
  anggaran < 2,5 dtk di 4G harus diukur ulang. Ditunda, bukan ditutup.
- **Pakai foto galeri pertama** — terdengar paling murah, nyatanya paling mahal:
  SETIAP foto galeri harus ikut menghasilkan varian JPEG padahal hanya satu yang
  dipakai, dan pemilik kehilangan kendali atas foto mana yang muncul di WhatsApp.
- **Dekode WebP di server** — dependency besar + CPU per permintaan pada
  endpoint publik, melanggar "server tidak memproses gambar".

**Konsekuensi:**

- `og.jpg` masuk ke `mediaObjectPaths`, bukan daftar terpisah — daftar itu
  dipakai purge retensi UU PDP, dan varian yang tak disebut akan meninggalkan
  foto wajah seseorang di disk setelah data pribadinya dihapus. Foto galeri jadi
  menghapus satu objek yang tak ada; aman (semua pemanggilnya best-effort).
- Rasio bingkai penyesuaian foto sampul = rasio kanvas OG (1200×630), bukan
  rasio tema — supaya yang dibingkai pemilik = yang dikirim ke WhatsApp. Slotnya
  selalu ada, tak bergantung tema; tema yang kelak benar-benar merender sampul
  boleh menimpanya.
- `/api/og` mengambil berkasnya SENDIRI lalu memeriksa content-type sebelum
  render, dan melapor (`og.cover`) bila tak terbaca. 404 tidak dilaporkan: itu
  foto sampul yang diunggah sebelum varian OG ada. Gagal mengambil foto
  menurunkan gambar ke tipografi — tak pernah menggagalkan pratinjau.
- Scrim `rgba(18,12,12,0.46)` diuji terhadap foto paling terang yang ada dan
  teks putih tetap terbaca; dipertahankan apa adanya.

---

## #91 — 2026-10-15 · Triase enam PR Dependabot; `@types/node` dipatok ke Node runtime

**Keputusan:** `@types/node` major di-ignore di `.github/dependabot.yml`. Empat
PR mayor lain ditriase: `supabase/setup-cli` v3 **merge**, TypeScript 6 **merge
setelah CI-nya benar-benar jalan**, jsdom 30.1.1 **tunggu 30.1.3**,
`@types/node` 26 **tolak**.

**Temuan pangkal — semua PR merah karena satu bug izin, bukan karena
dependensinya.** Keenam PR gagal di langkah gitleaks dengan
`403 Resource not accessible by integration` pada `GET /pulls/{n}/commits`;
`Lint, Typecheck, Test, Build` berstatus `skipped` di setiap run. Enam PR
tampak "pembaruannya rusak" selama berminggu-minggu padahal tak satu pun pernah
diuji. Diperbaiki di commit sebelum entri ini (`pull-requests: read` di level
job). Pelajarannya melampaui Dependabot: **job yang mati di langkah awal
menghasilkan merah yang menuduh langkah yang tak pernah jalan.**

**`@types/node` — kenapa ditolak, bukan ditunda.** Ia mendeskripsikan API
runtime. Repo seragam Node 22 di empat tempat (`Dockerfile:4`, `Dockerfile:44`,
`package.json` `engines`, CI `node-version`), dan tak ada `.nvmrc` sebagai
sumber tunggal. Menerima tipe Node 26 membuat `tsc` merestui API yang tak ada
saat dijalankan — `URLPattern` global, `node:ffi`, `node:quic`, `node:vfs` —
dan **gerbang typecheck BUTA terhadap kelas cacat ini**: hijau sambil
meloloskan kode yang pasti pecah di produksi. Tak ada satu pun breaking change
v22→v26 yang menyentuh kode repo, jadi manfaatnya nol dan risikonya searah.
Major-nya hanya boleh naik bersamaan dengan menaikkan Node di Dockerfile + CI.

**TypeScript 6 — aman, tetapi urutannya yang dijaga.** Kompiler 6.0.3 yang
sungguhan dijalankan terhadap tsconfig repo: **0 error** pada pohon lokal (554
berkas) DAN pada pohon bentuk-CI (`git archive HEAD`, tanpa `.next`), dengan
kontrol tsc 5.9.3 pada pohon yang sama juga 0 error. Agar "0 error" tak lolos
karena alasan yang salah, tiga probe diskriminatif dipakai — `import "./nope"`
→ TS2882, `const x: string = null` → TS2322, `process.env` → TS2591 — ketiganya
error di 6.0.3 dan senyap di 5.9.3, membuktikan `noUncheckedSideEffectImports`,
`strict`, dan `types: []` memang aktif. `@typescript-eslint` 8.65.0 memparse
545/545 berkas dengan TS 6.0.3 (`SUPPORTED_TYPESCRIPT_VERSIONS` `<6.1.0`), dan
Vitest tak pernah memuat paket `typescript` sama sekali (tanpa mode `typecheck`,
transform lewat esbuild). Tetap tidak di-merge sebelum CI-nya jalan: job
`promote` mem-fast-forward `production` pada setiap push ke `main` dan tak ada
branch protection, jadi me-merge commit yang gerbangnya **tak pernah berjalan**
adalah persis mode kegagalan yang workflow itu dibangun untuk mencegah.

**jsdom — versinya, bukan kodenya.** 30.0.0 hanya punya SATU breaking change
resmi: lantai Node naik ke `^22.22.2`. Tetapi 30.1.1 yang ditawarkan PR masih
membawa dua regresi yang baru diperbaiki sesudahnya — "severe slowdowns when
building large DOM trees" (30.1.2) dan perhitungan CSS persentase yang salah
jadi piksel (30.1.3). Seluruh 152 berkas test berjalan di jsdom, jadi regresi
itu mengenai semuanya. Versi terbaru saat ini **30.1.3**; tunggu itu.

**Konsekuensi yang perlu diingat:** mesin pengembang berjalan di Node **v22.20.0**
— di bawah lantai jsdom 30 (`^22.22.2`) dan di bawah Node yang dipakai CI
(v22.23.3, hasil resolve `node-version: 22`). Selama belum dinaikkan, jsdom 30
tak bisa dipasang bersih secara lokal walau CI sanggup. Tak adanya `.nvmrc`
membuat versi runtime tersebar di empat berkas tanpa satu sumber kebenaran.

---

## #92 — 2026-10-16 · `pnpm migrate:media` dihapus; pindah R2 tanpa migrasi

**Keputusan:** `scripts/migrate-media-to-r2.mjs` dan skrip npm `migrate:media`
DIHAPUS. Pindah ke R2 dikerjakan tanpa alat pemindah: pustaka lagu diunggah
ulang lewat `/admin/lagu` dari master di `handoff/music/mp3/`, foto uji dibuat
ulang. Butir #15.2 dicabut.

**Alasan — alatnya salah, dan sungainya tidak ada.**

Audit empat dimensi (driver, skrip migrasi, deploy, cakupan uji; masing-masing
dibantah skeptik) menemukan skrip itu tak layak dipakai untuk migrasi ini:

- **Sumbernya salah.** Ia mengunduh dari bucket Supabase Storage, sedangkan
  produksi memakai driver `local` di disk VPS. Setiap objek akan gagal.
- **Cakupannya sepertiga.** Daftar objeknya dibangun dari tabel `media` ×
  `["1600.webp","400.webp"]`. Yang TIDAK ikut: varian `og.jpg`, seluruh foto
  bernama (pathnya hidup di `invitations.content`, tanpa baris `media`), foto
  Album Momen, dan pustaka lagu di `songs/<sha256>.<ext>`.
- **`Content-Type` dipaku `image/webp`** untuk setiap objek — `og.jpg` akan
  ditolak satori, `.mp3` disajikan sebagai gambar.
- **`loadEnv()` mendahulukan `.env.local`**, sehingga ia menyasar database
  LOKAL dan tetap melaporkan sukses.
- **Tak ada verifikasi objek sampai**, dan `--dry-run` kembali sebelum
  mengunduh — buta terhadap masalah sumber yang justru ingin diuji.

Yang menentukan keputusan untuk tidak memperbaikinya: **tak ada data pelanggan
untuk dipindahkan.** Saat keputusan diambil, seluruh isi storage adalah 6 lagu
(11 MB, masternya ada lengkap di disk pemilik beserta WAV dan generatornya) dan
segelintir foto uji pada tiga undangan `draft` milik akun uji — dengan 0 order,
0 undangan `active`, 0 pelanggan. Menulis pemindah yang benar untuk memindahkan
~16 objek yang semuanya bisa dibuat ulang adalah membangun jembatan di atas
sungai yang tidak ada.

**Kenapa DIHAPUS, bukan ditandai USANG:** namanya terdengar benar. Butir
checklist dan ADR yang sama-sama menuliskan `pnpm migrate:media` membuatnya
jalan yang paling mungkin ditempuh orang yang terburu-buru — dan skrip yang
salah di lima dimensi dengan label peringatan tetaplah senjata yang terisi.
Sejarah git menyimpannya bila kelak dibutuhkan sebagai rujukan.

**Syarat pemindah yang benar, bila kelak media PELANGGAN harus dipindahkan:**

1. Sumbernya dua: `MEDIA_ROOT` di disk DAN Supabase Storage (objek nyata
   tersebar di keduanya).
2. Daftar objeknya dari EMPAT sumber: tabel `media` (lewat `mediaObjectPaths()`
   yang sudah mencakup `og.jpg`), path foto bernama yang dipanen dari
   `invitations.content` (query yang sama dipakai migrasi
   `20261014120000_purge_named_photos`), `momen_photos`, dan `songs`.
3. `Content-Type` DITURUNKAN dari ekstensi lewat `TIPE_ISI_PER_EKSTENSI`
   (`src/lib/storage/local-path.ts`) — satu-satunya peta yang sudah terbukti
   sejalan dengan sisi unggah — atau, lebih baik, PUT lewat
   `R2StorageDriver.upload()` sendiri supaya header cache tak bisa berbeda
   antara objek lama dan baru.
4. Verifikasi objek sampai (ukuran/ETag) SEBELUM apa pun dihapus di sumber.
5. Idempoten, dan menyadari aplikasi masih menulis media baru selama ia jalan.

**Konsekuensi:** prosedur cutover yang benar kini tertulis di
LAUNCH-CHECKLIST Fase 5, dengan peringatan yang hilang dari ketiga dokumen
lama: **REBUILD, bukan restart**. `NEXT_PUBLIC_MEDIA_URL` di-inline saat build
sementara `STORAGE_DRIVER` dibaca saat runtime; mengubah keduanya di panel lalu
me-restart hanya menggerakkan yang kedua dan memadamkan seluruh media. Sejak
commit sebelum entri ini, `/api/health` menolak pasangan yang tak padu sehingga
image yang salah tak pernah menerima trafik.

---

## #93 — 2026-10-16 · Padam total dibedakan dari gagal sebagian; lima titik bisu dibunyikan

**Keputusan:** route unduhan ZIP (galeri & Album Momen) kini memisahkan
SEBAGIAN gagal dari SEMUA gagal lewat `src/server/arsip-zip.ts`. Sebagian gagal
→ perilaku lama persis (200, yang gagal dilewati, nomor berlubang). Semua gagal
→ **503** dengan badan teks yang bisa dibaca pemilik, dan tak ada ZIP yang
dibuat. Keduanya dilaporkan ke Sentry. Ditambah tiga jalur unggah yang selama
ini menelan galatnya kini melapor: `media.upload`,
`media.named-photo.upload`, `admin.song.upload`.

**Alasan — kegagalan yang tidak terlihat seperti kegagalan.**

ZIP dirakit lewat generator supaya memori VPS tetap ~1 foto berapa pun besar
albumnya. Konsekuensinya status HTTP sudah TERKIRIM sebelum satu byte foto pun
diambil. Digabung dengan aturan "foto yang gagal diambil dilewati" — yang benar
untuk satu foto rusak — padamnya storage secara total menghasilkan **berkas ZIP
yang sah, 200 OK, bernama `foto-galeri-<slug>.zip`, dan kosong**.

Konteksnya yang membuatnya mahal: email peringatan pra-purge H-30/H-7 dan
`/syarat` menyuruh pemilik mengunduh datanya SEBELUM retensi menghapusnya.
Arsip kosong yang terlihat berhasil, tepat di jalur penyelamatan terakhir itu,
terbaca oleh pemilik sebagai "berarti foto saya memang sudah hilang". Diamnya
ganda: pemiliknya salah paham, dan kami tak pernah tahu kejadiannya.

Temuan audit juga menyertakan hal yang lebih tidak enak: **ada test hijau yang
mengesahkan perilaku itu** (`fetch yang MELEMPAR juga dilewati, bukan
menggagalkan route` — menegaskan 200 dengan nol berkas). Test itu ditulis ulang
beserta NIATNYA, bukan hanya angkanya.

Kelima titik bisu ini satu keluarga, dan semuanya menjadi mungkin justru pada
hari pindah R2: token ber-scope salah menjawab 403 dengan sopan pada setiap
operasi. Sebelum perubahan ini gejalanya di produksi adalah pelanggan yang
mengeluh, bukan alarm.

**Ditolak:**

- **Memutus stream di tengah (`ctrl.error`) saat gagal total.** Pemilik mendapat
  berkas terpotong, dan bila kegagalannya baru muncul di tengah daftar, foto
  yang SUDAH berhasil ikut hilang. Yang dicari adalah jawaban jujur, bukan
  kerusakan yang lebih meriah.
- **Menyelipkan `CATATAN.txt` ke dalam ZIP.** Statusnya tetap 200 — tetap bohong
  bagi apa pun yang membacanya secara otomatis — dan pemilik yang mengekstrak
  hanya gambarnya tak pernah membukanya.
- **Mem-prefetch SELURUH daftar sebelum merespons.** Itu menghapus jaminan
  memori ~1 foto yang menjadi seluruh alasan desain streaming ini ada.
- **Membuat kegagalan unggah melempar.** Pelajaran #82: lemparan per-render
  berubah menjadi 500 bagi setiap orang. Yang dibutuhkan jejak, bukan ledakan.

**Konsekuensi:** satu fetch dimajukan ke sebelum header terkirim — pada arsip
sehat itu fetch yang memang akan dilakukan juga, dan bodinya tetap belum dibaca
sehingga memorinya tak berubah. Pada storage yang benar-benar padam seluruh
daftar dicoba sebelum 503: kerja yang sama persis dengan yang dulu dilakukan
generator di balik 200, bedanya jawabannya kini benar. `adminAddSongAction`
mendapat test pertamanya (sebelumnya nol), termasuk pengunci bahwa `redirect()`
HARUS tetap di luar `try` — ia bekerja dengan melempar `NEXT_REDIRECT`, jadi
`redirect()` di dalam `try` akan ditelan catch yang sama dan aksinya diam-diam
lanjut menyisipkan baris `songs` yang menunjuk objek tak-ada.

---

## #94 — 2026-10-16 · Purge foto bernama membaca bentuk yang salah; dua penghapusan UU PDP dibunyikan

**Keputusan:** migrasi `20261016111713` memperbaiki ekstraksi path foto bernama
di `purge_invitation_data` — dari `content->>'key'` (mengira STRING) menjadi
`jsonb_typeof` yang menangani bentuk OBJEK maupun STRING lama, lalu disaring
regex bentuk penuh yang terikat `p_invitation_id`. Fixture pgTAP ditulis ulang
memakai bentuk yang benar-benar ditulis aplikasi. Ditambah dua pelaporan yang
hilang: `invitation.delete.storage` dan `momen.moderate.purge.storage`.

**Alasan — test hijau di atas bentuk yang tidak ada di produksi.**

`photoSchema` menormalkan SETIAP foto menjadi objek `{path,x,y,zoom}`; migrasi
`20261014120000` ditulis saat tombol unggahnya belum ada dan `content` masih
menyimpan string. Tombolnya lalu dibuat, bentuknya berubah, SQL-nya tidak.

`->>` pada objek tidak mengembalikan NULL — ia mengembalikan TEKS JSON-nya.
Dibuktikan di Postgres, bukan disimpulkan:

```
select '{"coverPhoto":{"path":"inv/a/foto/b","x":0.5}}'::jsonb ->> 'coverPhoto';
→ {"x": 0.5, "path": "inv/a/foto/b"}
```

Akibatnya foto sampul, foto kedua mempelai, dan logo **tidak pernah terhapus**
saat purge retensi — persis lubang UU PDP yang migrasi itu diklaim menutup —
sementara `content` di-scrub menjadi `'{}'` beberapa baris kemudian sehingga
satu-satunya rujukan ke objeknya lenyap. Barisnya di-set `purged_at`, jadi cron
menyaringnya keluar dan tak akan pernah mencoba ulang.

Yang paling perlu diingat: **fixture pgTAP-nya menulis bentuk STRING**, bentuk
yang sudah tidak pernah ditulis aplikasi. Delapan assert hijau selama dua hari
di atas data yang tidak ada. Fixture sekarang memakai bentuk OBJEK untuk
undangan A, mempertahankan STRING di B sebagai regresi data lama, dan menambah
D berisi bentuk-bentuk rusak. Dijalankan terhadap fungsi LAMA: **6 dari 12
merah** — termasuk "tak ada teks JSON yang lolos sebagai path".

**Ditolak:**

- **`coalesce(content->'key'->>'path', content->>'key')`.** Menangani kedua
  bentuk, tetapi objek RUSAK (tanpa kunci `path`) tetap jatuh ke lengan kedua
  dan kembali menghasilkan teks JSON — persis kelas galat yang sedang
  dibetulkan. `case jsonb_typeof` menjawab NULL untuk apa pun di luar dua
  bentuk sah.
- **Regex bentuk penuh pada SELURUH `v_paths`.** Array itu memuat DUA bentuk:
  prefix galeri `inv/<uuid>/<uuid>` dan foto bernama `inv/<uuid>/foto/<uuid>`.
  Menyaring semuanya dengan pola foto bernama akan membuang setiap prefix
  galeri — menukar kebocoran foto bernama dengan kebocoran galeri yang jauh
  lebih luas. Hanya lengan foto bernama yang disaring; galeri sudah dijamin
  check constraint `media_storage_path_format`.

**Dua penghapusan yang dibunyikan:**

- `deleteInvitationAction` cabang `expired` memanggil RPC purge yang SAMA
  dengan cron, lalu membuang hasil `Promise.allSettled`-nya. Cron menghitung
  dan melapor; jalur yang dipicu pemilik tidak. Aksi ini juga mendapat test
  pertamanya — termasuk boundary CLAUDE.md "jangan pernah hapus undangan yang
  masih aktif", yang sebelumnya tak dijaga satu test pun.
- `moderateMomenPhotoAction` pasca-reveal menyetel `purged_at`, menolak tombol
  "Tampilkan" selamanya, lalu menelan hasil penghapusannya. Ini satu-satunya
  penghapusan di produk yang tujuannya memang "objek ini harus HILANG", dan
  pathnya SUDAH tersebar ke tamu saat reveal. Bila DELETE gagal, URL-nya terus
  menjawab 200 dengan `Cache-Control: immutable` setahun sementara UI
  mengatakan foto itu sudah dicabut.

**Catatan metode:** audit ini menurunkan empat pemeriksa paralel dengan skeptik
adversarial per temuan berbobot — 8 diperiksa, **3 bertahan, 5 terbantah**.
Skeptik juga MENGOREKSI temuan yang bertahan: pemeriksanya menyebut bug ini
khas R2, padahal driver `local` yang berjalan hari ini pun menolak path itu di
`segmenObjek()`. Ia laten sama persis sebelum dan sesudah cutover.

**Konsekuensi:** migrasi ini **belum terpasang di produksi** — CI hanya
fast-forward branch `production`, tidak menjalankan `supabase db push`. Pemilik
harus menjalankannya. Sampai itu terjadi, setiap undangan yang kedaluwarsa dan
ter-purge meninggalkan foto wajah mempelai di storage secara permanen.

---

## #95 — 2026-10-16 · Tiga setelan Auth produksi dikencangkan; HIBP ternyata terkunci Pro

**Keputusan:** `mailer_otp_exp` 3600→**1800** dtk, `password_min_length` 6→**8**
(menyamakan dengan validasi aplikasi), `smtp_sender_name` `"noreply"`→**"Merriva"**
— diterapkan lewat Management API, diverifikasi dengan membaca ulang dari
server. **Leaked Password Protection TIDAK bisa dinyalakan** dan tetap
dilaporkan GAGAL oleh `pnpm ops:verify`, bukan diturunkan jadi peringatan.

**Alasan:** ketiganya butir Fase 6 yang sudah lama menggantung, dan semuanya
hanya berlaku saat sandi DIBUAT atau DIUBAH — tak ada pengguna lama yang
terkunci, admin tidak terpengaruh. `smtp_sender_name` yang terpenting secara
kasatmata: pelanggan melihat nama itu di inbox.

**Temuan yang tak terduga:** PATCH dengan `password_hibp_enabled: true` dijawab

```
HTTP 402 — Configuring leaked password protection via HaveIBeenPwned.org
           is available on Pro Plans and up.
```

Dan karena PATCH Management API bersifat **atomik**, satu field berbayar itu
menolak seluruh permintaan — ketiga setelan lain ikut gagal tanpa jejak sampai
dibaca ulang. Pelajarannya untuk perubahan config berikutnya: pisahkan field
yang mungkin ber-gate plan, dan SELALU baca ulang dari server alih-alih
memercayai kode 2xx.

**Ditolak — menurunkan butir HIBP menjadi peringatan.** Menggoda, karena butir
GAGAL yang tak bisa dikerjakan membuat daftar tak pernah mencapai nol dan
orang berhenti membacanya. Tetapi ini celah keamanan nyata DAN jalannya ada:
Supabase Pro sudah wajib di Fase 5 sebelum klien berbayar pertama. Yang salah
bukan status GAGAL-nya, melainkan pesannya — ia berbunyi "harap true" seolah
ada toggle yang tinggal diklik, sehingga pemilik akan mencarinya di dashboard
Auth dan tak menemukan apa pun. Pesannya kini menyebut Pro dan Fase 5.

**Konsekuensi:** `ops:verify` turun dari 9 GAGAL menjadi 7. Yang tersisa:
`NEXT_PUBLIC_SENTRY_DSN` (butuh rebuild), MX `merriva.id`, HIBP (butuh Pro),
dan empat cron yang belum terpasang di Easypanel.

---

## #96 — 2026-10-17 · Bentuk `NEXT_PUBLIC_MEDIA_URL` dijaga; dan kode mati yang tak satu pun gerbang lihat

**Keputusan:** (1) `periksaPasanganMedia` mendapat aturan BENTUK yang berjalan
untuk SEMUA driver, kode `media-url-tak-sah`; (2) `/api/health` ikut
memancarkan `driver`; (3) `allowUnreachableCode: false` di tsconfig dan
`scripts/**` tak lagi diabaikan ESLint, dengan `no-unreachable` dkk diminta
eksplisit di sana.

**Alasan (1) — basis tanpa skema lolos gerbang, lalu memadamkan semuanya.**
`getMediaBaseUrl()` hanya memeriksa string KOSONG. Nilai seperti
`cdn.merriva.id` lolos utuh: `new URL()` melempar → `rutenyaMilikSendiri`
menjawab `false` → `periksaPasanganMedia` mengembalikan `null` → `/api/health`
menjawab **200**. Peramban lalu menyelesaikannya RELATIF terhadap halaman
undangan — `https://merriva.id/cdn.merriva.id/inv/a/1600.webp` — sehingga setiap
foto, lagu, dan gambar OG menjawab 404 polos tanpa satu pun exception.

Bukan skenario karangan: `docs/MUSIC-LIBRARY.md` menuliskannya persis tanpa
skema, dan itu dokumen yang dibuka untuk tugas PERTAMA pasca-cutover R2
(mengunggah ulang enam lagu). Dokumennya ikut dibetulkan.

Aturannya berjalan SEBELUM short-circuit `driver === "local"`, karena basis yang
rusak merusak ketiga driver sama rata — `getPublicUrl()` hanya merangkai string.
Dan protokolnya ikut diperiksa, bukan hanya "bisa di-parse": `new URL(
"cdn.merriva.id:8080")` TIDAK melempar (titik sah di nama skema), jadi tanpa itu
bentuk berport lolos sementara saudaranya tanpa port tertangkap — lubang yang
lebih buruk daripada tak memeriksa, karena ia tampak sudah dijaga.

**Alasan (3) — satu kode mati, dua lapis kebutaan.** Commit `b194f69` menaruh
`return basisMedia;` di tengah `periksaSitus()`, sehingga pemeriksaan
**identitas pelaku usaha** (PP 80/2019) di `ops:verify` tidak pernah berjalan
selama dua hari. Ketiadaannya tak terlihat: baris yang absen di laporan tampak
seperti ketiadaan, bukan seperti kegagalan.

Yang membuatnya pantas dicatat bukan bug-nya, melainkan bahwa **tak satu pun
gerbang bisa melihatnya** — dan sebabnya dua, yang masing-masing menyandarkan
diri pada yang lain:

- ESLint: `scripts/**` ada di `globalIgnores`, DAN `no-unreachable` tak pernah
  aktif sama sekali — `eslint-config-next` tidak memuat `eslint:recommended`,
  sementara untuk berkas TS typescript-eslint MEMATIKANNYA dengan alasan "tsc
  yang menangani".
- tsc: tanpa `allowUnreachableCode: false`, TypeScript memperlakukan kode
  tak-terjangkau sebagai *suggestion* — abu-abu di editor, **senyap** di
  `tsc --noEmit`. Dibuktikan dengan berkas probe: tanpa flag itu nol galat,
  dengan flag `error TS7027`.

Jadi "tsc yang menangani" adalah asumsi yang tak pernah benar di repo ini, dan
lubangnya berlaku untuk SELURUH `src/`, bukan hanya skrip. Keduanya kini
ditutup, dan masing-masing dibuktikan dengan menyisipkan ulang bug yang sama.

**Ditolak — menaruh validasi bentuk di `getMediaBaseUrl()`.** Pelajaran #82,
sudah dua kali dihindari: fungsi itu dipanggil per-render lewat `getPublicUrl()`,
jadi melempar di sana mengubah halaman TERDEGRADASI (teks tampil, gambar 404)
menjadi halaman MATI (500) bagi setiap tamu — dan karena lazy, container tetap
lolos healthcheck. Tempat yang benar adalah health, yang membuat image tak cocok
GAGAL healthcheck sehingga tak pernah menerima trafik.

**Konsekuensi:** `ops:verify` kembali memeriksa identitas pelaku usaha (hijau —
terbukti tayang di `/syarat`), dan akan menampilkan `driver storage` begitu
produksi dibangun ulang; sampai itu ia melaporkan "tak dilaporkan health (image
lama?)", bukan merah palsu. Butir checklist Fase 8 yang masih menyebut identitas
pelaku usaha "string kosong" dikoreksi — isinya sudah lengkap sejak 15 Okt, dan
checklist yang salah tentang kesiapan hukum lebih berbahaya daripada butir yang
hilang.

---

## #97 — 2026-10-20 · Sentry v11: `beforeSendTransaction` mati, dan default PII dibalik

**Keputusan:** `@sentry/nextjs` dinaikkan ke 11.8.0 BERSAMA migrasinya dalam
satu commit. Tiga berkas init menyetel `traceLifecycle: "static"` dan baseline
`dataCollection` eksplisit (`SENTRY_DATA_COLLECTION` di `lib/sentry-scrub.ts`);
`next.config.ts` mengimpor dari `@sentry/nextjs/config` dan menukar
`disableLogger` dengan `bundleSizeOptimizations.excludeDebugStatements`.

**Alasan — yang dilihat CI adalah masalah paling kecil.** Satu-satunya
kegagalan yang terlihat gerbang adalah `TS2305: no exported member
'withSentryConfig'`. Dua perubahan yang sesungguhnya berbahaya tak menyentuh
satu test pun, dan keduanya menyerang **DECISIONS #46**:

1. **`beforeSendTransaction` NO-OP.** v11 menjadikan span streaming default.
   Panduan migrasi resmi di tag 11.8.0 menyatakannya dua kali: *"The
   `beforeSendTransaction` and `ignoreTransactions` options will **no-op**"*
   (baris 331) dan *"`beforeSendTransaction` no-ops because no transaction
   events are produced"* (baris 439). Penapis token tamu dipasang di
   `beforeSend` DAN `beforeSendTransaction`; yang kedua akan diam tanpa satu
   pun galat, dan `?g={token}` lolos ke atribut span.
2. **Default `dataCollection` dibalik.** v11 mengganti `sendDefaultPii`
   dengannya dan membuat default-nya LEBIH PERMISIF: *"Set the baseline
   explicitly. **Don't leave `dataCollection` unset** — that now enables
   broader collection"* (baris 212). Yang ikut terkumpul bila dibiarkan: IP
   tamu, cookie, header, dan badan request/response.

Keduanya diverifikasi dari sumber primer (`MIGRATION.md` di tag 11.8.0),
bukan dari ringkasan — sebelumnya ada klaim turunan yang ternyata keliru.

**Ditolak:**

- **Port ke `beforeSendSpan` + `ignoreSpans` sekarang.** Itu jalur yang
  direkomendasikan Sentry untuk jangka panjang, tetapi memindahkan logika
  KEAMANAN ke bentuk callback baru pada commit yang sama dengan bump mayor
  adalah dua perubahan berisiko yang saling menutupi. `traceLifecycle:
  'static'` adalah opt-out RESMI (*"Opting out of span streaming"*, baris 513)
  dan TIDAK ditandai deprecated. Port-nya ditunda, sadar.
- **`webpack.treeshake.removeDebugLogging`,** yang justru ke sanalah tabel
  migrasi memetakan `disableLogger`. `next build` repo ini tanpa flag bundler
  = Turbopack (default Next 16), dan JSDoc paketnya sendiri menyebut opsi
  top-level `bundleSizeOptimizations` *"works for both webpack and Turbopack
  builds"* sementara yang di bawah `webpack.*` tidak. Mengikuti tabel begitu
  saja menghasilkan typecheck hijau dengan statement debug tetap ikut ke
  bundel halaman undangan.
- **Menyaring `event.user` di `scrubSentryEvent`.** Disarankan audit, tetapi
  repo ini tak pernah memanggil `setUser` — satu-satunya sumbernya
  `requestDataIntegration`, yang sudah dimatikan `userInfo: false`. Penapis
  tanpa sumber hanya menambah kode yang tak pernah dieksekusi.

**Waktunya disengaja.** DSN produksi masih kosong, jadi `Sentry.init` tak
pernah berjalan dan migrasi ini mengubah NOL perilaku runtime hari ini.
Jendela itu tertutup saat pemilik mengisi DSN — memigrasi sesudahnya berarti
menukar dua variabel sekaligus pada SDK yang belum pernah terbukti mengirim
apa pun.

**Konsekuensi:** `tests/unit/sentry-init-config.test.ts` (baru) mengunci
KONFIGURASInya, bukan penapisnya — `sentry-scrub.test.ts` sudah membuktikan
penapis bekerja, dan v11 menunjukkan itu tak cukup: penapis sempurna bisa
terpasang rapi dan tak pernah dipanggil. Dibuktikan dengan mutasi: menghapus
`traceLifecycle` → `Expected "static", Received undefined`; menghapus
`dataCollection` → satu test merah. Keduanya sebelumnya tak memerahkan apa pun.

**Ronde dependensi yang sama** juga membawa patch keamanan `next`
16.4.0→16.4.2 (PR #9), yang melewati **16.4.1**: GHSA-p3m5-59mp-jv5r, High,
CVSS 8.2, DoS App Router + Server Actions, *"No workaround exists besides
upgrading"* — produksi sedang terkena. Dua advisory Critical pada versi yang
sama diperiksa dan TIDAK berlaku: nol pemakaian `use cache`, dan optimizer
gambar mati (`images.unoptimized: true`; probe nyata `/_next/image` di
produksi menjawab 404). Rate limit aplikasi tidak meredam DoS itu — ia
dipanggil dari DALAM badan Server Action, jadi CPU sudah terbakar sebelum
gerbangnya tercapai.

---

## #98 — 2026-10-21 · Poll pembayaran tak pernah mengirim `txn_id`; dan gerbang bundel mengukur bentuk yang salah

**Keputusan:** enam perbaikan dari audit "apa selanjutnya" (4 lensa + 4 skeptik).
Dua di antaranya mengubah hal yang sebelumnya tak terlihat gerbang mana pun.

**1 — `PendingOrder.txn_id` jadi WAJIB (boleh `null`).**

Ketiga aksi poll "cek status pembayaran" tak pernah mengirim `txn_id`, dan
bahkan tak men-`select` kolomnya. Sejak API v2 status transaksi berkunci
`txn_id`, jadi `verifyTransaction` melempar `PakasirError(transient=false)` →
`verify_broken` → `{status:"error"}`. **Deterministik.** Pelanggan yang sudah
membayar mendapat error, bukan undangan aktif.

Jalur aktivasi otoritatif KEDUA — yang ada persis untuk saat pelanggan kembali
dari Pakasir sebelum webhook tiba — rusak 100%. Webhook dan kedua pass cron
mengirimnya dengan benar; hanya poll yang terlewat saat migrasi v2 (commit
`fccde12`), karena kuncinya masih **opsional**.

Yang membuatnya licin: **webhook sehat menutupinya.** Poll early-return begitu
undangan `active`, jadi uji "bayar production nominal kecil" di Fase 7 akan
LULUS. Bug-nya baru muncul pada pelanggan pertama yang webhook-nya telat — dan
cron backstop belum terjadwal.

Dan tiga test menguncinya: `toHaveBeenCalledWith` mencocokkan objek TEPAT, jadi
assertion-nya bukan sekadar melewatkan bug — ia **menolak perbaikannya**.
(Ketiga kalinya pola ini muncul; lihat #93, #96.)

Obatnya kunci WAJIB-TAPI-NULLABLE, bukan `string` polos: ada kontrak sah untuk
order tanpa transaksi, dan `null` eksplisit membuat "pemanggil lupa" tak bisa
menyamar sebagai "order ini memang belum punya transaksi". tsc menemukan tepat
tiga pemanggil produksi — bukti tak ada yang keempat.

**2 — Gerbang anggaran bundel mengukur bentuk yang bukan produksi.**

CI sengaja build tanpa DSN Sentry. Diukur bersebelahan lewat `docker build`:

| build | SHELL (gz) |
|---|---|
| tanpa DSN (yang diukur CI) | 133,9 KB |
| dengan DSN (produksi nanti) | **181,9 KB** |

**+48 KB gz di SETIAP halaman**, termasuk halaman undangan tamu yang
entry-nya sendiri hanya 48 KB gz. CI hijau, produksi 36% lebih berat. CI kini
membangun dengan DSN **boneka** — literal, bukan secret, dan tanpa
`SENTRY_AUTH_TOKEN` ia tak mengirim apa pun.

Sekalian: app shell (`rootMainFiles`) tak pernah diukur sama sekali — tabel
hanya membaca `entryJSFiles` per-route. Kini ia baris BERGERBANG SENDIRI,
bukan ditambahkan ke tiap route (menjumlahkannya akan menyembunyikan
pertumbuhan per-route). `polyfillFiles` dilaporkan tapi tidak digerbangi:
terbukti ber-atribut `noModule`, jadi peramban modern tak mengunduhnya.

**4 perbaikan lain:** rem ledakan Sentry per-area di `reportHandledError`
(105 pemanggil, 24 di jalur tamu — satu resepsi 300 tamu bisa mengirim ratusan
event; yang tertahan menumpang event berikutnya, tidak hilang) · `/api/health`
melaporkan keberadaan `CRON_SECRET` sebagai boolean · skip E2E yang SENYAP
dibuat bersuara (runner tak pernah memuat `.env.local`, jadi `pnpm test:e2e`
keluar 0 tanpa menjalankan apa pun) · prosedur rollback di RUNBOOK, yang
sebelumnya tak punya satu kalimat pun tentang mundur.

**Ditolak:** build CI KEDUA berisi DSN boneka — melipatduakan waktu CI
selamanya demi satu cabang konfigurasi; menukar DSN pada build yang ada sudah
cukup. · Menumpang Map milik `lib/rate-limit.ts` untuk rem Sentry — eviction-nya
membuang bucket berisi paling sedikit, jadi bucket galat yang MELEDAK justru
bertahan sambil mengusir penghitung rate-limit tamu. · Dependensi `dotenv` baru
untuk E2E — sepuluh baris `node:fs` cukup.

---

## #99 — 2026-10-25 · Pakasir tutup; pindah ke BinderPay (SNAP), QRIS saja

**Keputusan:** pindahkan jalur uang dari Pakasir ke **BinderPay** dengan API
**SNAP** (Standar Nasional Open API Pembayaran, standar Bank Indonesia), kanal
**QRIS saja**. Potongan pertama yang dikerjakan BUKAN drivernya, melainkan modul
tanda tangan `src/lib/payment/binderpay-signature.ts` — lihat "Urutan" di bawah.

**Ini bukan preferensi, ini tenggat.** Pemilik memberi tahu bahwa **Pakasir
tutup bulan depan**. Jadi pertanyaannya bukan "apakah pindah sepadan", melainkan
"mana yang paling tidak berbahaya untuk dipindahi dalam waktu sempit". Dua
kandidat dinilai: WijayaPay dan BinderPay. Akun merchant pemilik sudah disetujui
di keduanya, jadi tak ada biaya peralihan yang membedakan.

### Kenapa BinderPay, bukan WijayaPay

Tiga alasan, dua di antaranya saya verifikasi sendiri alih-alih memercayai
materi pemasaran:

1. **Halaman legal WijayaPay tidak ada.** `/syarat-ketentuan`,
   `/kebijakan-privasi`, dan `/contact` ketiganya menjawab **404**; padanan
   BinderPay ketiganya **200**. Untuk pihak yang akan memegang uang pelanggan
   kita, ketiadaan syarat & ketentuan bukan soal kerapian — ia menghilangkan
   satu-satunya dokumen yang menyebut kewajiban mereka saat ada sengketa.
   Kita sendiri baru saja menjadikan identitas pelaku usaha sebagai gerbang
   rilis (DECISIONS #88); memakai penyedia yang tak memenuhinya akan ganjil.
2. **SNAP adalah standar Bank Indonesia, bukan dialek satu vendor.** Bila
   BinderPay kelak bermasalah, penerus yang juga SNAP memakai bentuk tanda
   tangan dan amplop yang sama — modul tanda tangan kita ikut pindah. API
   WijayaPay bentuknya milik sendiri; pindah dari sana berarti mulai nol lagi.
   Setelah baru saja terjebak vendor yang tutup, itu bukan pertimbangan kecil.
3. **WijayaPay menaruh `api_key` di QUERY STRING** pada endpoint cek status
   (`GET /api/get-status?code_merchant=..&api_key=..&ref_id=..`). Itu endpoint
   yang paling sering kita panggil — poll tiap ~4 detik — dan setiap
   kegagalannya mendarat di `reportHandledError`, artinya kunci API ikut
   mengalir ke Sentry. Penyaringnya sudah kita pasang (commit `8fcade9`), tetapi
   aturan "jangan taruh rahasia di URL" tak pernah bisa kita paksakan pada pihak
   ketiga; lebih baik tidak memilih pihak yang melanggarnya sejak awal.

### Yang sudah diverifikasi, bukan diasumsikan

- **Kunci publik produksi BinderPay berukuran 1023 bit**
  (`openssl rsa -pubin -text -noout` → `Public-Key: (1023 bit)`). Di bawah
  ambang yang layak, dan ganjil — RSA biasanya 2048. Konsekuensinya tercatat di
  bawah; singkatnya, ini memperkuat aturan yang sudah kita pegang dan tidak
  mengubah apa pun pada arsitektur.
- **Bentuk string-to-sign:** `{METHOD}:{endpointPath}:{sha256hex(body)}:{timestamp}`,
  bodi di-hash SHA-256 hex huruf kecil, hasil akhir RSA-SHA256 lalu Base64.
  Sudah dikunci test (21 test, pasangan kunci dibuat di dalam test — tanpa akun,
  tanpa jaringan).
- **String itu tak bisa dipecah dengan `split(":")`**: stempel waktunya sendiri
  memuat titik dua, jadi hasilnya enam bagian, bukan empat. Tak menjadi masalah
  saat merakit, tetapi menyesatkan saat membandingkan dengan string milik mereka
  ketika men-debug penolakan.

### Lima pertentangan di dokumentasi mereka — dan kenapa drivernya ditunda

Dokumentasi BinderPay membantah dirinya sendiri di lima tempat. Tiga pertama
tidak berbahaya; **dua terakhir menyentuh jalur uang**:

| # | Pertentangan | Akibat bila ditebak salah |
|---|---|---|
| 1 | Kebijakan ulang-kirim callback: "3 retries" vs "1,5,15,30,60 menit sampai 5 kali" | kosmetik; memengaruhi penalaran idempotensi saja |
| 2 | Contoh nilai `X-Signature` berbentuk JWT (`eyJhbGciOiJSUzI1NiIs`), bertentangan dengan Base64 RSA-SHA256 | contoh yang salah; bentuk sebenarnya sudah dikunci test |
| 3 | `contractId` dijelaskan sebagai "ID kontrak merchant" DAN "kode referensi untuk request terkait" | **ia kandidat `txnId` kita yang wajib non-null** |
| 4 | `feeAmount` **550** di satu contoh, **1000** di contoh lain, untuk transaksi yang sama | nominal yang dibandingkan meleset |
| 5 | **`amount` berarti hal berbeda per endpoint**: `qr-mpm-generate` → `50550.00` (sudah termasuk fee), `qr-mpm-query` → `50000.00` (asli), callback → `35490` | **lihat di bawah** |

Pertentangan #5 menabrak langsung `src/server/payment/reconcile.ts:112`:

```ts
if (verification.amountIdr !== order.amount_idr) { … return { kind: "mismatch" }; }
```

Kesetaraan **ketat** itu adalah penjaga yang menghentikan orang membayar
Rp10.000 untuk paket Rp199.000. Bila `qr-mpm-query` ternyata mengembalikan
nominal ber-fee, penjaga ini menolak **setiap** pembayaran yang sah. Bila kita
melonggarkannya lebih dulu "untuk aman", penjaga itu berhenti berbunyi justru
pada kasus yang ia ada untuk menangkapnya. Kedua arah salahnya mahal, dan satu
panggilan sandbox menyelesaikannya.

**Karena itu driver, webhook, dan halaman QR sengaja BELUM ditulis.** Menulis
integrasi di atas dokumen yang membantah dirinya sendiri adalah cara termahal
untuk menemukan jawabannya: salahnya baru ketahuan pada pembayaran pelanggan
pertama.

### Urutan: kenapa tanda tangan lebih dulu

Tanda tangan adalah bagian yang paling mudah salah dan paling sulit
didiagnosis. Server menolaknya dengan pesan generik, dan "meleset satu karakter"
tak bisa dibedakan dari "kredensial salah". Dengan mengunci dan mengujinya lebih
dulu — sepenuhnya offline — saat sandbox menolak kita nanti, kita tahu bukan itu
sebabnya. Tiga jebakan ikut ditutup di sana: bodi di-hash sebagai string yang
BENAR-BENAR dikirim (fungsinya menerima string, bukan objek, supaya tak ada
serialisasi kedua), stempel waktu `+07:00` tanpa milidetik (`toISOString()`
memberi zona lain, milidetik, dan huruf Z — ketiganya mengubah string), dan
catatan bahwa webhook WAJIB membaca `req.text()`, bukan `req.json()`.

### Celah kontrak yang sudah pasti (bukan ambiguitas)

`CreatedPaymentLink.url` mengandaikan ada **halaman bayar hosted**. QRIS SNAP
memakai *Merchant Presented Mode*: `qr-mpm-generate` mengembalikan **string QR**,
bukan URL halaman — memang tak ada halaman untuk dituju. Jadi antarmuka
`src/lib/payment/types.ts` harus berubah saat drivernya masuk.

Kabar baiknya, ini **mengecilkan** pekerjaan, bukan membesarkannya: halaman
`/dashboard/undangan/[id]/bayar` sudah ada lengkap dengan auth, cek kepemilikan
RLS, status awal yang dihitung di server, dan `PaymentStatusPoller` yang baru
saja diperbaiki (#98). Yang kurang hanya merender QR dan hitung mundur di
halaman yang SUDAH mem-poll. Estimasi "berminggu-minggu" yang sempat saya
sebutkan salah, dan ini koreksinya.

### Riset sumber primer, sore 25 Okt 2026: empat dari lima pertentangan tutup

Setelah entri di atas ditulis, muncul kecurigaan yang layak diuji: SNAP
mendefinisikan tanda tangan *service request* sebagai **lima** komponen
ber-HMAC-SHA512 yang memuat access token. Bila itu berlaku, modul tanda tangan
yang sudah dikirim salah algoritma, salah kunci, dan kehilangan satu langkah
autentikasi — dan 21 testnya tak akan menangkapnya, karena test itu membuat
pasangan kuncinya sendiri dan hanya membuktikan modul konsisten dengan DIRINYA
SENDIRI. Itu bukan hal yang boleh diputuskan dari ingatan.

**Sumber yang memutuskan ternyata bukan dokumentasi, melainkan SDK resmi mereka**
(`binderpay-nodejs`) — kode yang benar-benar memanggil server mereka, jadi
bobotnya di atas prosa dan jauh di atas contoh JSON.

**Modul tanda tangan kita BENAR; tak ada yang diubah.** Cocok baris per baris:
`[method.toUpperCase(), endpointUrl, hashBody(minifiedBody), timestamp].join(":")`
dengan `createSign("RSA-SHA256")`, stempel waktu `+07:00` tanpa milidetik,
toleransi callback 300 detik, dan verifikasi callback empat komponen yang sama.
Kecurigaan lima komponen benar untuk SNAP **default**, tetapi ASPI mendefinisikan
dua jalur dan BinderPay memakai tipe 2, **"Asymmetric Signature without Get
Token"** — cabang resmi bernama, bukan penyimpangan. Winpay dan Faspay memakai
jalur yang sama. Jalur HMAC bahkan mustahil dibangun di sini: ia menuntut
`clientSecret` dan access token, dan BinderPay tak menerbitkan keduanya —
`HMAC`, `SHA512`, `Bearer`, `clientSecret`, `grant_type` nol kemunculan di docs
maupun di kedua SDK resmi mereka.

Yang ikut terkunci dari SDK, dan tak satu pun saya tebak sebelumnya:

| Hal | Kebenaran | Yang saya tulis semula |
|---|---|---|
| `CHANNEL-ID` | `"QRIS"` (daftar tertutup) | `"MERRIVA"` — karangan |
| Access token | tidak ada, tidak ada `Authorization` | (benar, tak ada) |
| `additionalInfo.isStatic` | **wajib**, boolean | tidak dikirim sama sekali |
| `merchantId` | tidak ada di tipe mereka | dikirim |
| Kunci query | `additionalInfo.contractId` (bersarang) | dibaca dari akar |
| `originalReferenceNo` | **tidak diterima** `qr-mpm-query` | dikirim sebagai kunci |

Catatan tajam: `referenceNo` **tidak ada sama sekali** di bagian QRIS BinderPay.
Konsensus tujuh PJP lain dan SNAP ASPI ("simpan `referenceNo`, kirim sebagai
`originalReferenceNo`") justru jawaban yang SALAH di sini — contoh bahwa standar
hanya memberi tahu apa yang mungkin mereka maksud, bukan apa yang mereka terima.

**Dua bahaya baru yang sebelumnya tak terlihat sama sekali:**

1. **`orders.txn_id` punya UNIQUE INDEX** (`20261013120000_orders_txn_id.sql`).
   Bila `contractId` ternyata "ID kontrak **merchant**" — salah satu dari empat
   rumusan dokumen mereka — nilainya konstan, dan **order kedua gagal dengan
   unique violation**; `terbitkanLink` mengembalikan `null` dan pelanggan tak
   bisa membayar sama sekali. Rancangan yang aman di kedua cabang: `txn_id` =
   `partnerReferenceNo` buatan kita (unik secara konstruksi, non-null, dan
   memang kunci yang diterima query), `contractId` di kolom terpisah yang
   nullable tanpa unique index.
2. **`X-EXTERNAL-ID` ditolak bila berulang di hari yang sama** (galat
   `4094700`), sementara halaman bayar kita mem-poll tiap ~4 detik — dan SDK
   vendor justru membangkitkan id **deterministik** (`qris-query-{ref}`). Salah
   satu dari keduanya pasti keliru. Bila aturan itu berlaku untuk query, poll
   kedua langsung gagal. Probe sekarang mengujinya dengan tiga panggilan.

**Yang TETAP tak terjawab, dan memang tak bisa dijawab dokumen:** arti `amount`.
BinderPay tak punya satu pun tabel spesifikasi response QRIS, dan dua contoh
mereka sendiri untuk transaksi yang IDENTIK saling membantah pada dua field
sekaligus (generate: `amount` 50550 + fee 550; query: `amount` 50000 + fee
1000). `feeAmount` tak pernah mereka definisikan di mana pun dan **tidak ada
sama sekali di tipe SDK** — jadi memulihkan nominal pokok dari callback mungkin
mustahil. Angka-angka contohnya pun tak cocok dengan tarif terbit mereka
sendiri (0,7%), tanda angka itu diketik tangan.

**Pengukuran yang menyelesaikannya tanpa menunggu siapa pun memindai QR:**
dekode `qrContent` sebagai EMVCo TLV dan baca **tag 54 (Transaction Amount)** —
itulah angka yang benar-benar ditagihkan ke pembayar. Probe sekarang
melakukannya (parsernya diuji terhadap QR dinamis, QR statis tanpa nominal, dan
masukan rusak). Ia juga menandai tag 55–57 (*convenience fee*), yang bila muncul
berarti model biaya ketiga yang tak terbaca dari dokumen mana pun.

**Gerbang nominal `reconcile.ts` tetap kesetaraan KETAT, apa pun hasilnya.** Yang
berubah hanya nominal mana yang driver isikan ke perbandingan itu — satu cabang
yang ditetapkan probe, bukan dipilih saat runtime. "Terima bila salah satu
cocok" tetap ditolak: itu persis melubangi penjaga bayar-kurang.

**Probe versi pertama akan pulang "sukses" tanpa menguji apa pun.** Karena
`contractId` dibaca dari akar, nilainya `undefined`, dan ternary di bawahnya
melewati panggilan query sepenuhnya — ketiga pertanyaan dijawab "—" dengan
status keluar 0. Keenam cacatnya diperbaiki sebelum kredensial pertama dipakai;
kalau tidak, satu sesi sandbox terbuang pada perkakas yang berbohong.

**Ditolak:**

- **Tetap di Pakasir.** Bukan pilihan: mereka tutup. (Satu rekomendasi
  "tetap-pakasir" sempat muncul dari agen peninjau — ia dijalankan sebelum
  pemilik menyebut penutupan itu, jadi premisnya basi. Dicatat di sini supaya
  tak muncul lagi sebagai "tapi dulu pernah disarankan".)
- **Menulis driver sekarang di atas asumsi,** lalu memperbaikinya setelah
  sandbox. Ditolak karena asumsi yang salah pada #4/#5 tidak gagal keras: ia
  gagal sebagai penolakan pembayaran yang sah, atau sebagai penjaga yang diam.
- **Melonggarkan gerbang nominal menjadi "terima salah satu"** (asli ATAU
  ber-fee). Itu membuang satu-satunya pertahanan terhadap pembayaran kurang
  bayar demi menghindari satu panggilan probe.
- **Menyimpan kunci privat sebagai path berkas.** Diganti PEM ter-base64 di env:
  satu mekanisme yang sama persis di dev dan di panel Easypanel, dan PEM mentah
  mengandung baris-baru yang tak selamat melewati kolom env.
- **Memaku kunci publik BinderPay di kode.** Rotasi di sisi mereka akan menuntut
  rilis dari kita; ia env.

**Konsekuensi:**

- **Kunci 1023-bit itu tidak mengubah arsitektur, hanya menegaskannya.**
  Aktivasi kita memang sudah tak pernah bergantung pada tanda tangan callback:
  payload webhook = sinyal, bukti datang dari cek status otoritatif (SPEC §4.8,
  CLAUDE.md). Kalau arsitekturnya tidak begitu, temuan ini akan menjadi
  penghalang rilis.
- Empat variabel baru ada di `.env.example` tetapi **sengaja belum masuk**
  `scripts/env-manifest.mjs`: di sana ada test "entri yatim" yang menolak
  variabel yang belum dibaca kode mana pun. Keduanya didaftarkan bersamaan saat
  driver masuk.
- **Masa dua-gateway.** Order lama tetap diverifikasi lewat Pakasir sampai
  lunas/kedaluwarsa; order baru lewat BinderPay. `getPaymentGateway()` adalah
  seam-nya.
- **TERJAWAB 27 Okt 2026 — tak ada dana menggantung, dan memang tak pernah ada.**
  Pemilik memastikan tidak ada dana yang belum di-settle. Diperiksa sendiri di
  produksi dan cocok: dari empat baris `orders`, satu-satunya yang `paid`
  adalah `MRV-E6GKXZ` dengan **nominal 0 dan `txn_id` NULL** — itu aktivasi
  gratis jalur admin/Pro (#bc2585a), bukan pembayaran. Tiga sisanya (199rb,
  199rb, 99rb) `pending` dan tak pernah dibayar. Jadi **belum pernah ada satu
  rupiah pun melewati Pakasir**: tak ada rekonsiliasi, refund, atau sengketa
  yang perlu dijaga saat berpindah.
- **Pakasir TIDAK dihapus sekarang** (keputusan pemilik, 27 Okt 2026). Ia tetap
  hidup sampai driver BinderPay terbukti jalan, lalu keduanya ditukar dalam
  SATU peralihan. Alasannya bukan dana — melainkan agar tak ada jendela waktu
  ketika pelanggan tak punya jalur bayar sama sekali, dan agar tak ada kode
  yang dihapus lalu ditulis ulang. Aktivasi admin/Pro tak terpengaruh apa pun:
  ia gratis dan tak pernah menyentuh gateway.
- Pekerjaan berikutnya terkunci pada kredensial sandbox
  (`BINDERPAY_PARTNER_ID`, `BINDERPAY_BASE_URL`, `BINDERPAY_PRIVATE_KEY_B64`,
  `BINDERPAY_PUBLIC_KEY_B64`). `scripts/probe-binderpay.mjs` menyelesaikan
  pertentangan #3, #4, dan #5 dalam satu kali jalan begitu keempatnya terisi.
- **Isian proyek di dashboard BinderPay (30 Okt 2026).** URL Callback =
  `https://merriva.id/api/webhooks/binderpay`, mengikuti
  `/api/webhooks/pakasir` (`/webhook` jatuh ke route undangan `/[slug]` dan
  justru slug terlarang). Route-nya lahir bersama driver; sebelum itu callback
  menjawab 404, yang aman selama belum ada transaksi BinderPay.
  **Path itu TIDAK ikut ditandatangani:** callback QRIS ditandatangani dengan
  path SNAP tetap `/v1.0/qr/qr-mpm-notify` (binderpay.id/docs "Signature
  Callback Validation"; `verifyCallbackSignature` di kedua SDK resmi).
  Memverifikasi dengan `new URL(req.url).pathname` akan menolak SETIAP callback
  yang sah.
- **Whitelist IP sengaja KOSONG.** Kolomnya opsional dan tak dijelaskan di
  dokumentasi maupun kedua SDK; tak ada pula kode galat soal IP. API mereka di
  belakang Cloudflare dan punya AAAA, jadi IP mana yang mereka lihat dari VPS
  (`72.61.213.237`, atau IPv6) belum pasti. Isian yang salah menggagalkan
  SETIAP panggilan dengan galat generik — tak terbedakan dari tanda tangan atau
  kredensial yang salah, jebakan yang sama yang dicatat di atas — dan akan
  memblokir probe sandbox yang dijalankan dari mesin lokal. Setiap permintaan
  sudah ditandatangani kunci privat kita. Pertimbangkan mengisinya SETELAH
  driver hidup di produksi, lalu uji satu transaksi segera sesudahnya.

### Probe sandbox 30 Okt 2026 — jawaban terukur

Empat jalan `scripts/probe-binderpay.mjs` ditambah satu pembayaran lewat
**Payment Simulator** di dashboard sandbox, lalu status transaksinya dibaca
ulang lewat `qr-mpm-query`.

- **Tanda tangan, kunci, dan Partner ID diterima** (HTTP 200 di generate &
  query). Modul tanda tangan kini terbukti terhadap server sungguhan, bukan
  hanya konsisten dengan dirinya sendiri.
- **#3 `contractId`:** ada di `additionalInfo.contractId`, dan BERBEDA per
  transaksi (`bp-sandbox-<uuid>`) — bukan konstanta merchant, jadi aman
  disimpan per order. Query menuntutnya bersama `originalPartnerReferenceNo`.
- **#4 `feeAmount`:** 70 untuk nominal 10.000 (0,7%, cocok tarif terbit), sama
  di generate & query. Angka 550/1000 di dokumen hanyalah contoh ketikan.
- **#5 `amount`:** generate → `10070.00` (pokok + fee); query → `10000.00`
  (pokok), **sebelum maupun sesudah lunas**. Transaksi yang disimulasikan
  (`PROBE-1793366300046-B`) menjawab status `00` "Success", `paidTime`
  terisi, `rrn` `SANDBOX-…`, dan `amount` tetap `10000.00`. Driver karenanya
  membandingkan **`amount` dari query** dengan `orders.amount_idr`; gerbang
  `reconcile.ts` tetap kesetaraan ketat. Nominal dari generate akan menolak
  setiap pembayaran yang sah.
- **X-EXTERNAL-ID:** id berulang di hari yang sama ditolak `409`
  `4095100 "Duplicate X-EXTERNAL-ID for today"`. Poller WAJIB membangkitkan id
  segar tiap panggilan; id deterministik ala SDK vendor gagal sejak poll kedua.
- **`qrUrl`** adalah gambar SVG kode QR di domain vendor, bukan halaman bayar:
  tanpa nominal, tanpa tombol kembali. QR tetap ditampilkan di
  `/dashboard/undangan/[id]/bayar` (ia bisa menjadi `<img>` tanpa pustaka QR,
  asalkan CSP `img-src` mengizinkan domainnya).
- Status query: `01` Initiated, `00` Success. Kode sukses: generate
  `2004700`, query `2005100`. Jawaban memuat `buyerReff: "winpay"` —
  BinderPay berjalan di atas Winpay.
- Pada satu dari empat jalan, dua query gagal TANPA kode SNAP (output mentahnya
  tak tersimpan) dan tak terulang di dua jalan berikutnya. Poller harus
  memperlakukan jawaban tanpa `responseCode` sebagai transien.
- Ringkasan probe sempat melaporkan 409 di atas sebagai "jawaban diterima",
  karena setiap jawaban JSON dianggap sukses. Kini dinilai dari `responseCode`.

**Yang BELUM terukur:**

- **Siapa menanggung fee 0,7%.** QR sandbox adalah TIRUAN (TLV terpotong di
  tag 26, tanpa tag 54 dan CRC), dan simulator menampilkan "Rp 10.000". Bila
  di produksi pembayar ditagih pokok + fee, pelanggan membayar Rp200.393 untuk
  paket Rp199.000 — itu keputusan bisnis, dan biayanya wajib tampil SEBELUM
  bayar. Butuh konfirmasi BinderPay atau satu QR produksi yang dibaca tag 54-nya.
  Keputusannya diambil 31 Okt 2026 — lihat subbagian berikut.
- **Isi callback.** Simulator mengirim callback ke URL proyek, tetapi route-nya
  belum ada (404), jadi bentuk `amount` di callback dan path tanda tangan
  `/v1.0/qr/qr-mpm-notify` masih berasal dari dokumen, belum terukur. Aktivasi
  tak bergantung padanya: bukti lunas tetap dari query.

### Fee ditanggung merchant (keputusan pemilik, 31 Okt 2026)

**Keputusan:** pelanggan membayar **persis** harga paket; fee kanal ditanggung
merchant (SPEC §4.8, termasuk kriteria terimanya).

**BinderPay tak punya tombolnya.** Halaman harga (`binderpay.id/price`) hanya
menyebut QRIS 0,7%, settlement H+1 hari kerja; dokumentasi diam soal siapa
menanggung. Request `qr-mpm-generate` tak punya parameter fee, dan kata "fee"
muncul NOL kali di kode sumber kedua SDK resmi. Jadi penyerapannya terjadi di
sisi kita.

**Diukur di sandbox:**

- `fee = round(0,7% × pokok)` — pembulatan biasa ke rupiah, bilangan bulat
  (10.071 → 70 karena 70,497; 10.072 → 71 karena 70,504). Nominal QR =
  pokok + fee; `amount` query = pokok.
- Pokok yang diturunkan tepat sasaran: 197.617 → QR **199.000** (fee 1.383);
  98.312 → QR **99.000** (fee 688).

**Rancangan untuk driver** (tanpa kolom baru):

- Kirim pokok `P` = nilai TERBESAR dengan `P + round(0,007·P) ≤ harga`. Karena
  pembulatan, sebagian total terlewati; aturan "≤" memastikan pelanggan tak
  pernah membayar lebih dari katalog — paling buruk Rp1 lebih murah.
- `orders.amount_idr` tetap harga (yang dibayar pelanggan). Gerbang
  `reconcile.ts` membandingkan `amount` query dengan `P` yang dihitung ulang
  dari `amount_idr` lewat fungsi yang SAMA — tetap kesetaraan ketat.
- Biaya efektif per transaksi: Premium diterima 197.617, Basic 98.312.

**Terkonfirmasi 31 Okt 2026: pembayar ditagih pokok + fee.** Rincian transaksi
yang disimulasikan di dashboard sandbox (menu Transaksi) mencantumkan Jumlah
Rp10.000, Biaya Rp70, **Total Rp10.070** — cocok dengan `amount` generate
(nominal QR) dan `amount` query (pokok). Jadi rancangan di atas berlaku. Satu
hal yang belum diperiksa: saldo yang masuk di menu Mutasi (diharapkan sebesar
pokok). Itu tidak mengubah jaminan ke pelanggan, hanya angka "diterima" di
atas.

---

## #100 — 2026-10-26 · Admin & Pro tak pernah ditagih: peran `pro` + `activate_free_order`

**Keputusan (pemilik, 25 Okt 2026):** akun ber-peran `admin` tak pernah
diminta membayar, dan admin bisa memberi peran baru **`pro`** ke email terdaftar
dari dropdown peran yang sudah ada di `/admin/pengguna`. Untuk undangan
**miliknya sendiri**, admin/Pro mengaktifkan, memperpanjang, meng-upgrade, dan
membeli Album Momen tanpa Pakasir, langsung dengan paket/tier teratas.

Bentuknya, sengaja sekecil mungkin:

- Satu nilai enum `profile_role` baru. `profiles.role` sudah tak bisa ditulis
  klien (grant kolom, init_schema §6b), dan `is_admin()` tetap `role = 'admin'`
  saja, jadi Pro tak mendapat kuasa admin apa pun. Kini dijaga test DB.
- RPC `activate_free_order`: order Rp0 bermetode `gratis` + `activate_paid_order`
  dalam SATU transaksi (pola `admin_activate_invitation`). Hasilnya identik
  dengan aktivasi berbayar di keempat jalur (cabang aktivasi, upgrade, add-on
  sudah ada di RPC itu), dan tetap tercatat di riwayat pesanan.
- Di ketiga server action, cabang bebas-bayar menggantikan langkah Pakasir
  SETELAH semua syarat yang ada (status, purge, alamat, jadwal, paket, selisih
  harga, order add-on/upgrade yang menggantung).

**Alasan:**

- **Hanya undangan milik sendiri.** RLS memperlihatkan SEMUA undangan kepada
  admin; menurunkan "bebas bayar" dari peran saja berarti admin yang membuka
  undangan pelanggan memberinya Premium gratis tanpa jejak audit, dengan order
  atas nama admin yang tak pernah muncul di riwayat pelanggan. Diperiksa di
  action DAN di RPC.
- **SQL atomik, bukan dua panggilan dari server.** Order `pending` tanpa
  `txn_id` tak pernah di-expire cron. Gagal di antara insert & aktivasi akan
  meninggalkan order Rp0 yatim yang menahan halaman Album Momen/upgrade di
  poller pembayaran selamanya. Hasil selain `activated` (mis. `held`) di-raise
  → seluruh transaksi batal, tak ada order lunas tanpa efek.
- **Order Rp0, bukan aktivasi tanpa order.** Memakai ulang RPC aktivasi yang
  otoritatif (masa aktif, reset pengingat H-14, cabang upgrade/add-on) daripada
  menyalin logikanya — `reminder_sent_at` sudah dua kali hilang saat fungsi itu
  disalin ulang.

**Ditolak:**

- *Membebaskan berdasarkan peran saja* — lihat alasan pertama.
- *Melewati gerbang identitas merchant untuk admin/Pro* — kode mati (identitas
  sudah terisi) dan memecahkan test yang ada.
- *Menolak aktivasi gratis selama masih ada order Pakasir `pending`* — justru
  mengunci skenario yang memicu keputusan ini (admin yang sempat membuka
  Pakasir) sampai 24 jam, dan selamanya untuk order tanpa `txn_id`.
- *Mengubah `admin_month_revenue`* agar tak menghitung order Rp0 — lihat
  konsekuensi; dicatat, bukan ditambal.

**Konsekuensi:**

- **Risiko yang diterima:** pemilik yang sempat membuka Pakasir lalu menjadi Pro
  masih punya link bayar hidup sampai cron mengedaluwarsakannya (≤ 24 jam).
  Bila ia tetap membayarnya, RPC mengembalikan `held`: uang tercatat lunas tanpa
  efek dan perlu direfund manual. Untuk Album Momen & upgrade, order `pending`
  justru MENAHAN jalur gratis (penahan yang sudah ada, KUA-2a) sampai lunas atau
  kedaluwarsa — dan TANPA batas bila order itu tak punya `txn_id` (link gagal
  terbit): cron melewatinya dan poller berakhir di layar galat. Tak ada
  tombolnya di `/admin/order`; lepaskan lewat SQL
  `select * from public.expire_pending_order('<order_code>')`.
  **Ditutup 27 Okt 2026 oleh #101** — cron kini meng-expire sendiri order tanpa
  `txn_id`, jadi penahannya lepas dalam ≤ 24 jam tanpa SQL manual.
- Metrik admin: omzet tetap benar (Rp0), tetapi "N order lunas bulan ini" dan
  konversi draft→bayar ikut menghitung aktivasi gratis.
- Refund order Rp0 di `/admin/order` mencabut aktivasi gratis itu — berguna
  bila status Pro dicabut.
- Akun E2E pembayaran (`E2E_EMAIL`) wajib ber-peran `client`: admin/Pro tak
  pernah melihat pemilih paket berbayar.
- **Urutan rilis:** migrasi `20261026090000_peran_pro_aktivasi_gratis` WAJIB
  diterapkan ke Supabase cloud SEBELUM kode di-push — Easypanel membangun `main`
  paralel dengan CI, dan aksi admin/Pro memanggil RPC baru.

---

## #101 — 2026-10-27 · Order `pending` tanpa `txn_id` di-expire cron, bukan dibiarkan abadi

**Keputusan:** Pass 2 `/api/cron/expire-orders` memanggil `expire_pending_order`
untuk order `pending` berumur > 24 jam yang `txn_id`-nya `null`, alih-alih
menghitungnya lalu `continue`. Tanpa panggilan Pakasir apa pun. Penghitung
`tanpaTxn` tetap ada — ia mengukur seberapa sering penerbitan link gagal, dan
itu pertanyaan yang berbeda dari "berapa yang dibatalkan".

**Alasan:** `terbitkanLink` tidak pernah mengarahkan pelanggan bila `txn_id`
gagal tersimpan, jadi baris seperti ini **pasti tak pernah sampai ke tangan
siapa pun** — tak ada pembayaran yang bisa hilang. Yang hilang justru di sisi
sebaliknya: statusnya yang abadi menahan pembelian berikutnya. Penahan
`findPendingMomenOrder` (add-on) dan padanannya di jalur upgrade tak punya batas
umur, tak ada permukaan UI yang bisa membatalkan order `pending`, dan poller
halaman kelola terus menampilkan "menunggu pembayaran" atas transaksi yang tak
pernah ada. Satu galat jaringan Pakasir = upsell mati permanen untuk undangan
itu. Risikonya baru benar-benar terpapar sejak empat tier berbayar Album Momen
dibuka hari ini: jalur bayar Pakasir belum pernah dilewati satu rupiah pun, jadi
pelanggan pertama yang menekan "Pilih & bayar" adalah uji produksi pertamanya.

**Ditolak:**

- *Memakai ulang order `pending` di `createMomenCheckoutAction`* (seperti
  `createCheckoutAction` pada jalur undangan) — membuka kunci seketika, bukan
  ≤ 24 jam, tetapi lebih besar dan hanya menambal satu jalur:
  `findPendingMomenOrder` tak mengembalikan `package_id`/`amount_idr`, lookup
  paketnya ada SESUDAH gerbang, helper itu punya pemanggil kedua, dan cabang
  bebas-bayar sengaja ditaruh setelah gerbang. Lubang identik di jalur upgrade
  tetap terbuka. Masih layak dikerjakan kelak sebagai perbaikan UX; keputusan
  ini menutup kelasnya lebih dulu dengan tiga baris.
- *Ikut membatalkan ke Pakasir* — tak ada `txn_id` untuk dinamai. Panggilan
  dengan `order_code` saja hanya membakar plafon 2 permintaan/detik yang dipakai
  bersama poller pelanggan, untuk transaksi yang kemungkinan besar tak pernah
  lahir.

**Konsekuensi:** residual — bila kegagalannya terjadi SETELAH gateway membuat
transaksi (penulisan `txn_id` yang gagal), link Pakasir bisa tetap hidup
sementara order lokal sudah `expired`. Kelas residual yang sama sudah diterima
pada `cancelFailed`. Pembayaran atasnya tetap tak bisa diverifikasi (v2 berkunci
`txn_id`) dan karena itu tak mengaktifkan apa pun — tapi pelanggan tak pernah
menerima link itu untuk dibayar.

---

## Template entri baru

```
## #N — YYYY-MM-DD · [Judul keputusan]
**Keputusan:** ...
**Alasan:** ...
**Ditolak:** ... (alternatif + kenapa)
**Konsekuensi:** ... (bila ada dampak teknis/biaya yang harus diingat)
```
