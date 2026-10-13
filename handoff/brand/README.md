# handoff/brand — arsip konsep merek

Folder ini **bukan** sumber aset. Sumber kebenaran logo Merriva ada di
[`public/brand/`](../../public/brand/README.md); di sinilah bahan mentah dan
dokumen penyerahan disimpan supaya tidak hilang, bukan supaya dipakai.

| Berkas                            | Isi                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `konsep/merriva-logo-konsep.png`   | Tiga konsep mark yang diajukan; "Gerbang" yang dipilih pemilik (DECISIONS #75) |
| `konsep/merriva-brand-overview.png`| Lembar ikhtisar identitas: mark, wordmark, palet, penerapan  |

## Logo untuk layanan pihak ketiga

Jangan merender ulang logo untuk keperluan satu kali — itu persis yang membuat
berkas di folder ini pernah **basi tanpa ketahuan**: dua PNG di sini dibuat dari
ikon monogram "M" darurat, lalu logo resminya berganti dan PNG-nya tidak.
Keduanya sudah dihapus. Ambil dari aset yang di-generate `pnpm brand:assets`:

| Keperluan                            | Pakai berkas ini                        |
| ------------------------------------ | --------------------------------------- |
| **Google OAuth consent screen**      | `public/icons/apple-touch-icon.png` — 180×180, persegi, **tanpa transparansi** (Google menampilkannya di latar terang maupun gelap; minimal 120×120) |
| Avatar / foto profil media sosial    | `public/brand/social/profile-1080.png`  |
| Favicon untuk formulir vendor (.ico) | `public/icons/favicon.ico`              |
| Logo di dokumen & lampiran           | `public/brand/png/merriva-logo-1200.png` |

Daftar lengkap beserta aturan pakainya: [`public/brand/README.md`](../../public/brand/README.md).
