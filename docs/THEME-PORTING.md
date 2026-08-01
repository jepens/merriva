# THEME-PORTING — Memasang 6 Prototipe ke Codebase Merriva

**Versi:** 1.0 — 31 Juli 2026 · Ditulis setelah membaca codebase aktual (`registry.ts`, `catalog-meta.ts`, `types/invitation.ts`, `_shared/motion.tsx`, `_shared/wedding-layout.tsx`, `themes/eternal-rose/*`, `package.json`).
**Sumber desain:** `prototypes/*.html` (6 file, teruji visual) + `docs/THEME-DESIGN.md`.
**Prompt eksekusi:** `PORTING-PROMPT.md` di root.

---

## 0. Prinsip pemasangan (baca dulu)

1. **Kontrak tema TIDAK berubah.** `ThemeComponentProps { data: InvitationData }` tetap; tema tetap dilarang fetch; visibilitas section tetap via `isSectionVisible(settings, …)`; `data.watermark`, `data.music`, `data.media` dipakai sebagaimana adanya. Prototipe hanya mengubah *rupa dan koreografi*, bukan data flow.
2. **Pola yang sudah ada dipertahankan dan ditumpangi**, bukan diganti: `ThemeRoot` (penanda `is-js`), `Reveal` IO, `Countdown` bersama, CSS ter-scope prefix per tema (`er-`, dst.), font via `next/font/google`, `WeddingLayout` untuk tema yang cukup CSS-only.
3. **Craft tanpa library** — tema tier Craft tidak boleh menyentuh gsap/lenis. **Story/Signature memuat gsap/lenis via `next/dynamic`/`import()` di dalam temanya saja** — bundle halaman tema Craft dan app shell tidak boleh membengkak (verifikasi dengan build output).
4. **Pelajaran terverifikasi dari prototipe (wajib diikuti):** state tersembunyi untuk mask-reveal **dimiliki JS** (`gsap.set(..., {visibility:'visible', yPercent:115})` lalu animate ke 0), **bukan** transform di CSS — mencegah elemen tersembunyi lagi setelah tween selesai. CSS hanya menyembunyikan via `visibility` di bawah kelas `is-js`+tier.
5. Satu tema per pass: port → `pnpm lint && pnpm typecheck && pnpm build` → cek `/preview/tema/{slug}` → commit → tema berikutnya. Jangan mem-port dua tema dalam satu commit.

## 1. Pemetaan prototipe → tema (rekomendasi default — konfirmasi ke pemilik bila ragu)

| Prototipe | Target | Aksi | Tier | Font (next/font/google) |
|---|---|---|---|---|
| `eternal-rose-signature.html` | `eternal-rose` (upgrade in-place) | Ganti art direction: **buang `Great_Vibes` (script)** → `Fraunces` + `Instrument_Sans`; cover gate; shader silk; kelopak | Signature | Fraunces, Instrument Sans |
| `midnight-frame-story.html` | `noir` (upgrade — meta dark-luxe `#14110f`/gold ✦ sudah searah) | Letterbox sinematik, scene cards, pan foto, credits | Story | Cormorant Garamond, Jost |
| `flora-atelier-story.html` | `verdant` (upgrade — meta botanical ❧ searah) | Wreath & ranting SVG draw-on-scroll, pressed cards, timeline titik | Story | EB Garamond, Karla |
| `family-warm-craft.html` | `festa` (upgrade — meta warm coral ✽ searah) | Stiker, polaroid, scallop, confetti saat buka | Craft | Bricolage Grotesque, Figtree |
| `mono-universal-craft.html` | `aria` (upgrade — meta minimal netral searah) | Section bernomor, whitespace ekstrem, aksen merah tunggal | Craft | Instrument Serif, Inter |
| `prisma-signature.html` | **`prisma` (TEMA BARU)** | Folder baru + baris registry + `catalog-meta` + seed DB (`categories: {corporate}`, tier premium) | Signature | Space Grotesk, Space Mono |

`meridian`, `barakah`, `lumina` tidak disentuh sekarang (di-upgrade belakangan dengan sistem yang sama). Slug tidak berubah → **tanpa migrasi data** untuk 5 upgrade; hanya `prisma` yang butuh seed baris `themes` baru.

## 2. Infrastruktur bersama baru (`src/themes/_shared/`)

Dibangun SEKALI di Fase A, dipakai semua tema Story/Signature:

**a. `use-motion-tier.ts`** — hook client: baca `prefers-reduced-motion`, `navigator.deviceMemory < 4 || hardwareConcurrency < 4`, dan `?rich=1` (override uji) → kembalikan `{ motionOn, richOn }`. Semua efek berat digerbangi ini.

**b. `gsap-motion.tsx`** — util Story/Signature: (1) `loadGsap()` = dynamic `import("gsap")` + `import("gsap/ScrollTrigger")` sekali (cache modul); (2) `useThemeMotion(rootRef, setupFn)` = jalankan `setupFn(gsap)` di dalam `gsap.context(...)` dengan **cleanup revert() saat unmount** (wajib — tema di-mount ulang di preview); (3) helper `maskLines(scope)` yang menerapkan pola §0.4 pada elemen `.line > span`; (4) inisialisasi **Lenis** (dynamic import juga) hanya bila `motionOn`, di-destroy saat unmount, `lenis.on('scroll', ScrollTrigger.update)`.

**c. `cover-gate.tsx`** — client component gerbang "Buka Undangan": kunci scroll (`overflow:hidden` di root tema, bukan `body` global — aman untuk halaman lain), tampilkan nama tamu (integrasikan dengan mekanisme personalisasi klien yang SUDAH ADA — survei `src/components/public/` dulu; jangan buat saluran kedua), tombol buka → callback `onOpen()` (tema memulai musik `data.music.url` lewat pemutar yang sudah ada / elemen `<audio>` tema, memulai kelopak/confetti, membuka scroll). Konten di balik gate tetap dirender server (SEO/ISR aman) — gate hanya lapisan visual `position:fixed`.

**d. `silk-canvas.tsx`** — komponen shader WebGL kecil (client, lazy): props `{ fragment: string, fallbackClassName: string, paused?: boolean }`; DPR cap 1.5, `powerPreference:'low-power'`, pause saat `document.hidden`, `try/catch` → fallback div gradient CSS selalu dirender di belakang. Fragment shader silk (plum/rose) dan aurora (violet/cyan/lime) disalin dari prototipe (±70 baris, sudah teruji).

**e. `particles-canvas.tsx`** — canvas 2D ringan dengan preset `petals` (eternal-rose: 24 partikel, alpha .14–.34) dan `confetti` (festa: burst 90 keping, auto-stop 3,5 dtk) — parameter persis dari prototipe; pause saat `document.hidden`.

## 3. Ketentuan per tema (ikuti section & koreografi di file prototipe masing-masing)

**Keputusan struktur:** tema yang koreografinya butuh markup baru (mask `.line>span`, nomor ghost, letterbox, ticket) memakai `sections.tsx` sendiri mengikuti pola `eternal-rose` yang sudah ada. Tema Craft yang cukup CSS + `Reveal` (aria, festa) **tetap memakai `WeddingLayout`/section bersama** bila memungkinkan — lebih sedikit kode; kalau markup bersama menghalangi (mis. scallop divider festa, polaroid), baru buat section sendiri. Putuskan per tema setelah membaca prototipenya.

- **eternal-rose (Signature):** cover gate + `SilkCanvas` (fragment silk) dimuat `next/dynamic` `ssr:false` dan HANYA saat `richOn`; kelopak mulai saat `onOpen`; mask-reveal per baris (pola §0.4); ornamen mawar SVG scrub-draw; galeri clip-inset reveal. `?rich=1` harus bekerja di preview. Hapus `Great_Vibes`.
- **noir ← midnight-frame (Story):** tanpa WebGL. Letterbox bar atas-bawah di cover gate (varian prop `coverStyle="letterbox"` di cover-gate atau markup lokal tema); pan foto `[data-pan]` scrub; wipe horizontal `clip-path` untuk frame; label "SCENE"; footer credits. Galeri pakai `data.media` dengan caption dari `content` bila ada.
- **verdant ← flora-atelier (Story):** semua SVG botani inline di `sections.tsx` (path disalin dari prototipe), draw via `strokeDashoffset` scrub; wreath cover menggambar saat entrance (sekali, bukan scrub); countdown bingkai dashed memakai `Countdown` bersama + CSS.
- **festa ← family-warm (Craft):** TANPA gsap/lenis. Pakai `Reveal` bersama + CSS transition (termasuk varian `pop` rotasi stiker — tambah kelas CSS, bukan library); confetti dari `particles-canvas` preset confetti saat `onOpen`; scallop divider CSS; polaroid galeri. Kategori: pastikan bekerja untuk `family` (cek skema `InvitationContent` kategori family untuk field anak/orang tua — JANGAN mengasumsikan field wedding).
- **aria ← mono-universal (Craft):** perubahan hampir seluruhnya CSS + struktur section bernomor; tanpa canvas apa pun; tetap paling ringan (jadikan pembanding bundle).
- **prisma (BARU, Signature, corporate):** folder `src/themes/prisma/` lengkap (index, sections, css, labels, demo-data mengikuti skema konten **corporate**), `SilkCanvas` fragment aurora, marquee ganda CSS, stats count-up (IO + rAF, dari prototipe), agenda dari `data.events` (waktu = `formatEventDateTime`), tiket RSVP membungkus `GuestbookSection` yang sudah ada (jangan buat form RSVP baru), barcode CSS. Tambah: baris `themeRegistry`, entri `catalog-meta` (`bg:#0A0A16, ink:#F2F2F7, accent:#D8FF5F, dark:true, ornament:"✦"`), entri `demo-data-registry`, dan **seed/migrasi baris `themes`** (`slug:'prisma'`, categories `{corporate}`, tier premium, aktif) untuk staging & production.

## 4. Dependensi & anggaran

`pnpm add gsap lenis` (keduanya MIT/gratis — GSAP free sejak 2025). Larangan: three.js, framer-motion baru, CDN runtime. Anggaran (gzip, halaman tema): Craft +0KB dari baseline; **Story ≤ +50KB** (revisi dari +45KB setelah pengukuran gzip nyata: gsap core ≈26,7KB + ScrollTrigger ≈17,1KB + lenis ≈5,2KB = ~49KB; ratifikasi pemilik 2026-08-01, lihat DECISIONS #12); Signature ≤ +90KB — cek `next build` output per route dan catat angkanya di PR/commit message.

## 5. Definition of Done per tema (dari THEME-DESIGN §5 + kenyataan repo)

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` hijau · `/preview/tema/{slug}` menyerupai prototipe (bandingkan berdampingan) · demo-data tiap tema diperbarui agar menampilkan kekuatan temanya · reduced-motion: konten lengkap tanpa animasi · tanpa JS: konten tetap terbaca (SSR utuh, pola `is-js`) · nol error konsol · `?rich=1` berfungsi (Signature) · Lighthouse mobile ≥ 90 di preview · uji nyata WebView WA Android + iOS minimal untuk eternal-rose & satu tema Craft · bundle route dalam anggaran §4.

## 6. Urutan eksekusi (fase — satu commit per tema)

**Fase A:** survei (§7) → `pnpm add gsap lenis` → bangun infra §2 → port **eternal-rose** (benchmark; paling lengkap) → verifikasi penuh DoD.
**Fase B:** `noir` lalu `verdant` (Story — memakai infra yang sama).
**Fase C:** `festa` lalu `aria` (Craft — tanpa gsap; buktikan bundle tidak berubah).
**Fase D:** `prisma` baru + seed + katalog. **Fase E:** sapu jagat — jalankan semua DoD lintas tema + perbarui `docs/DECISIONS.md` (entri baru: pemetaan & tanggal port) + tambah baris `docs/THEME-PORTING.md` di peta dokumen `CLAUDE.md`.

## 7. Survei wajib sebelum menyentuh kode (output: laporan singkat, bukan asumsi)

Baca dan laporkan: (1) `src/components/public/` — mekanisme personalisasi nama tamu (`?g=token`) & pemutar musik yang ada, agar cover gate terintegrasi, bukan menduplikasi; (2) `src/lib/validation/content.ts` — skema `InvitationContent` per kategori (field family & corporate yang sebenarnya); (3) `src/app/preview/` — cara preview me-mount tema (pengaruh ke cleanup gsap.context); (4) `src/themes/festa|aria|noir|verdant` versi sekarang — mana yang memakai `WeddingLayout` vs sections sendiri; (5) cara seed `themes` dilakukan selama ini (`supabase/seed.sql` atau migrasi). Bila temuan survei bertentangan dengan dokumen ini, **temuan kode yang menang** — catat penyimpangannya di laporan.
