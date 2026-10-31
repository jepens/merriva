# WAVE3-PROMPT — PROMPT FASE I: 4 Tema Baru + Varian sebagai Kartu Katalog

Prompt siap-tempel untuk Claude Code di VSCode, kelanjutan seri FASE A–H.
Spesifikasi: `docs/THEME-WAVE3.md` · Prototipe teruji: `prototypes/{priangan-story,marawa-story,sakinah-craft,meihua-story}.html`

---

## PROMPT FASE I (salin mulai dari sini)

```
Kamu mengerjakan proyek Merriva. Tugas FASE I ada dua: (A) memasang 4 tema baru —
sakinah, priangan, marawa, meihua — sesuai docs/THEME-WAVE3.md, dan (B) mengubah
katalog agar tiap VARIAN terkurasi tampil sebagai kartu desain sendiri (THEME-WAVE3 §4).

Baca dulu sampai habis: docs/THEME-WAVE3.md (spesifikasi + ATURAN BUDAYA §3 yang
wajib), docs/THEME-PORTING.md (kontrak porting lama tetap berlaku: §0 kontrak data,
§0.4 pola mask milik-JS, §5 DoD), lalu buka keempat prototipe di browser dan baca
sumbernya — prototipe adalah sumber kebenaran visual & perilaku.

LANGKAH 0 — SURVEI: cek pola tema existing terdekat sebagai acuan porting
(sakinah → pola lumina/aria utk Craft; priangan/meihua → pola kirana/barakah utk
Story; marawa → pola noir utk dark). Cek cara seed tabel themes & demo-data
registry (pola prisma/kirana), skema options.ts customizer, dan komponen katalog
landing + catalog-meta.ts. Laporkan rencana + urutan pengerjaanmu, tunggu konfirmasiku.

IMPLEMENTASI (SATU PER SATU, commit terpisah, urutan disarankan):
1. sakinah ← prototypes/sakinah-craft.html — CRAFT MURNI: dilarang impor gsap/
   lenis/canvas; hanya Reveal/ThemeRoot/Countdown bersama + CSS. Nol foto: medali
   inisial menggantikan foto, section galeri DIGANTI section doa (teks Arab salin
   persis dari prototipe). Font Amiri + Plus Jakarta Sans (next/font, subset latin
   + arabic utk Amiri). Buktikan via next build: route tema Craft tidak membengkak.
2. priangan ← prototypes/priangan-story.html — Story: siger draw-on-load di cover,
   awan drift, mask-reveal §0.4, galeri arch clip-reveal, payung geulis draw di
   penutup. Font Prata + Mulish.
3. marawa ← prototypes/marawa-story.html — Story dark (catalog-meta dark:true):
   gonjong draw, pita marawa kiri (urutan warna jangan diubah), tekstur songket,
   galeri wipe-bawah. Font Cinzel + Albert Sans.
4. meihua ← prototypes/meihua-story.html — Story: 囍 draw + cincin berputar,
   ranting mei hua scrub + kuntum mekar stagger (kelompok 3/5/8, JANGAN 4),
   lentera goyang, bingkai oktagon, section hadiah bernama "Angpao Digital".
   Font DM Serif Display + Work Sans. PENTING: glyph 囍 di body (section makna &
   pemisah mempelai) JANGAN mengandalkan font CJK sistem (tofu di sebagian HP) —
   render sebagai SVG inline (salin dari medali cover) atau subset font satu-glyph.
   Wiring LENGKAP per tema: folder src/themes/{slug}/ + options.ts (varian sesuai
   THEME-WAVE3 §2) + themeRegistry + catalog-meta + demo-data (copy & nama demo
   dari prototipe) + seed/migrasi baris themes (kategori wedding, tier mengikuti
   pola tema setara, aktif).
5. Katalog varian = kartu (THEME-WAVE3 §4): render kartu per (tema × varian) dari
   options.ts; judul "{Tema} — {Varian}"; poster memakai palet varian; link
   /preview/tema/{slug}?variant={id}; preview menerapkan varian HANYA bila id ada
   di whitelist options schema (id liar → bawaan, jangan error). Filter kategori
   tetap bekerja. Tulis unit test utk resolusi varian liar.
6. docs/DECISIONS.md: entri baru (tanggal, 4 tema gelombang 3 + keputusan
   varian-jadi-kartu, rujuk THEME-WAVE3).

ATURAN: patuh boundaries CLAUDE.md · ATURAN BUDAYA THEME-WAVE3 §3 wajib ·
state mask dimiliki JS (§0.4) · galeri tile rasio pakai BLOCK-FLOW dua kolom
seperti prototipe, JANGAN CSS grid utk tile rasio (baris grid terbukti kolaps —
catatan di sumber prototipe) · gsap/lenis hanya via dynamic import tema Story ·
reduced-motion: semua konten tampil tanpa animasi (pola prototipe) ·
Conventional Commits kecil.

SELESAI = DoD THEME-WAVE3 §5 penuh. Akhiri dengan laporan per tema (perbandingan
vs prototipe + angka bundle) dan tangkapan layar katalog baru. Uji HP nyata
(WhatsApp WebView Android + iOS Safari) tetap tugasku — beri daftar URL preview.
```

---

**Catatan untuk pemilik:** jalankan setelah Fase H (Momen) stabil di production. Setelah FASE I selesai, katalog akan menampilkan ±55 kartu desain dari 14 tema — perbarui copy landing ("50+ desain") dan materi promosi. Font baru menambah 8 keluarga font self-hosted; tidak apa-apa karena per-halaman hanya memuat font temanya sendiri (pola next/font per tema yang sudah berjalan).
