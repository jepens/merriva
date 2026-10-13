# Identitas visual Merriva

Logo Merriva = **mark "Gerbang"** + **wordmark**. Mark-nya dua lengkungan (huruf `m`
kecil) yang dibaca sebagai gerbang/pelaminan acara, dengan **titik marigold** yang
terbit di antaranya — "momen bahagia". Wordmark memakai Bricolage Grotesque 700
(opsz 64) huruf kecil, dengan tittle huruf `i` ikut marigold sebagai gema titik mark.
Semua teks sudah di-outline → tidak bergantung font.

Folder ini adalah **sumber kebenaran** logo. Jangan menggambar ulang logo di tempat lain;
pakai berkas di sini atau komponen `<MerrivaLogo/>` (`src/components/brand/merriva-logo.tsx`).

## Palet

| Peran                | Hex       | Catatan                                   |
| -------------------- | --------- | ----------------------------------------- |
| Plum (tinta)         | `#241f2b` | tile ikon, wordmark di latar terang        |
| Krem (goresan)       | `#efe7da` | lengkungan di atas tile plum               |
| Kertas               | `#fbf9f6` | latar terang, tile ikon di permukaan gelap |
| Marigold (titik)     | `#c68a3c` | titik mark & tittle `i` — jangan diganti   |
| Marigold tua         | `#9a6a22` | teks aksen di latar terang                 |
| Gelap (band)         | `#211a27` | latar gelap                                |

Sama dengan token `.mrv-*` di `src/app/(marketing)/marketing.css`.

## Berkas

### Master (SVG)

| Berkas                              | Pakai untuk                                                            |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `merriva-logo.svg`                  | Logo horizontal, latar terang (utama)                                  |
| `merriva-logo-dark.svg`             | Logo horizontal, latar gelap (tile krem, wordmark krem)                |
| `merriva-logo-stacked.svg` / `-dark`| Logo vertikal (ikon di atas wordmark) — ruang sempit/persegi           |
| `merriva-logo-mono.svg`             | Satu warna plum — cetak 1 warna, stempel, dokumen hitam-putih          |
| `merriva-logo-mono-white.svg`       | Satu warna putih — di atas foto/latar gelap                             |
| `merriva-wordmark.svg` / `-dark`    | Wordmark saja                                                          |
| `merriva-mark.svg`                  | Ikon utama (tile plum) — avatar, ikon aplikasi                         |
| `merriva-mark-light.svg`            | Ikon di permukaan gelap (tile kertas)                                  |
| `merriva-mark-mono.svg`             | Mark polos `currentColor`, tanpa tile — ikon UI kecil                  |
| `merriva-mark-favicon.svg`          | Varian 16–32 px: goresan lebih tebal, titik lebih besar (ikon tab)     |
| `badge-dibuat-dengan-merriva.svg` / `-dark` | Badge watermark paket Basic ("Dibuat dengan merriva")          |

### Turunan (di-generate — jangan sunting manual)

- `png/` — PNG logo/mark: `merriva-logo-600/1200` (@1x/@2x), varian `-dark`, `-stacked`,
  `merriva-mark-512/1024`, dan **email**: `merriva-logo-email.png` (320 px, tampilkan
  `width="160"`), `merriva-logo-email-dark.png`, `merriva-mark-email.png` (96 px).
- `social/` — banner hero `hero-banner-1920x640` (+`-dark`), OG `og-1200x630` (+`-dark`),
  foto profil `profile-1080` (plum) / `profile-1080-light`, header X `x-header-1500x500`,
  sampul Facebook `facebook-cover-820x312`, banner LinkedIn `linkedin-banner-1584x396`
  (masing-masing ada varian `-dark`). Master SVG-nya ada di folder yang sama.
- `/public/icons/` — `favicon.ico` (16/32/48), `favicon-16x16/32x32/48x48.png`,
  `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
  (dirujuk `/site.webmanifest`). **Tidak ada `/public/favicon.ico` maupun
  `/public/apple-touch-icon.png`**: keduanya diminta peramban dari ROOT domain untuk
  halaman tanpa `<link rel=icon>` — yaitu undangan tamu `/[slug]`, yang memang tak
  boleh bermerek Merriva.
- `/public/og-default.png` — OG fallback undangan non-aktif (= `social/og-1200x630.png`).
- `src/app/{grup}/icon.svg` + `apple-icon.png` — ikon tab per route group (konvensi berkas
  Next). **Sengaja tidak di root `src/app/`**: ikon root diwarisi `/[slug]` (halaman undangan
  tamu), padahal "tanpa watermark Merriva" dijual di paket Premium.
- `src/app/(marketing)/opengraph-image.png` — OG halaman marketing.

Regenerasi semua turunan dari master: `pnpm brand:assets` (Chromium Playwright, tanpa server).
Skrip membuang blok `<metadata>` (content credentials C2PA) saat merender: master
menyimpannya sebagai provenans berkas, turunan tidak — tanpa pembuangan itu `icon.svg`
yang diminta setiap pengunjung berisi 8,9 KB metadata untuk gambar 0,4 KB, dan tiap PNG
membawa chunk `caBX` 5,7 KB (93% dari favicon 16 px). `tests/unit/brand-assets.test.tsx`
menolak turunan yang membawanya lagi — pertanda berkas disalin manual, bukan di-generate.

## Butuh logo untuk layanan pihak ketiga?

Ambil dari daftar di atas; **jangan merender ulang** untuk keperluan satu kali. Dua PNG
yang pernah dibuat terpisah untuk layar consent Google tertinggal di versi logo lama dan
nyaris terunggah sebagai logo resmi. Untuk Google OAuth: `/public/icons/apple-touch-icon.png`
(180×180, persegi, tanpa transparansi). Selengkapnya di `handoff/brand/README.md`.

## Aturan pakai

- Ruang aman di sekeliling logo: minimal setinggi titik marigold (≈ ¼ tinggi tile).
- Ukuran minimum: lockup horizontal 24 px tinggi; mark saja 16 px (pakai varian favicon).
- Di latar gelap pakai varian `-dark` (tile krem); jangan menaruh tile plum di atas plum.
- Jangan: mengubah warna titik, memiringkan/meregangkan, menambah efek bayangan/gradasi,
  mengganti font wordmark, atau menaruh mark tanpa tile di atas foto ramai (pakai tile).
- Di kode, pakai `<MerrivaLogo variant="lockup|mark|wordmark" height={..} />` — warnanya
  mengikuti `currentColor` + token `--mrv-logo-*` sehingga otomatis benar di band gelap.
