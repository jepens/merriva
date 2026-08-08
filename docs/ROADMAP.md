# ROADMAP — Merriva MVP Fase 1

**Versi:** 1.0 — 24 Juli 2026 · Estimasi total: 8–10 minggu (bisa terkompresi dengan pengerjaan intensif berbantuan AI).

**Definition of Done global (berlaku semua milestone):** kriteria terima `SPEC.md` §4 modul terkait terpenuhi · `pnpm lint && pnpm typecheck && pnpm test` bersih · test E2E jalur terkait hijau · tidak menurunkan Lighthouse halaman publik · perubahan keputusan tercatat di `DECISIONS.md`.

> **STATUS (2026-08-08): kode M0–M4 pada dasarnya SELESAI.** Seluruh jalur inti
> terbukti di kode (diaudit ulang; lihat commit log). Sisa menuju launch adalah
> **eksekusi OPS** (deploy, DNS, monitoring eksternal, plan berbayar, uji
> lapangan) yang dikonsolidasi & diurutkan di **[`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md)**.
> Di bawah, `[x]` = kode selesai; item yang butuh tindakan pemilik ditandai
> **(ops → LAUNCH-CHECKLIST)**.

---

## M0 — Fondasi (~1 minggu)

**Hasil akhir:** deploy otomatis jalan; `https://merriva.id/api/health` hijau dari internet.

- [ ] Prasyarat pemilik: domain dibeli, 2 project Supabase, repo Git, VPS + Easypanel siap **(ops → LAUNCH-CHECKLIST)**
- [x] Init Next.js (App Router, TS strict) + Tailwind + shadcn/ui + ESLint/Prettier + Vitest + Playwright
- [x] Struktur folder sesuai `SPEC.md` §7 (termasuk `src/themes/registry.ts`, `lib/storage/`, `lib/payment/`, `lib/copy.ts`)
- [x] `.env.example` lengkap (daftar di `ARCHITECTURE.md` §8)
- [x] **migrasi v1 seluruh skema `DATA-MODEL.md` + RLS + index** + seed packages (kode; terapkan ke cloud = ops)
- [x] Client Supabase (server & browser) + helper auth
- [x] `Dockerfile` multi-stage standalone + `/api/health` (cek DB) + `next.config.ts` `output:'standalone'`
- [ ] App Easypanel dari repo (auto-deploy saat push `main`), domain `merriva.id` + SSL, env production **(ops → LAUNCH-CHECKLIST)**
- [ ] DNS di Cloudflare (proxy ON), `www` redirect **(ops → LAUNCH-CHECKLIST)**
- [x] CI (GitHub Actions): lint + typecheck + test di setiap push/PR
- [x] Sentry terpasang (FE+BE) · UptimeRobot ke `/api/health` **(ops → LAUNCH-CHECKLIST)**
- [x] Dokumentasikan prosedur pemulihan VPS (`docs/RUNBOOK.md`)

## M1 — Buat undangan (2–3 minggu)

**Hasil akhir:** klien bisa daftar, membuat, dan mem-preview undangan lengkap dari HP.

- [x] Auth: register email + verifikasi, login, Google OAuth, reset password, halaman profil (nama, WA)
- [x] Dashboard klien: daftar undangan + status + aksi per status; onboarding klien baru → langsung buat undangan
- [x] Form multi-step 3 kategori (skema Zod per kategori — `SPEC.md` §4.4): info dasar & slug checker real-time, detail pihak, jadwal multi-sesi, galeri (kompresi klien 2 varian WebP + upload via `lib/storage/`), love story/agenda, amplop digital, pengaturan (tema, toggle section, **musik latar**)
- [x] Autosave per step + indikator selesai
- [x] Tema pertama `eternal-rose` **tier Signature** via registry + `demo-data.ts` + halaman preview mode draft (hanya pemilik)
- [x] Enforcement limit paket server-side (foto/tamu) — trigger DB, bukan hanya UI

## M2 — Halaman publik & tamu (~2 minggu)

**Hasil akhir:** alur tamu end-to-end berjalan mulus di WebView WhatsApp.

- [x] Halaman `/{slug}` ISR + revalidate saat simpan; cover "Kepada Yth." + buka undangan + musik
- [x] Section: hero, countdown, jadwal + tombol Maps + simpan kalender (.ics/Google), galeri, love story, amplop (modal salin + konfirmasi privat), footer (watermark utk Basic)
- [x] RSVP + ucapan (form gabungan) + dinding ucapan (paginasi, moderasi, sembunyikan) — server action + Turnstile + rate limit + honeypot
- [x] Manajemen tamu: CRUD, label, import Excel/CSV (preview + laporan baris gagal), export
- [x] Link personal `?g=token`: prefill nama & RSVP, catat `first_viewed_at`
- [x] Halaman "Sebar Undangan": template pesan `{nama}/{link}/{acara}`, tombol `wa.me` per tamu (catat `wa_clicked_at`), salin per tamu / semua
- [x] OG image otomatis per undangan (`/api/og/[slug]`)
- [ ] Uji nyata di WebView WA Android & iOS + Lighthouse mobile ≥ 90 **(ops → LAUNCH-CHECKLIST §7)**

## M3 — Monetisasi (1–2 minggu)

**Hasil akhir:** bayar → aktif → kuitansi, tanpa campur tangan manual.

- [x] Halaman pilih paket (data dari `packages`) + checkout → order `pending` + redirect payment link Pakasir
- [x] Webhook `/api/webhooks/pakasir`: verifikasi 2 lapis (match DB + `transactiondetail`), idempotent, aktivasi + hitung `active_until`
- [x] Halaman cek status pembayaran (poll `transactiondetail`)
- [x] Cron: expire order 24 jam (+ `transactioncancel`), expire undangan, reminder H-14 (kode; penjadwalan = ops → LAUNCH-CHECKLIST §3)
- [x] Email transaksional (Resend): kuitansi + link aktif, pengingat expiry (verifikasi signup via Supabase Auth)
- [x] Enforcement penuh limit paket + watermark Basic
- [x] E2E: checkout → `paymentsimulation` → webhook → aktif (butuh kredensial sandbox untuk dijalankan)

## M4 — Launch (~2 minggu)

**Hasil akhir:** go-live komersial dengan 10 undangan uji lintas kategori.

- [x] Panel admin: metrik, kelola user (ubah peran + tangguhkan/pulihkan akun) / undangan / order (aktivasi manual, perpanjang, suspend, ganti pemilik), CRUD paket & tema, kelola lagu, `admin_logs`
- [x] Tema: **10 terdaftar & ter-seed** (jauh di atas target 6) lintas wedding/corporate/family/universal
- [x] Landing page final + katalog + demo + harga + FAQ + kebijakan privasi & refund
- [x] Driver R2 + skrip migrasi media siap (kode); **aktivasi + `cdn.merriva.id` = ops → LAUNCH-CHECKLIST §5**
- [ ] Upgrade Supabase Pro; latihan restore backup 1× **(ops → LAUNCH-CHECKLIST §5)**
- [x] Harness k6 200 VU siap; **jalankan + checklist pra-launch `SPEC.md` §10 = ops → LAUNCH-CHECKLIST §7**
- [ ] Pembayaran production nominal kecil end-to-end **(ops → LAUNCH-CHECKLIST §7)**
- [ ] Go-live + monitoring aktif **(ops → LAUNCH-CHECKLIST §6, §9)**

---

## Setelah MVP (gambaran — spec terpisah menyusul)

**Fase 2 — Buku tamu QR** (fondasi sudah disiapkan: `guests.token`, `invitation_events`): e-ticket QR, scanner PWA offline-first, layar sapa, dashboard kehadiran real-time (Supabase Realtime), denah meja, souvenir/angpau, doorprize, multi-gate, export. **Fase 3 — Kenangan:** upload foto/video/pesan suara tamu via QR yang sama (R2 sudah siap), moderasi, live slideshow, album pasca-acara. **Fase 4 — Skala:** reseller/white-label, WA Business API resmi, corporate lanjutan, custom domain otomatis.
