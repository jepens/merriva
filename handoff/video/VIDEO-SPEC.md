# VIDEO-SPEC — Section Video untuk Semua Tema (FASE J)

Status: siap diterapkan · Keputusan owner: 5 Nov 2026
Staging: `handoff/video/` (terpisah — JANGAN menyentuh `src/` di luar langkah FASE J)

## 0. Keputusan produk (terkunci)

| Keputusan | Nilai |
| --- | --- |
| Sumber video | HIBRIDA: file unggahan DAN tautan YouTube (pemilik cukup mengisi salah satu) |
| Prioritas | File unggahan MENANG atas tautan YouTube bila keduanya diisi |
| Batas unggahan | ≤ 60 detik (toleransi metadata +1 dtk) & ≤ 40 MB; mp4 / webm / mov (quicktime) |
| Orientasi | WAJIB landscape (width > height) — semua tema membingkai mendatar |
| Pemutaran file | Autoplay senyap + loop saat terlihat (IntersectionObserver play/pause), tombol toggle suara; `prefers-reduced-motion` → TANPA autoplay, kontrol native |
| Pemutaran YouTube | Facade ringan (poster `i.ytimg.com` + tombol putar); iframe `youtube-nocookie.com` BARU dibuat setelah klik |
| Gating paket | `limits.youtube` (flag paket yang SUDAH ADA) menjadi flag fitur video untuk KEDUA sumber — kunci DB tetap bernama `youtube` |
| Section | Id kanonik baru `video` — opsional (toggle) & bisa diurut ulang di SEMUA 14 tema; default setelah `gallery` |
| Transcoding | TIDAK ADA — server hanya memvalidasi tipe & ukuran; berkas disajikan apa adanya |

## 1. Fakta repo yang menjadi fondasi (VERIFIKASI SENDIRI sebelum menulis kode)

1. `content.youtubeUrl` SUDAH ADA: `lib/validation/content/shared.ts`
   (`youtubeUrlSchema`, validasi host via `new URL().hostname` — bukan substring),
   field editor di `settings-step.tsx`, mengalir ke tema via
   `lib/invitation-content.ts` (common fields). BELUM dirender tema mana pun.
2. `limits.youtube: boolean` SUDAH ADA di `lib/limits.ts` (paket), dan
   `app/[slug]/page.tsx` sudah memanggil `getEffectiveLimits` (dipakai untuk
   `watermark`). BELUM pernah ditegakkan untuk youtubeUrl saat render — FASE J
   menutup lubang ini.
3. Pola unggah "foto bernama" (`server/actions/named-photo.ts`): aksi TIDAK
   menulis DB; path tinggal di `content` dan DISIMPAN OLEH AUTOSAVE (alasan
   terdokumentasi di file itu — WAJIB dibaca). Video memakai pola yang sama.
4. Retensi/penghapusan objek memakai bentuk path seragam (`mediaObjectPaths`,
   lihat komentar di `server/invitation-data.ts` dan migrasi 20261014120000).
   Objek video WAJIB ikut tersapu — audit jalur retensi + `server/arsip-zip.ts`.

## 2. Modul SIAP PAKAI (sudah lulus tsc + eslint + prettier + 11 unit test di sandbox)

Salin apa adanya dari `handoff/video/modules/` ke path yang sama di repo:

| Berkas | Isi |
| --- | --- |
| `src/themes/_shared/youtube.ts` | `youtubeVideoId()` (watch/youtu.be/shorts/embed/live, host-safe), `youtubeEmbedUrl()` (nocookie), `youtubePosterUrl()` |
| `src/themes/_shared/video.tsx` | `ThemeVideo` (client) — file: autoplay senyap+loop+IO+toggle suara+reduced-motion; YouTube: facade→iframe. Kelas generik: `video-frame`, `video-frame--file`, `video-frame--yt`, `video-el`, `video-mute`, `video-lite`, `video-play`. Juga `hasThemeVideo()` untuk gating section. `VideoView { url, posterUrl, width, height }` |
| `src/lib/video.ts` | `VIDEO_MAX_BYTES`, `VIDEO_MAX_SECONDS` (61 = 60+toleransi), `VIDEO_ACCEPTED_TYPES`, `VIDEO_ACCEPT_ATTR`, `validateVideoFile()`, `validateVideoMeta()` (durasi + WAJIB landscape) |
| `tests/unit/theme-video.test.tsx` | 11 test: parser id, facade tanpa-iframe-sebelum-klik, prioritas file>YouTube, atribut video & toggle aria, rasio, validasi berkas/metadata |

`reference/video-action.ts` adalah TEMPLATE aksi server (bukan drop-in) —
sesuaikan dengan `lib/media`/`lib/storage` aktual saat langkah J2.

## 3. Rencana penerapan (urutan WAJIB; gate hijau di tiap langkah)

### J1 — Modul + kosakata + label
- Salin 4 modul di atas.
- `lib/customizer/section-vocab.ts`: tambah `"video"` ke `SECTION_STANDARD`.
- `lib/copy.ts`: `copy.appearance.sectionLabels.video = "Video"` (test
  konformitas `theme-contracts.test.ts` menuntut ini).
- Gate: `pnpm lint && pnpm typecheck && pnpm test`.

### J2 — Data + server
- `lib/validation/content/shared.ts`: `videoSchema` =
  `{ path: storagePathSchema, poster: storagePathSchema.optional(), width: int>0≤8000, height: int>0≤8000, durationSec: number>0≤61 }`
  (strict, pola `photoSchema`); tambah `video: videoSchema.optional()` ke field
  common draft + render (ikuti persis bagaimana `coverPhoto` dirangkai di
  `draft.ts` / parse render / `lib/invitation-content.ts`).
- `lib/media.ts` (atau modul baru `lib/video-paths.ts` bila lebih bersih):
  prefix `video/{invitationId}/{uuid}`; objek `{prefix}/video.{mp4|webm|mov}` +
  `{prefix}/poster.webp`; helper daftar-objek untuk penghapusan (pola
  `mediaObjectPaths`).
- `server/invitation-data.ts`: arg baru `videoAllowed: boolean`;
  `InvitationData.video: VideoView | null` di-resolve via
  `storage.getPublicUrl`; bila `videoAllowed === false` → `video = null` DAN
  `content.youtubeUrl = undefined` (gating render untuk kedua sumber — satu
  titik untuk halaman publik & pratinjau).
- `app/[slug]/page.tsx` (dan pratinjau `[id]` bila memanggil build yang sama):
  teruskan `videoAllowed: limits.youtube`.
- `server/actions/video.ts`: lihat `reference/video-action.ts`. Pola
  named-photo + TAMBAHAN: tegakkan `limits.youtube` paket DI SERVER (ambil
  `package_id` undangan → `getEffectiveLimits`), validasi `validateVideoFile`
  bytes/type + poster webp; TANPA tulis DB. Aksi hapus menghapus objek storage.
- Retensi: pastikan sapuan penghapusan (cron/SQL migrasi berpola 20261014120000
  + `arsip-zip`) mencakup prefix `video/` — bila perlu migrasi SQL baru,
  KOORDINASIKAN dengan pekerjaan paralel lain sebelum menambah file migrasi.
- Gate penuh.

### J3 — Editor
- `settings-step.tsx`: satu blok "Video" berisi (a) unggah file + (b) field
  youtubeUrl yang sudah ada, dengan hint: "Video unggahan tampil menggantikan
  tautan YouTube bila keduanya diisi" dan "Maks. 60 detik · 40 MB · landscape".
- Alur unggah klien: `validateVideoFile` → baca metadata via elemen `<video>`
  (`loadedmetadata`: `duration`, `videoWidth/Height`) → `validateVideoMeta`
  (pesan Indonesia per issue: type/size/duration/orientation/unreadable) →
  ekstrak poster frame ±0,5 dtk via canvas → webp (pakai util varian webp foto
  yang SUDAH ADA — cari pemakaian `isVariantBlob`/pipeline foto klien; jangan
  menulis encoder baru; ingat fakta platform: `canvas.toBlob('image/webp')`
  diam-diam jatuh ke PNG di Safari/iOS — util yang ada sudah menangani format
  `webp|jpeg`) → FormData ke aksi → set `content.video` di form (autosave yang
  menyimpan, pola foto bernama).
- Tombol hapus video (aksi hapus + kosongkan `content.video`).
- Semua copy UI lewat `lib/copy.ts` (tanpa string hardcode di komponen).
- Gate penuh.

### J4 — 14 tema (kirana, lumina, priangan, marawa, sakinah, meihua, + 8 lainnya di `src/themes/`)
Per tema (pola identik, ±30 baris):
1. `options.ts`: `sections` += `{ id: "video", reorder: true, toggle: true }`
   setelah `gallery`.
2. `labels.ts`: `video: { eyebrow: "Video" }` — Bahasa Indonesia, nada sesuai
   tema (mis. kirana "Video Moment" — bebas tapi Indonesia; TANPA bahasa
   daerah, keputusan owner 5 Nov 2026).
3. `index.tsx`: `sectionNodes.video = hasThemeVideo(data.video, content.youtubeUrl) ? <VideoSection .../> : null`
   — section kecil di `sections.tsx` tema: eyebrow + `<ThemeVideo video={data.video} youtubeUrl={content.youtubeUrl} labels={...}/>`
   (labels aria dari `lib/copy.ts` publik, SATU sumber: `copy.public.video = { play, unmute, mute }`).
4. CSS tema: tata `.video-frame` dkk. dengan token tema (contoh lengkap gaya
   Kirana ada di `prototypes/video-section.html`). Scope di bawah kelas akar
   tema. `reduced-motion` tak perlu rule khusus (komponen yang menangani).
5. JANGAN menambah video ke demo-data mana pun (pratinjau katalog harus tetap
   tanpa beban media berat/pihak ketiga).
- Gate penuh + cek visual `/preview/tema/{slug}` minimal kirana, lumina, satu
  tema gelap.

### J5 — CSP & penutup
- Periksa next.config / middleware / vercel.json untuk header CSP. Bila ada:
  `img-src` += `https://i.ytimg.com`; `frame-src` += `https://www.youtube-nocookie.com`;
  `media-src` mencakup domain storage publik. Bila tidak ada CSP, catat dan lewati.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` + laporkan hasil.

## 4. Jebakan yang sudah diketahui (jangan diulang)

- React tidak selalu menulis atribut `muted` ke DOM — `video.tsx` sudah
  menanganinya via properti di ref; jangan "menyederhanakan" ini.
- ESLint repo menolak setState sinkron di badan efek
  (`react-hooks/set-state-in-effect`) — pola rAF seperti `Reveal` di
  `_shared/motion.tsx`; `video.tsx` sudah mematuhinya.
- jsdom tidak mengimplementasikan `play()`/IO — komponen sudah menjaga; test
  baru jangan mem-mock global tanpa membersihkan.
- `i.ytimg.com` mungkin diblokir di lingkungan sandbox tertentu (poster abu-abu)
  — normal di produksi; jangan "memperbaiki" dengan menyalin poster ke storage.
- Keputusan arsitektur "aksi unggah tidak menulis DB" itu DISENGAJA (baca
  komentar panjang di `named-photo.ts`) — mengubahnya merusak autosave.

## 5. Definisi selesai

- Semua gate hijau (lint, typecheck, test, build).
- Undangan paket dengan `limits.youtube=false`: section video TIDAK tampil
  meski content berisi video/tautan (uji via pratinjau paket Basic).
- Upload >40 MB / >61 dtk / potret / tipe salah ditolak DI KLIEN dengan pesan
  Indonesia, dan ukuran/tipe ditolak ulang DI SERVER.
- Facade YouTube: TIDAK ada request ke youtube/ytimg selain satu poster sebelum
  klik (cek tab Network).
- Reduced-motion OS aktif → video tidak berputar sendiri.
