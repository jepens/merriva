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

---

## Template entri baru

```
## #N — YYYY-MM-DD · [Judul keputusan]
**Keputusan:** ...
**Alasan:** ...
**Ditolak:** ... (alternatif + kenapa)
**Konsekuensi:** ... (bila ada dampak teknis/biaya yang harus diingat)
```
