# THEME-WAVE3 — Empat Tema Gelombang 3 + Varian sebagai Kartu Katalog

**Versi:** 1.0 — 27 Oktober 2026 · **Status:** disepakati owner (1 Okt 2026) · Implementasi = PROMPT FASE I (`WAVE3-PROMPT.md`)
**Latar:** katalog kompetitor (galeriundanganofficial.com) menjual lebar — ±12 seri adat per-suku + tiap varian warna dijual sebagai kartu terpisah. Merriva menjawab dengan 4 tema ceruk yang belum terlayani + men-surface varian customizer sebagai kartu katalog (10 tema × ±4 varian ≈ 40 kartu; 14 tema ≈ 55+ — **di kode: 36 kartu untuk 10 tema, 48 untuk 14 tema**; DECISIONS #104).
**Prototipe teruji (sumber kebenaran visual):** `prototypes/priangan-story.html`, `prototypes/marawa-story.html`, `prototypes/sakinah-craft.html`, `prototypes/meihua-story.html` — semua lolos Playwright: nol error konsol, mask-reveal tuntas (aturan §0.4), reduced-motion penuh, personalisasi `?to=`.

---

## 1. Ringkasan tema

| Slug | Ceruk | Tier | Font (next/font) | Kategori |
|---|---|---|---|---|
| `priangan` | Adat Sunda | Story | Prata + Mulish | wedding |
| `marawa` | Adat Minang | Story (dark) | Cinzel + Albert Sans | wedding |
| `sakinah` | Islami syar'i **tanpa foto** | **Craft** (tanpa gsap) | Amiri + Plus Jakarta Sans | wedding |
| `meihua` | Tionghoa (sangjit + wedding) | Story | DM Serif Display + Work Sans | wedding |

Semua mengikuti kontrak tema yang ada (ThemeComponentProps, `isSectionVisible`, prefix kelas CSS per tema, ThemeRoot `is-js`, `Reveal`/`Countdown` bersama di tier Craft) dan lahir dengan `options.ts` (customizer Fase G).

## 2. Spesifikasi per tema

### 2.1 priangan (Sunda, Story)
Palet: paper `#F6F1E3` · ink `#23311F` · aksen pinus `#2E5B41` · emas `#C2A14D`. Ornamen khas: **siger** (mahkota pengantin — line-art SVG digambar goresan saat cover), **payung geulis** (draw-on-scroll di penutup), awan lembut melayang (gsap yoyo), divider **julang ngapak** (dua garis melengkung naik). Quote khas: *"Silih asih, silih asah, silih asuh."* Galeri: arch-top, clip-reveal. Love story: garis waktu titik.
`options.ts` → variants: `pinus` (bawaan, hijau), `senja` (indigo `#35466B`), `sogan` (cokelat hangat — **di kode `#7A4F24`**, lebih gelap dari rancangan awal `#8A5A24`: aksen juga menjadi latar `.pg-deep` (amplop, teks terang), dan `#8A5A24` menurunkan teks di sana di bawah AA; DECISIONS #104); styles.gallery: `arch`/`grid`; supports: customAccent, motion, grain.

### 2.2 marawa (Minang, Story, dark — catalog-meta `dark:true`)
Palet: bg `#1A1412` · ink `#F2E7D4` · maroon `#5E1F28` · emas `#D4A848`. Ornamen khas: **siluet atap bagonjong** (digambar goresan di cover), **pita marawa** hitam-merah-kuning di tepi kiri (identitas — jangan diubah urut-warnanya), tekstur **songket wajik** emas halus (CSS gradient), **kaluak paku** di sudut, bingkai foto ber-clip gonjong. Pepatah: *"Adat basandi syarak, syarak basandi Kitabullah"* — kutip utuh, jangan diparafrase. Galeri: wipe dari bawah (kain dibentang).
`options.ts` → variants: `maroon` (bawaan), `hitam` (bg `#141110`), `gadang` (hijau tua `#1F4231` — **di kode `#152019`**: dicoba `#1F4231` 2 Nov 2026, tetapi tombol & hint sampul serta countdown jatuh di bawah AA di atas hijau yang lebih terang; DECISIONS #104); styles.gallery: `songket`/`grid`.

### 2.3 sakinah (syar'i tanpa foto, CRAFT murni)
**Dilarang gsap/lenis/canvas** — hanya CSS + IntersectionObserver (`Reveal` bersama). Palet: paper `#F7F3EA` · ink `#2A3328` · aksen `#3E5340` · emas `#B99754`. **Nol foto secara desain**: kartu mempelai memakai **medali inisial** (bingkai persegi-putar ala bintang-8), hero memakai monogram; **section galeri diganti section Doa** (hadits doa pengantin). Teks Arab (bismillah, QS. Ar-Rūm 21, doa Abu Dawud, salam penutup) dirender Amiri — kutipan di prototipe sudah diperiksa, salin apa adanya. Countdown, amplop (salin rekening), RSVP + ucapan standar.
`options.ts` → variants: `sage` (bawaan), `tenang` (navy `#33415C`), `khidmat` (maroon `#5E2430`); sections: `gallery` TIDAK ADA — ganti `doa` (toggle:true); hero/rsvp terkunci seperti tema lain.

### 2.4 meihua (Tionghoa, Story)
Palet: merah lacquer `#9E2B25→#7C1E1A` · ivory `#FAF4E8` selang-seling · emas `#E2B13C`. Ornamen khas: **囍 (shuāngxǐ)** line-art dalam medali cincin berputar pelan — digambar goresan saat cover; **ranting mei hua** melintang hero: dahan tergambar scrub + kuntum mekar stagger (back.out); **lentera** bergoyang; bingkai foto & galeri **oktagon paper-cut**; section hadiah bernama **"Angpao Digital"** (amplop merah). Acara demo: Sangjit + Holy Matrimony/Wedding Dinner.
`options.ts` → variants: `lacquer` (bawaan), `burgundy` (`#6E1F2E`), `champagne` (terang: paper ivory, aksen merah); styles.gallery: `okta`/`grid`.

## 3. Aturan budaya (WAJIB — setara aturan truntum/parang di kirana)

1. **priangan**: jangan memakai gunungan/wayang purwa (itu identitas kirana/Jawa) dan jangan motif parang. Kujang (senjata) TIDAK dipakai di desain bawaan. Istilah Sunda di copy demo (wilujeng sumping, hatur nuhun, pepatah) dipertahankan.
2. **marawa**: urutan pita hitam–merah–kuning jangan diubah; pepatah dikutip utuh; jangan mencampur ornamen Jawa/Sunda; gonjong selalu runcing ke atas (jangan dibalik).
3. **sakinah**: nol foto DAN nol siluet wajah di seluruh tema termasuk poster katalog; teks Arab disalin persis dari prototipe (sudah diverifikasi) — jangan "merapikan" harakat; tone khidmat, tanpa confetti/efek pesta.
4. **meihua**: 囍 selalu utuh (jangan terpotong ornamen lain); merah+emas dominan — putih/hitam tidak boleh jadi latar dominan (asosiasi duka); kuntum mei hua berkelompok 3/5/8 — JANGAN 4; tanpa ikon shio/naga kecuali owner meminta.

## 4. Varian = kartu katalog (keputusan owner, 1 Okt 2026)

Katalog publik merender **satu kartu per (tema × varian terkurasi)**, bukan per tema:

1. Sumber varian = `options.ts` tiap tema (customizer) — satu sumber kebenaran, tanpa tabel baru.
2. Kartu memakai poster `catalog-meta` dengan palet varian (acc/paper/ink dari variant), judul `"{Nama Tema} — {Nama Varian}"`.
3. Link kartu: `/preview/tema/{slug}?variant={id}` — halaman preview membaca query dan menerapkan `settings.custom.variant` HANYA pada preview (whitelist id varian; id liar → bawaan; tidak menyentuh data undangan siapa pun).
4. Filter kategori & tier tetap bekerja (turunan dari tema induk). Urutan: tema dulu, lalu variannya.
5. Copy marketing landing boleh menyebut total kartu ("50+ pilihan desain") — jujur karena tiap varian memang terdesain & terkurasi. **Jumlah aktual 48 — klaim "50+" TIDAK dipasang (DECISIONS #104).**

## 5. Definition of Done (FASE I)

Per tema: DoD THEME-PORTING §5 penuh (lint+typecheck+test+build hijau, preview menyerupai prototipe, nol error konsol, reduced-motion OK, angka bundle dicatat — sakinah WAJIB membuktikan bundle route Craft tidak memuat gsap) · `options.ts` + baris seed `themes` + demo-data per tema (copy demo dari prototipe) · aturan budaya §3 terpatuhi · katalog varian: kartu tampil benar untuk 14 tema, preview `?variant=` aman terhadap id liar, Lighthouse landing tidak turun · entri DECISIONS.md baru (tanggal, 4 tema, keputusan varian-jadi-kartu).
