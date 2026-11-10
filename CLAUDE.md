# CLAUDE.md — Merriva

Platform SaaS undangan digital + digital guestbook untuk pasar Indonesia. Fase saat ini: **MVP Fase 1 — undangan digital self-service**. Status kode: **M0–M4 selesai; produksi hidup di merriva.id dengan undangan berbayar pertama**. Sisa pekerjaan bersifat operasional — lihat `docs/LAUNCH-CHECKLIST.md`, bukan `docs/ROADMAP.md`.

Domain: **merriva.id** · Bahasa UI: **Indonesia** · Semua timestamp disimpan UTC, ditampilkan sesuai timezone acara (WIB/WITA/WIT).

## Peta dokumen

| File | Isi | Kapan dibaca |
|---|---|---|
| `SPEC.md` | **Sumber kebenaran**: fitur + kriteria terima (§4), model data (§5), arsitektur (§6), boundaries (§11) | Sebelum mengerjakan fitur apa pun |
| `docs/PRD.md` | Konteks produk: pasar, persona, metrik, harga | Saat butuh konteks "kenapa" |
| `docs/ARCHITECTURE.md` | Arsitektur, deployment Easypanel, integrasi Pakasir & storage | Saat setup infra / integrasi |
| `docs/DATA-MODEL.md` | Skema DB lengkap, RLS matrix, lifecycle data | Saat membuat migrasi / query |
| `docs/ROADMAP.md` | Milestone M0–M4 + checklist rinci + Definition of Done | Awal sesi: cek posisi pekerjaan |
| `docs/DECISIONS.md` | Log keputusan (ADR). **Keputusan baru wajib dicatat di sini** | Sebelum mengusulkan perubahan pendekatan |
| `docs/THEME-DESIGN.md` | Art direction & sistem motion tema (3 tingkat: Craft/Story/Signature) + budget performa | **Wajib sebelum membuat/mengubah tema** — acuan visual: 6 prototipe di `prototypes/` (satu per tema) |
| `docs/MOMEN-SPEC.md` | Spesifikasi add-on **Album Momen** (FASE H): model peserta, gerbang kuota atomik, fase reveal, moderasi, retensi | Saat menyentuh apa pun di `src/**/momen*` atau tabel `momen_*` |
| `docs/CUSTOMIZER-SPEC.md` | Kontrak kustomisasi tampilan tema (varian warna, pasangan font, urutan section) | Saat mengubah `options.ts` tema atau editor tampilan |
| `docs/THEME-CONTRACT.md` | **Kontrak tema v2** (usulan): kosakata section kanonik, blok `media` di `options.ts`, foto non-destruktif, scaffold, test konformansi | **Wajib sebelum menambah tema baru** atau mengubah `ThemeOptions`/kontrak props |
| `docs/THEME-PORTING.md` | Kontrak pemasangan prototipe→tema: infra bersama (`cover-gate`, `gsap-motion`, `silk-canvas`, `particles-canvas`), ketentuan per-tema, anggaran bundle per tier, DoD §5 | Saat mem-port/upgrade tema dari `prototypes/` (status pemetaan & bundle: DECISIONS #12) |

## Aturan kerja

1. **Spec-first.** Perubahan scope/perilaku diubah dulu di `SPEC.md` (minta persetujuan pemilik), baru diimplementasikan.
2. **Definisi selesai:** kriteria terima `SPEC.md` §4 terpenuhi + test terkait hijau + `pnpm lint && pnpm typecheck && pnpm test` bersih. Jangan klaim selesai sebelum itu.
3. Ikuti urutan `docs/ROADMAP.md`; jangan mulai milestone berikutnya sebelum kriteria milestone berjalan terpenuhi.
4. Keputusan teknis baru (library, pola, trade-off) → tambah entri di `docs/DECISIONS.md` dengan tanggal & alasan.
5. Kerja incremental: commit kecil per perubahan logis, format Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
6. Bila butuh kredensial/akun (Supabase, Pakasir, Resend, dsb): buat/perbarui `.env.example` lalu minta pemilik mengisi `.env` — jangan pernah menulis nilai rahasia ke file yang di-commit.

## Commands

```bash
pnpm dev                  # dev server http://localhost:3000
pnpm build && pnpm start  # build & run production lokal
pnpm lint                 # ESLint + Prettier check
pnpm typecheck            # tsc --noEmit
pnpm test                 # unit test (Vitest)
pnpm env:check            # periksa .env.local  — sebut yang kosong + akibatnya
pnpm env:check --prod     # periksa .env.production.local (nilai utk Easypanel)
pnpm ops:verify           # periksa PRODUKSI yang sedang berjalan: konfigurasi Auth Supabase,
                          # DNS (MX/DMARC/DKIM), build-arg yang benar-benar ter-inline di bundel,
                          # kesehatan cron, objek media, ISR. Berkas lokal hanya sumber KUNCI —
                          # bukan sumber kebenaran tentang apa yang terpasang (lihat docstringnya)
pnpm test:e2e             # Playwright (butuh env staging)
pnpm brand:assets         # regenerasi favicon/ikon/OG/banner dari master SVG public/brand/ (Chromium Playwright)
pnpm test:db              # pgTAP supabase/tests/ (butuh stack lokal `supabase start`; job `db` terpisah di CI)
supabase migration new <nama>   # migrasi baru (folder supabase/migrations)
supabase db push          # terapkan migrasi ke project cloud yang ter-link
docker build -t merriva . # verifikasi image sebelum push (deploy = push `main` → CI hijau → job promote
                          # memajukan `production` → Easypanel Auto Deploy, ±5–7 menit; CI merah = tak ter-deploy)
```

## Stack ringkas

Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui (dashboard) + Framer Motion (tema) · Supabase cloud: Postgres + RLS + Auth (+ Storage pada fase awal) · Media via `lib/storage/` dengan driver `supabase` | `local` (disk VPS, disajikan route `/media`) | `r2` (env `STORAGE_DRIVER`) · Pembayaran: **Pakasir** (payment link + webhook) · Email: Resend · Anti-spam: Cloudflare Turnstile · Deploy: Dockerfile (Next standalone) → Easypanel di VPS.

## Gaya kode

TypeScript `strict`, hindari `any`. Server Components secara default; `"use client"` hanya untuk interaktivitas. Semua mutasi lewat Server Actions di `src/server/actions/` dengan pola wajib: **auth → cek kepemilikan → validasi Zod → operasi → revalidate cache**. Input selalu divalidasi ulang di server. Uang = integer IDR, tanpa float. Teks UI bahasa Indonesia dan terpusat di `lib/copy.ts`. Penamaan: file `kebab-case`, komponen `PascalCase`, fungsi `camelCase`, tabel/kolom DB `snake_case`.

## Boundaries (ringkas — lengkapnya di SPEC.md §11)

**SELALU:** RLS aktif di setiap tabel baru sebelum migrasi dipush · verifikasi webhook Pakasir dengan memanggil **status transaksi** sebelum aktivasi (payload webhook = sinyal, bukan bukti). Sejak **API v2** webhook membawa header `X-Secret` sehingga BISA diautentikasi — itu aditif, tidak menggantikan verifikasi otoritatif. Endpoint v2: `GET /api/v2/transaction-status/{slug}/{txn_id}` (berkunci `txn_id`, bukan `order_id`); v1 `transactiondetail` dihentikan 20 Okt 2026 · rate limit endpoint publik · `paymentsimulation` (bukan uang asli) di luar production.

**TANYA DULU:** ubah harga/struktur paket · migrasi destruktif pada data production · dependency besar / layanan berbayar baru · ubah kontrak props tema (berdampak semua tema).

**JANGAN PERNAH:** commit secrets/`.env` · simpan URL vendor storage di DB atau serve media dari URL vendor (selalu via `lib/storage/` + domain sendiri) · Google Drive/file-sharing personal sebagai backend media · WA blast lewat API tidak resmi · simpan data pembayaran sensitif · hapus undangan yang masih aktif · biarkan musik yang dilaporkan/diketahui melanggar hak cipta tetap tersaji, termasuk lewat URL langsung & cache edge (DECISIONS #121) · ekspos `guests`/`gift_notes`/`orders` di API publik · push manual ke branch `production` — hanya job `promote` CI yang menggerakkannya (DECISIONS #64); pengecualian satu-satunya: jalur darurat pemilik di `docs/RUNBOOK.md` Skenario A2 · push ke `main` pada hari acara klien berlangsung, kecuali perbaikan darurat yang disetujui pemilik — setiap push yang lolos CI = redeploy penuh (restart kontainer + cache ISR kosong), termasuk commit dokumen saja (SPEC §11).

## Konteks penting yang sering terlupa

- Halaman undangan dibuka mayoritas lewat **WebView WhatsApp** Android/iOS — selalu uji di sana, bukan hanya Chrome desktop.
- Target performa halaman publik: **Lighthouse mobile ≥ 90, LCP < 2,5 dtk di 4G** — jangan menambah JS berat ke halaman undangan; render via ISR (revalidate saat pemilik menyimpan).
- `guests.token` adalah identitas tamu dan kelak menjadi QR check-in Fase 2 — desain apa pun tidak boleh menghalangi itu.
- Foto dikompres di browser klien (2 varian WebP: 400px & 1600px) sebelum upload — server tidak memproses gambar galeri.
- Paket Basic dibatasi server-side (500 tamu, 8 foto, watermark); jangan hanya membatasi di UI.
