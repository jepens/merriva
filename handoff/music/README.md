# handoff/music — Library Musik Awal Merriva (6 trek)

Enam trek instrumental, diproduksi 31 Jul 2026, lisensi 100% bersih (lihat `LICENSES.md`).
Format: **WAV master** 44.1kHz/16-bit stereo di `wav/` + **MP3 192k** siap-produksi di `mp3/`.
Semua sudah QC: nol clipping, peak −0.6 dB, RMS −13…−18 dB (pas untuk musik latar), fade-out halus.

## Daftar trek & pemetaan mood tema

| Trek | Karakter | Durasi | Cocok untuk tema |
|---|---|---|---|
| `canon-in-d` | Piano + pad, klasik pernikahan paling dicintai | 110 dtk | eternal-rose, meridian, lumina (universal wedding) |
| `gymnopedie-no-1` | Piano solo lembut, kontemplatif | 65 dtk | aria/mono, lumina |
| `cahaya` | Felt piano + pad hangat, romantis modern | 84 dtk | eternal-rose, verdant, lumina |
| `kirana` | **Gamelan sintesis laras slendro** — saron, imbal, kenong, gong ageng | 81 dtk | kirana (adat Jawa) |
| `ceria` | Music box + petikan riang | 45 dtk | festa (khitanan/ulang tahun) |
| `tenang` | Pad ambient tanpa melodi menonjol | 84 dtk | barakah, prisma/corporate, latar universal |

## Cara pakai di aplikasi (sesuai SPEC — tabel `songs`)

1. Upload **file `mp3/`** ke storage media (bucket musik) — MP3 yang disajikan ke tamu
   (1–2,7 MB; WAV 8–19 MB hanya master/arsip, JANGAN disajikan langsung).
2. Seed tabel `songs`: `title`, `artist` (isi: "Merriva Ensemble" / kosong), `storage_path`, `is_active`.
3. Pemutar undangan me-loop lagu; fade-out 1,2 dtk di ujung membuat perpindahan loop lembut.
   Bila ingin loop tanpa jeda sama sekali, aktifkan crossfade pendek di pemutar.

## PENTING — audisi dulu oleh manusia

Trek-trek ini disintesis secara prosedural dan sudah diverifikasi secara teknis, tapi
**belum pernah didengar oleh telinga manusia**. Sebelum di-seed sebagai library default:
putar keenamnya (cukup dari `mp3/`), nilai rasanya di HP dengan speaker & earphone,
dan buang/berikan catatan revisi untuk yang kurang pas. Generatornya disertakan di
`generator/make_music.py` (Python + numpy, tanpa dependensi lain) — tempo, melodi,
instrumen, dan durasi mudah diubah, lalu render ulang: `python3 make_music.py [nama-trek]`.

## Menambah lagu berikutnya

Target SPEC ±20 lagu. Jalur aman: (1) komposisi original baru via generator; (2) rekaman
public-domain/CC0 dari Musopen (unduh manual, catat di LICENSES.md); (3) komisi musisi
lokal dengan kontrak work-for-hire. Hindari mengisi library dari situs "royalty-free"
gratis populer — lihat catatan lisensi di LICENSES.md.
