# PORTING-PROMPT — Memasang 6 Tema Prototipe ke Aplikasi

Prompt siap-tempel untuk Claude Code di VSCode. Jalankan **per fase** (jangan sekaligus) — setiap fase satu sesi/percakapan boleh, asal fase sebelumnya sudah terverifikasi. Dokumen rencananya: `docs/THEME-PORTING.md`.

---

## PROMPT FASE A (salin mulai dari sini)

```
Kamu mengerjakan proyek Merriva. Tugas besar: memasang 6 desain tema baru (acuan visual
di prototypes/*.html — sudah teruji) ke dalam sistem tema aplikasi, menggantikan tampilan
lama yang kaku. Rencana engineering lengkapnya ada di docs/THEME-PORTING.md — itu kontrak
kerjamu; baca sampai habis bersama docs/THEME-DESIGN.md sebelum menulis kode.

LANGKAH 0 — SURVEI (THEME-PORTING §7, wajib):
Baca CLAUDE.md, docs/THEME-PORTING.md, docs/THEME-DESIGN.md, lalu survei kode yang
disebut §7 (personalisasi tamu & musik di src/components/public/, skema
src/lib/validation/content.ts per kategori, cara preview me-mount tema, tema mana yang
memakai WeddingLayout, cara seed tabel themes). Buka juga prototypes/eternal-rose-signature.html
di browser dan baca sumbernya. Laporkan hasil survei + rencana langkah Fase A padaku,
sebutkan bila ada temuan yang bertentangan dengan THEME-PORTING.md. Tunggu konfirmasiku.

FASE A — INFRA BERSAMA + BENCHMARK ETERNAL-ROSE:
1. pnpm add gsap lenis (versi stabil terbaru; keduanya gratis/MIT).
2. Bangun infra _shared sesuai THEME-PORTING §2: use-motion-tier.ts, gsap-motion.tsx
   (dynamic import + gsap.context + cleanup + pola mask §0.4), cover-gate.tsx
   (terintegrasi dengan personalisasi tamu & musik yang SUDAH ADA), silk-canvas.tsx,
   particles-canvas.tsx. Fragment shader & parameter partikel disalin dari prototipe.
3. Port tema eternal-rose sesuai prototypes/eternal-rose-signature.html: buang font
   script Great_Vibes, ganti Fraunces + Instrument Sans (next/font), cover gate,
   shader silk lazy hanya saat richOn, kelopak saat dibuka, mask-reveal per baris,
   ornamen SVG scrub-draw, galeri clip-reveal. Kontrak data & visibilitas section
   TIDAK berubah (THEME-PORTING §0).
4. Perbarui demo-data eternal-rose agar menampilkan kekuatan tema (foto cukup,
   love story terisi, 2 sesi acara).

ATURAN: patuh boundaries CLAUDE.md · commit kecil Conventional Commits · gsap/lenis
hanya dimuat di tema Story/Signature (dynamic import) — buktikan lewat next build
output bahwa route tema Craft tidak membengkak · state mask dimiliki JS, bukan CSS
(THEME-PORTING §0.4) · jangan menyentuh tema lain dulu.

SELESAI FASE A bila DoD THEME-PORTING §5 terpenuhi untuk eternal-rose:
lint+typecheck+test+build hijau, /preview/tema/eternal-rose menyerupai prototipe
(uji juga dengan ?rich=1 dan mode reduced-motion), nol error konsol, angka bundle
route dicatat. Akhiri dengan laporan perbandingan berdampingan prototipe vs hasil,
lalu berhenti — Fase B menunggu perintahku.
```

## PROMPT FASE B — Story: noir & verdant

```
Lanjutkan porting tema Merriva (rencana: docs/THEME-PORTING.md; infra Fase A sudah ada).
Port SATU PER SATU dengan commit terpisah:
1. noir ← prototypes/midnight-frame-story.html (letterbox, scene cards, pan foto
   scrub, wipe clip-path, credits; tanpa WebGL).
2. verdant ← prototypes/flora-atelier-story.html (SVG botani inline draw-on-scroll,
   wreath entrance, pressed cards, timeline titik).
Font sesuai pemetaan §1. Struktur: sections sendiri bila markup bersama tidak cukup
(§3). DoD §5 penuh per tema sebelum lanjut. Slug & seed TIDAK berubah. Laporkan
perbandingan vs prototipe per tema.
```

## PROMPT FASE C — Craft: festa & aria

```
Lanjutkan porting tema Merriva (docs/THEME-PORTING.md). Port festa ←
prototypes/family-warm-craft.html lalu aria ← prototypes/mono-universal-craft.html,
commit terpisah. KETENTUAN KHUSUS CRAFT: dilarang mengimpor gsap/lenis — hanya
Reveal/ThemeRoot/Countdown bersama + CSS + particles-canvas (confetti festa saat
cover dibuka). festa: pastikan field kategori family dipakai sesuai skema content.ts
sebenarnya (bukan asumsi field wedding). aria: tanpa canvas sama sekali — jadikan
bukti bahwa bundle route Craft identik dengan sebelum porting (lampirkan angka
next build). DoD §5 penuh per tema.
```

## PROMPT FASE D — Tema baru: prisma (corporate)

```
Lanjutkan porting tema Merriva (docs/THEME-PORTING.md §3 poin prisma). Buat tema BARU
src/themes/prisma/ dari prototypes/prisma-signature.html: kategori corporate
(ikuti skema content corporate di content.ts), shader aurora via silk-canvas,
marquee ganda CSS, stats count-up, agenda dari data.events, tiket RSVP membungkus
GuestbookSection yang sudah ada, barcode CSS, font Space Grotesk + Space Mono.
Wiring lengkap: themeRegistry, catalog-meta (bg:#0A0A16, ink:#F2F2F7,
accent:#D8FF5F, dark:true, ornament:"✦"), demo-data-registry, demo-data corporate
(acara "SYNERGY '26" dari prototipe), dan seed/migrasi baris themes (slug prisma,
categories {corporate}, tier premium, aktif) mengikuti cara seed yang dipakai repo.
DoD §5 penuh + preview /preview/tema/prisma dibandingkan dengan prototipe.
```

## PROMPT FASE E — Sapu jagat

```
Fase terakhir porting tema Merriva: jalankan seluruh DoD docs/THEME-PORTING.md §5
lintas 6 tema (termasuk Lighthouse preview tiap tema & smoke test halaman publik),
perbaiki temuan, lalu: (1) tambah entri baru docs/DECISIONS.md — tanggal, pemetaan
prototipe→tema yang benar-benar dieksekusi, angka bundle per tier; (2) tambah baris
docs/THEME-PORTING.md pada peta dokumen CLAUDE.md; (3) laporkan ringkasan akhir:
apa yang berubah per tema, angka bundle, dan daftar hal yang sengaja ditunda
(meridian/barakah/lumina). Jangan menandai selesai bila ada DoD yang gagal.
```

## PROMPT FASE F — Gelombang 2: barakah, meridian, lumina + kirana (baru)

```
Lanjutkan porting tema Merriva (docs/THEME-PORTING.md §1 "Gelombang 2" + docs/THEME-DESIGN.md §3b).
Port SATU PER SATU dengan commit terpisah, aturan sama dengan fase sebelumnya:
1. barakah ← prototypes/barakah-story.html (Story: lengkung mihrab + bintang khatam
   draw-on-scroll; font Marcellus + Figtree; palet zamrud/emas/pasir existing).
2. meridian ← prototypes/meridian-story.html (Story: sunburst draw, bingkai bertingkat,
   shimmer emas CSS; font Italiana + Jost).
3. lumina ← prototypes/lumina-craft.html (CRAFT MURNI: dilarang gsap/lenis/canvas —
   hanya Reveal bersama + CSS; font Gowun Batang + Karla).
4. kirana ← prototypes/kirana-story.html (TEMA BARU, kategori wedding): folder lengkap +
   themeRegistry + catalog-meta (bg #F5EDDC, ink #3B2F22, accent #C09A4A, ornament "✽") +
   demo-data (upacara Akad/Panggih/Resepsi seperti prototipe) + seed baris themes
   mengikuti pola prisma. PENTING budaya: pola truntum & gunungan dari prototipe,
   JANGAN pernah menambahkan motif parang.
DoD THEME-PORTING §5 penuh per tema. Laporkan perbandingan vs prototipe per tema.
```

## PROMPT FASE G — Customizer "Kustomisasi Terpandu" (setelah Fase A–F stabil)

```
Kamu mengerjakan proyek Merriva. Tugas: bangun fitur kustomisasi terpandu untuk pembeli
(mobile-first) sesuai docs/CUSTOMIZER-SPEC.md — baca sampai habis bersama DECISIONS #12,
lalu buka prototypes/customizer-mobile.html di browser (tombol </> menunjukkan bentuk
settings.custom) sebagai acuan UX & perilaku penjaga kontras.

PENTING — MODUL INTI SUDAH JADI & TERUJI: folder handoff/customizer/ berisi
contrast-guard, theme-options (tipe + default), settings-custom-schema (validator Zod),
options eternal-rose, dan unit test-nya (28/28 hijau, tsc strict lolos — bukti di
handoff/customizer/README.md). PINDAHKAN sesuai peta penempatan di README itu —
JANGAN tulis ulang logikanya; test wajib tetap hijau setelah pemindahan.

LANGKAH 0 — SURVEI: baca handoff/customizer/README.md dulu, lalu skema settings saat ini
di lib/validation/content.ts, cara tema menerima settings, dan halaman dashboard undangan
yang ada. WAJIB source-driven: sebelum wiring API eksternal/framework, verifikasi
dokumentasi TERKINI via Context7 (bila terkonfigurasi di .mcp.json) atau docs resmi.
Dua temuan yang sudah diverifikasi 31 Jul 2026 — patuhi: (a) Next 16: pakai updateTag
(bukan revalidateTag) di Server Action simpan-tampilan — semantik read-your-own-writes;
revalidateTag(tag,'max') hanya untuk Route Handler/webhook; (b) dnd-kit: pakai paket
generasi baru @dnd-kit/react — @dnd-kit/core+sortable lama berstatus legacy.
Laporkan rencana + pertanyaan, tunggu konfirmasiku.

IMPLEMENTASI (commit kecil bertahap):
1. Pindahkan modul handoff sesuai peta README (sesuaikan path import, id section final
   tema, dan CSS var next/font) + getThemeOptions di registry + test ikut pindah & hijau.
2. settings.custom (versioned, backward-compatible) + resolver di tema: CSS vars,
   data-atribut, urutan section = DOM ORDER ASLI (bukan CSS order), penjaga kontras
   dihitung juga saat render publik. Undangan lama tanpa custom harus render identik.
3. Server action updateInvitationAppearance dengan validasi Zod TERHADAP options schema
   (whitelist ketat; accent hex ^#[0-9a-f]{6}$i + hanya paket premium; sections permutasi
   valid; toggle:false selalu visible). Tulis unit test nilai liar/injeksi ditolak.
4. Halaman /dashboard/undangan/[id]/tampilan: preview tema asli + bottom sheet
   (tab Warna/Font/Bagian/Gaya), reorder pakai @dnd-kit/react + tombol panah, dirty-state,
   Simpan → PATCH + updateTag (Next 16), Reset ke bawaan tema. Badge Premium utk opsi terkunci.
5. Penjaga kontras sebagai util murni + unit test (kasus: #e8b7c0 di #F6EFE7 → snap,
   rasio ≥ 4.5).
SELESAI = DoD CUSTOMIZER-SPEC §9 terpenuhi untuk eternal-rose; tema lain menyusul hanya
dengan menambah options.ts. Jangan menyentuh kontrak InvitationData.
```

---

**Catatan untuk pemilik:** uji nyata di HP tetap tugas manusia — buka `/preview/tema/{slug}` dari WhatsApp (kirim link ke diri sendiri) di Android & iOS setelah Fase A dan Fase E. Prototipe HTML tetap menjadi sumber kebenaran visual; bila saat porting ada detail yang ingin diubah, ubah dulu prototipenya (atau catat di DECISIONS) supaya desain dan kode tidak berpisah jalan.
