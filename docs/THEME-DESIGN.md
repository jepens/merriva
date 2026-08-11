# THEME-DESIGN — Sistem Desain & Motion Tema Merriva

**Versi:** 1.2 — 31 Juli 2026 · Acuan visual hidup: **10 prototipe di `prototypes/`** (buka di browser/HP; parameter uji: `?to=Nama+Tamu`, `?rich=1` untuk memaksa efek penuh di perangkat lemah)
**Konteks:** hasil evaluasi tema pertama (terlalu kaku/template) + riset referensi award-winning. Keputusan terkait: `DECISIONS.md` #10.

---

## 1. Filosofi

**Desain dulu, teknologi kedua.** Rasa "awwwards" datang dari art direction — tipografi, komposisi, tekstur, dan koreografi — bukan dari beratnya library 3D. Teknologi (GSAP, shader) hanya memperkuat fondasi yang sudah benar. Setiap keputusan visual diuji terhadap tiga batasan produk: dibuka dari WebView WhatsApp, di HP kelas menengah, oleh tamu dari segala umur.

**Anti-pattern yang membuat tema terasa "template" (dilarang):** font script generik sebagai display utama · semua elemen rata tengah · background polos tanpa tekstur/kedalaman · semua konten muncul sekaligus tanpa urutan · foto dipajang mentah tanpa treatment · animasi fade-in seragam di semua elemen.

## 2. Sistem Motion 3 Tingkat

| Tingkat | Dipakai di | Isi | Budget JS tema (gzip) |
|---|---|---|---|
| **Craft** | SEMUA tema (standar minimum) | Tipografi editorial, grain, mask reveal per baris, stagger, parallax transform ringan, marquee, countdown halus. Framer Motion (sudah di stack) | +0KB |
| **Story** | Tema premium | GSAP ScrollTrigger + SplitText + Lenis: bab ter-pin, teks reveal per baris/kata, SVG line-art menggambar diri (scrub), partikel canvas 2D ringan, galeri horizontal | ≤ +45KB |
| **Signature** | 1–2 tema unggulan | Semua di atas + aksen WebGL (shader mesh-gradient/silk via Paper Shaders atau fragment shader custom kecil) pada cover & transisi | ≤ +90KB total, lazy |

**Aturan pemuatan Signature (wajib):** cover "Buka Undangan" tetap ultra-ringan (LCP = teks cover) → aset berat (shader, font display tambahan, galeri) di-preload SELAGI tamu membaca cover, dan efek berat baru aktif SETELAH tombol ditekan. Deteksi kemampuan: `prefers-reduced-motion`, `deviceMemory < 4` atau `hardwareConcurrency < 4`, WebGL gagal → fallback gradient statis + reveal sederhana. DPR canvas di-cap 1.5. Partikel/shader di-pause saat tab tidak terlihat dan setelah scroll melewati cover.

**Aturan animasi (semua tingkat):** hanya `transform` & `opacity` (tidak pernah layout property) · durasi reveal 0.9–1.2s, ease `power4.out`, stagger 0.06–0.1s · scrub untuk yang terikat scroll, sisanya trigger sekali · `will-change` hanya sesaat sebelum animasi · CLS = 0 (ruang elemen di-reserve) · video background dilarang · tekstur via CSS/SVG noise, bukan file gambar besar.

## 3. Empat Arah Visual → Pemetaan Tema Launch

| Arah | DNA | Tema launch |
|---|---|---|
| **Editorial Elegan** | Serif display kontras tinggi (mis. Fraunces), small-caps letter-spaced, layout asimetris, grain kertas, duotone | `eternal-rose` (wedding — **benchmark Signature**) + `family-warm` (keluarga, versi Craft yang lebih ceria) |
| **Cinematic Foto** | Foto fullscreen dengan mask organik, parallax dalam, transisi gelap-terang, tipografi minimal | `midnight-frame` (wedding premium — Story) |
| **Ilustratif Artistik** | SVG line-art floral/ornamen menggambar diri saat scroll, palet lembut, rasa hand-crafted | `flora-atelier` (wedding — Story) |
| **Eksperimental Modern** | Shader mesh-gradient hidup, tipografi bold besar, grid pecah, energi kontemporer | `prisma` (corporate/gen-Z — Signature ke-2) + `mono-universal` (universal minimalis, versi Craft) |

**Prototipe acuan (semua diverifikasi visual, nol error konsol):** `eternal-rose-signature.html` (Editorial/Signature) · `midnight-frame-story.html` (Cinematic/Story) · `flora-atelier-story.html` (Ilustratif/Story) · `prisma-signature.html` (Eksperimental corporate/Signature) · `family-warm-craft.html` (keluarga/Craft) · `mono-universal-craft.html` (universal/Craft).

Catatan tier yang dibuktikan prototipe: `family-warm` dan `mono-universal` sengaja dibangun **tanpa GSAP/Lenis/library apa pun** (murni CSS + IntersectionObserver ±25 baris) sebagai bukti tier Craft; `prisma` dan `eternal-rose` memuat shader hanya di perangkat mampu dengan fallback gradient CSS otomatis; `midnight-frame` dan `flora-atelier` memakai GSAP+Lenis tanpa WebGL (tier Story). Setiap prototipe juga mendemokan kategori acara berbeda: 3 pernikahan, corporate (gathering), keluarga (khitanan), dan universal (pesta perak).

## 3b. Gelombang 2 — 31 Juli 2026 (4 tema tambahan, semua diverifikasi visual)

| Prototipe | Arah & riset dasarnya | Target slug | Tier | Font |
|---|---|---|---|---|
| `barakah-story.html` | **Islami elegan** — lengkung mihrab (ogee), bintang segi-8/khatam yang menggambar diri, zamrud+emas+pasir (palet catalog-meta barakah). Demo: akad + walimatul 'ursy | `barakah` (upgrade) | Story | Marcellus + Figtree |
| `meridian-story.html` | **Art Deco gala** — sunburst menggambar diri, bingkai bertingkat + sudut emas, shimmer emas CSS, "Programme" bernomor romawi (palet catalog-meta meridian) | `meridian` (upgrade) | Story | Italiana + Jost |
| `lumina-craft.html` | **Soft film / Korean-minimal** — album tipis, surat pendek, bingkai film, Gowun Batang (serif buku Korea ber-Latin), ruang napas ekstrem (palet catalog-meta lumina) | `lumina` (upgrade) | Craft (tanpa library/canvas) | Gowun Batang + Karla |
| `kirana-story.html` | **Jawa modern** — riset budaya: motif **truntum** (cinta bersemi; motif restu — BUKAN parang yang dilarang di pernikahan Jawa), gunungan line-art, palet sogan, rangkaian termasuk **Upacara Panggih** + catatan edukatifnya, istilah krama (katur dhumateng, rawuh) | **`kirana` (TEMA BARU)** | Story | Cormorant Upright + Figtree |

Dengan gelombang 2, seluruh 9 tema existing aplikasi punya acuan visual + 1 tema baru (`kirana`) untuk segmen adat yang belum tergarap kompetitor.

## 4. Spesifikasi Redesign `eternal-rose` (benchmark)

**Mood:** "surat cinta di atas kertas mewah" — romantis, tenang, mahal. Bukan pink cerah.

**Token desain:**

```
Warna   : plum gelap #2E1A22 (cover/malam) · paper #F6EFE7 (siang) ·
          rose #B76E79 (aksen) · gold lembut #C9A227 (detail) · ink #241A1E
Font    : Display — Fraunces (variable, italic untuk nama) ·
          UI/caps — Instrument Sans (letter-spacing 0.18em untuk eyebrow)
Tekstur : grain SVG feTurbulence opacity 5–7% fixed overlay · hairline 1px ink/15%
Bentuk  : arch (lengkung atas) untuk frame foto · sudut konten 20–28px
```

**Koreografi per bagian (implementasi lengkap di prototipe):**

1. **Cover (gerbang):** background shader silk plum↔rose yang mengalir sangat lambat (Signature; fallback: gradient beranimasi CSS) + grain. Eyebrow small-caps → nama besar Fraunces italic ter-reveal per baris (mask), tanggal, kartu "Kepada Yth. {nama tamu}", tombol pill "Buka Undangan". Scroll terkunci sampai dibuka.
2. **Pembukaan:** tekan tombol → cover terangkat (clip-path wipe ke atas, 1.1s power4.inOut) → musik mulai → kelopak mawar canvas mulai jatuh perlahan (±35 partikel, sway sinus) → scroll aktif (Lenis).
3. **Hero:** marquee strip tipis (nama + tanggal berulang) · "The Wedding of" · monogram · ornamen mawar line-art di sudut yang menggambar diri (stroke-dashoffset scrub).
4. **Quote/ayat:** italic serif, reveal per baris saat masuk viewport.
5. **Mempelai:** dua frame arch berselang-seling kiri/kanan (rotasi ±2°), foto duotone (fallback demo: gradient + monogram), nama besar + orang tua kecil; parallax lembut berlawanan arah.
6. **Countdown:** 4 kolom angka Fraunces tabular, pemisah hairline, tick halus per detik.
7. **Jadwal:** kartu "01 — Akad" / "02 — Resepsi" dengan nomor ghost outline besar, detail waktu/tempat, tombol pill "Petunjuk Arah" & "Simpan Kalender".
8. **Galeri:** strip horizontal scroll-snap, tinggi bervariasi (rasa editorial), gambar ter-reveal clip-inset + skala 1.15→1.
9. **RSVP + ucapan:** form minimal di kartu paper; dinding ucapan stagger-in.
10. **Amplop:** kartu collapsible, tombol salin dengan feedback micro.
11. **Footer:** monogram + watermark "Merriva" kecil (paket Basic).

## 5. Definition of Done sebuah tema

Lighthouse mobile ≥ 90 & LCP < 2,5s (4G, HP kelas menengah) · CLS = 0 · scroll 60fps di Android mid-range (uji nyata, bukan hanya devtools) · berjalan mulus di WebView WA Android & iOS · `prefers-reduced-motion` menghasilkan pengalaman lengkap tanpa motion · semua konten tetap terbaca bila JS gagal (SSR utuh) · kontras teks WCAG AA · tap target ≥ 44px.

## 6. Tooling & referensi

GSAP + semua plugin kini gratis (ScrollTrigger, SplitText — [pengumuman Webflow](https://webflow.com/blog/gsap-becomes-free)) · Lenis smooth scroll (~4KB) · [Paper Shaders](https://github.com/paper-design/shaders) `@paper-design/shaders-react` — shader components zero-dependency untuk implementasi React (lock version, masih 0.x) · CSS scroll-driven animations sudah didukung [Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) — boleh dipakai sebagai progressive enhancement dengan fallback ScrollTrigger · Inspirasi: kurasi [Awwwards](https://www.awwwards.com/) (kategori typography/animation), bukan untuk ditiru mentah — DNA Merriva tetap empat arah §3.

**Porting prototipe → React:** pola di prototipe (reveal, scrub, petals, gate) dipindahkan ke komponen tema `src/themes/eternal-rose/` dengan `useGSAP`/`gsap.context` (cleanup wajib), dynamic import untuk bagian Signature, dan props `InvitationData` menggantikan konten demo. Kontrak props tema tidak berubah.
