# MOMEN-PROMPT — PROMPT FASE H: Album Momen (Kamera Sekali Pakai)

Prompt siap-tempel untuk Claude Code di VSCode, kelanjutan seri PORTING-PROMPT (Fase A–G selesai).
Spesifikasi: `docs/MOMEN-SPEC.md` · Prototipe teruji: `prototypes/momen-album.html` · Modul inti teruji: `handoff/momen/`

Jalankan setelah Fase G stabil. Fase ini menyentuh DB + pembayaran add-on — kerjakan bertahap, jangan sekali jalan.

---

## PROMPT FASE H (salin mulai dari sini)

```
Kamu mengerjakan proyek Merriva. Tugas: bangun fitur "Album Momen" — kamera sekali pakai
digital sebagai ADD-ON undangan — sesuai docs/MOMEN-SPEC.md. Baca spec itu sampai habis,
lalu buka prototypes/momen-album.html di browser (acuan UX final yang sudah teruji;
tombol ⚙ = mode host/moderasi, tombol </> = bentuk data, buka juga tanpa kamera untuk
melihat fallback mode demo).

PENTING — MODUL INTI SUDAH JADI & TERUJI: handoff/momen/ berisi film-presets,
film-render (pipeline piksel bake filter — SENGAJA tanpa ctx.filter, alasan di README),
album-phase (logika reveal fail-closed), shot-quota, momen-settings-schema (Zod v4),
dan test-nya (40/40 hijau, tsc strict lolos — bukti di handoff/momen/README.md).
PINDAHKAN sesuai peta penempatan README itu ke src/lib/momen/ — JANGAN tulis ulang
logikanya; test wajib tetap hijau setelah pemindahan.

LANGKAH 0 — SURVEI (wajib, source-driven):
1. Baca CLAUDE.md (aturan & boundaries proyek), lalu handoff/momen/README.md +
   docs/MOMEN-SPEC.md sampai habis (§4–§6 paling menentukan implementasi).
2. Survei kode nyata: skema orders/packages + alur aktivasi Pakasir yang ada
   (webhook 2 lapis, RPC activate_paid_order) — MOMEN-SPEC §4 sengaja tidak
   mengasumsikan kolomnya; putuskan cara paling kecil menambahkan pembelian add-on
   yang MEMAKAI-ULANG alur order yang sudah teruji, jangan bikin alur bayar kedua.
3. Survei pola yang akan dipakai-ulang: insert_gallery_media_rpc (RPC security definer),
   turnstile-field, lib/image/compress.ts, lib/storage, data_retention_purge,
   rate-limit ucapan.
4. Verifikasi dokumentasi TERKINI via Context7 (bila ada di .mcp.json) / docs resmi
   untuk API yang disentuh. Empat fakta SUDAH diverifikasi 26 Agu 2026 — patuhi:
   (a) Next 16: updateTag HANYA di Server Action (read-your-own-writes);
       revalidateTag(tag,'max') untuk Route Handler — aturan sama dgn Fase G;
   (b) Zod v4: z.strictObject / z.uuid() / z.iso.datetime({offset:true}) adalah
       API kanonis — modul handoff sudah memakainya, jangan "dimodernkan";
   (c) caniuse: CanvasRenderingContext2D.filter masih disabled-by-default di
       Safari/iOS 18–26.x → pipeline piksel handoff WAJIB, jangan ganti ctx.filter;
   (d) caniuse: canvas.toBlob('image/webp') TIDAK didukung Safari/iOS (fallback
       diam-diamnya PNG lossless raksasa) → semua encode klien wajib cek
       blob.type lalu fallback JPEG q0.82; server tolak selain webp/jpeg.
5. BUG LATEN yang wajib ikut diperbaiki di fase ini: src/lib/image/compress.ts
   saat ini TIDAK memeriksa blob.type (lihat toWebp) — upload galeri undangan
   dari iPhone menyimpan PNG bernama 1600.webp. Buat satu util fallback
   (webp→jpeg) yang dipakai galeri undangan DAN Momen; tambah unit test-nya.
Laporkan hasil survei + rencana + pertanyaan padaku, tunggu konfirmasiku.

IMPLEMENTASI (commit kecil bertahap, urutan disarankan):
1. Pindahkan modul handoff → src/lib/momen/ + test hijau.
2. Migrasi DB momen_albums + momen_photos (DDL MOMEN-SPEC §4, ikuti konvensi migrasi
   repo) + RLS + RPC atomik momen_claim_upload/momen_confirm_photo: kuota total &
   per-device ditegakkan DI DALAM transaksi (photo_count counter), foto pra-reveal
   TIDAK bisa dibaca anon (fail-closed, aturan sama dgn album-phase.ts). Unit/integrasi
   test: kuota tak tembus walau paralel; anon tak bisa baca foto hidden/pra-reveal.
3. Alur beli add-on dari dashboard (hasil survei langkah 0) → aktivasi membuat baris
   momen_albums. Verifikasi webhook 2 lapis TIDAK berubah.
4. Route publik /[slug]/momen (client component kamera):
   - masuk nama + Turnstile (komponen yang ada) → cookie sesi ber-tanda-tangan
     (device_id) — RPC menolak tanpa sesi;
   - kamera: getUserMedia + fallback <input capture>, preview = preset.css + overlay
     (pola prototipe), jepret = bake applyFilmToPixels → kompres 2 varian
     webp-atau-jpeg (util compress.ts yang sudah ber-fallback; server TIDAK
     memproses gambar — boundary CLAUDE.md) → claim RPC → upload storage
     (ekstensi & content-type ikut format aktual) → confirm RPC;
   - layar jatah habis + countdown (countdownParts) → galeri reveal (grid 2 kolom
     BLOCK-FLOW seperti prototipe — JANGAN CSS grid utk tile rasio: baris grid
     terbukti kolaps utk item rasio, catatan di sumber prototipe) + atribusi nama
     + unduh per foto. Undangan tanpa add-on aktif: menu tak muncul, route →
     halaman "belum aktif".
5. Dashboard /dashboard/undangan/[id]/momen: pengaturan (updateMomenSettings dgn
   momenSettingsSchema; simpan → updateTag), pantau kuota, moderasi
   sembunyikan/tampilkan/hapus (momenModerationSchema), reveal-sekarang,
   halaman cetak QR A6, unduh ZIP (route streaming, auth pemilik, jangan buffer
   penuh di memori).
6. Retensi: perluas purge yang ada agar mencakup momen_* + objek storage
   (MOMEN-SPEC §6) + bersihkan objek yatim claim-tanpa-confirm.

ATURAN: patuh boundaries CLAUDE.md · pemrosesan gambar HANYA di browser klien ·
jangan menyentuh kontrak InvitationData & tema · gsap/lenis tidak dipakai fitur ini ·
Conventional Commits kecil · jangan mengubah SPEC.md; catat keputusan baru di
docs/DECISIONS.md (entri baru: Album Momen, tanggal, keputusan add-on & tier harga).

SELESAI = DoD MOMEN-SPEC §8 terpenuhi. Akhiri dengan laporan: perbandingan alur
tamu vs prototipe, bukti test kuota/fail-closed, angka bundle route publik momen,
dan daftar hal yang sengaja ditunda. Uji HP nyata (Android + iOS + WebView WA)
tetap tugasku — beri tahu aku URL preview yang harus kubuka.
```

---

**Catatan untuk pemilik:**

1. Harga tier (Momen 300 = Rp99rb, Momen 1000 = Rp179rb) adalah PROPOSAL — final di tanganmu; ubah angkanya di MOMEN-SPEC §7 sebelum menjalankan Fase H bila perlu.
2. Prasyarat rilis: media sudah pindah R2 (checklist M4) — Supabase free 1GB hanya muat ±7 album penuh.
3. Setelah Fase H jadi, uji di HP nyata dari link WhatsApp: kamera iOS Safari & WebView WA Android adalah dua lingkungan paling rewel (getUserMedia di WebView WA kadang ditolak → fallback <input capture> harus mulus).
4. Prototipe HTML tetap sumber kebenaran UX; bila ingin mengubah detail, ubah dulu prototipenya supaya desain & kode tidak berpisah jalan.
