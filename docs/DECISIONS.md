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

## #12 — 2026-08-02 · Fase F dieksekusi: Gelombang 2 selesai (10 tema, semua `coverMode:'theme'`)

**Keputusan:** Melaksanakan port Gelombang 2 (#11) dari 4 prototipe baru ke sistem cover-gate — dikerjakan paralel (workflow 4 agen, satu tema per folder) lalu diintegrasikan & diverifikasi per-tema di browser oleh orkestrator.

| Tema | Dari | Tier | Kategori | Font |
|---|---|---|---|---|
| meridian | `meridian-story.html` | Story | **wedding** (pivot dari corporate) | Italiana + Jost |
| barakah | `barakah-story.html` | Story | wedding (islami) | Marcellus + Figtree |
| lumina | `lumina-craft.html` | Craft | **universal** (dipertahankan adaptif) | Gowun Batang + Karla |
| kirana (BARU) | `kirana-story.html` | Story | wedding (adat Jawa) | Cormorant Upright + Figtree |

Commit: `c46d279`.

**Keputusan turunan:**

- **meridian pivot corporate→wedding**: prototipe = gala pernikahan Art Deco; corporate kini dipegang `prisma` (Fase D) + `lumina` (universal). Seed `themes.categories` meridian → `{wedding}` (migrasi `20260801000000`). Tier harga tetap `standard` (tier motion Story ≠ tier harga).
- **lumina tetap universal & adaptif** (wedding/corporate/family) — prototipe wedding hanya demo/estetika; logika normalisasi kategori dipertahankan.
- **barakah berhenti memakai `WeddingLayout`** (kini Story dgn sections sendiri) → `WeddingLayout` + `wedding-sections` **tanpa konsumen** (kandidat hapus, cleanup terpisah).
- kirana: folder baru + registry + catalog-meta (`#F5EDDC/#3B2F22/#C09A4A/✽`) + demo-data-registry + capabilities + seed baris `themes` (premium, wedding, pola prisma).

**Angka bundle (tier, gzip lazy):** Story (meridian/barakah/kirana) ≈ **49KB** (gsap+ScrollTrigger+lenis; dalam target ≤50KB hasil ratifikasi Fase E); Craft (lumina) **+0KB**. **Semua 10 tema kini `coverMode:'theme'`** → blok cover `InvitationShell` siap di-deprecate (arah akhir; cleanup terpisah).

**DoD (dev, mobile):** lint 0-err · typecheck · test 215 · build hijau · konsol 0 error (4 tema) · reduced-motion konten penuh · `?to=` · tanpa h-overflow · Craft lumina nol gsap. **Lighthouse a11y/BP/SEO:** meridian 100/100/100 · barakah 95/100/100 (1 audit kontras sogan disengaja) · lumina 100/100/100 · kirana 100/100/100. Performa ≥90 = gate staging/Docker (standalone tak jalan di Windows — riwayat Fase E).

**Catatan riwayat:** entri ADR Fase A (adopsi gsap/lenis + arsitektur cover-gate) & Fase E (sapu DoD 6 tema + ratifikasi anggaran Story ≤50KB) ada di riwayat git (commit `7e7608a`…`2835440`); DECISIONS.md kerja direorganisasi seputar narasi Gelombang 2 (#11) sehingga kedua entri itu tak lagi tampak di file. File ini mestinya append-only ("jangan hapus riwayat", header) — bila drop entri Fase A/E tak disengaja (tampak divergensi: dua "#11" bertanggal 2026-07-31), pulihkan dari git.

**Ditunda (sadar):** cleanup `WeddingLayout`/`wedding-sections` (tanpa konsumen) + deprekasi cover `InvitationShell` · uji nyata WebView WA Android+iOS · angka performa Lighthouse di staging.

## #13 — 2026-08-02 · Cleanup pasca-Gelombang 2: hapus `WeddingLayout` + deprekasi cover `InvitationShell`

**Konteks:** dua item "ditunda (sadar)" di #12 dieksekusi setelah seluruh 10 tema memegang cover-gate sendiri (registry ≡ `THEME_CAPABILITIES`, semua `coverMode:'theme'`).

**Keputusan:**

- **Hapus `WeddingLayout` + `wedding-sections`** (`src/themes/_shared/`): tanpa konsumen sejak barakah pindah ke section sendiri (#12); tak ada tema/preview/test yang meng-import. Tipe `WeddingLabels` ikut terhapus (hanya dipakai dua file itu).
- **Deprekasi cover `InvitationShell`**: karena setiap slug tak dikenal sudah `notFound()` sebelum cabang komposisi, cabang `coverMode:'shell'` di `app/[slug]/page.tsx` menjadi kode mati. Halaman publik kini selalu `<GuestPersonalizationProvider><Theme/></…>`. Dihapus: `components/public/invitation-shell.{tsx,css}`, helper `coverFromData` + tipe `CoverInfo` di page, dan `themes/capabilities.ts` (satu-satunya guna `coverMode` adalah gate shell yang kini usang). Konteks tamu tetap disediakan `GuestPersonalizationProvider` (bukan `InvitationShell`) → tanpa regresi personalisasi `?g=`/`?to=`.

**Konsekuensi:** −5 file; halaman publik lebih sederhana; **tak ada lagi cover generik fallback** — tema baru WAJIB membawa cover-gate sendiri (pola `eternal-rose`/`kirana`). Komentar usang di `guest-context`, `guest-personalization`, `barakah/labels` diselaraskan.

**Verifikasi:** lint 0-err · typecheck · test 215 · build hijau. Semua perubahan lokal (belum push).

---

## Template entri baru

```
## #N — YYYY-MM-DD · [Judul keputusan]
**Keputusan:** ...
**Alasan:** ...
**Ditolak:** ... (alternatif + kenapa)
**Konsekuensi:** ... (bila ada dampak teknis/biaya yang harus diingat)
```
