# PROMPT KICK-OFF — FASE J: Section Video untuk Semua Tema

Salin seluruh blok di bawah garis ke sesi agen baru di VS Code (root repo
`saas-undangan`). Jalankan SETELAH pekerjaan paralel lain selesai atau di
branch terpisah — FASE J menyentuh file lintas-fitur (`copy.ts`, section-vocab,
14 tema).

---

Kerjakan FASE J: fitur "Video" opsional untuk SEMUA tema undangan.

MULAI DI SINI:
1. Baca `handoff/video/VIDEO-SPEC.md` SELURUHNYA — semua keputusan produk sudah
   terkunci di sana (hibrida file+YouTube, ≤60 dtk & ≤40 MB, landscape wajib,
   prioritas file > YouTube, gating paket `limits.youtube` untuk kedua sumber,
   facade youtube-nocookie, autoplay senyap + reduced-motion). Jangan membuka
   ulang keputusan ini.
2. Buka `handoff/video/prototypes/video-section.html` di browser untuk melihat
   perilaku target (sampel klip di `handoff/video/sample/`).
3. Modul inti SUDAH JADI dan sudah lulus tsc+eslint+prettier+11 unit test:
   salin apa adanya dari `handoff/video/modules/` ke path yang sama
   (`src/themes/_shared/youtube.ts`, `src/themes/_shared/video.tsx`,
   `src/lib/video.ts`, `tests/unit/theme-video.test.tsx`). Jangan menulis ulang.
4. Terapkan langkah J1→J5 persis sesuai urutan di spec §3, dengan
   `pnpm lint && pnpm typecheck && pnpm test` hijau di setiap langkah dan
   `pnpm build` di akhir.

ATURAN REPO YANG WAJIB DIPATUHI (sudah ada preseden di kode):
- Tema TIDAK mengambil data sendiri (SPEC §7.1); semua data video datang dari
  `InvitationData` / `content` yang dirakit server.
- Aksi unggah TIDAK menulis DB — `content.video` disimpan autosave (baca
  komentar panjang di `server/actions/named-photo.ts` sebelum protes).
- Penegakan paket DI SERVER, bukan hanya UI (pola `watermark`/`settings.custom`).
- Semua copy UI dari `lib/copy.ts`; label tema di `labels.ts` per tema;
  SELURUHNYA Bahasa Indonesia (keputusan owner 5 Nov 2026 — tanpa bahasa
  daerah).
- Id section baru `video` masuk kosakata kanonik (section-vocab) +
  `copy.appearance.sectionLabels` — test konformitas akan menegakkannya.
- Jangan menambah video ke demo-data tema mana pun.
- JANGAN mengubah berkas di `handoff/` — itu artefak acuan.

URUTAN KERJA = §3 spec (J1 modul/vocab/copy → J2 data/server/retensi →
J3 editor → J4 empat belas tema → J5 CSP + build). Jebakan yang sudah
diketahui ada di §4 — baca sebelum koding. Definisi selesai di §5.

Laporkan di akhir: diff ringkas per langkah, hasil keempat gate, dan daftar
tema yang sudah diberi section video beserta posisi defaultnya.
