# ROADMAP — Merriva MVP Fase 1

**Versi:** 1.0 — 24 Juli 2026 · Estimasi total: 8–10 minggu (bisa terkompresi dengan pengerjaan intensif berbantuan AI).

**Definition of Done global (berlaku semua milestone):** kriteria terima `SPEC.md` §4 modul terkait terpenuhi · `pnpm lint && pnpm typecheck && pnpm test` bersih · test E2E jalur terkait hijau · tidak menurunkan Lighthouse halaman publik · perubahan keputusan tercatat di `DECISIONS.md`.

---

## M0 — Fondasi (~1 minggu)

**Hasil akhir:** deploy otomatis jalan; `https://merriva.id/api/health` hijau dari internet.

- [ ] Prasyarat pemilik (lihat `KICKOFF-PROMPT.md`): domain dibeli, 2 project Supabase, repo Git, VPS + Easypanel siap
- [ ] Init Next.js (App Router, TS strict) + Tailwind + shadcn/ui + ESLint/Prettier + Vitest + Playwright
- [ ] Struktur folder sesuai `SPEC.md` §7 (termasuk `src/themes/registry.ts` kosong, `lib/storage/`, `lib/payment/`, `lib/copy.ts`)
- [ ] `.env.example` lengkap (daftar di `ARCHITECTURE.md` §8)
- [ ] Supabase CLI ter-link ke staging; **migrasi v1 seluruh skema `DATA-MODEL.md` + RLS + index** + seed packages
- [ ] Client Supabase (server & browser) + helper auth
- [ ] `Dockerfile` multi-stage standalone + `/api/health` (cek DB) + `next.config.ts` `output:'standalone'`
- [ ] App Easypanel dari repo (auto-deploy saat push `main`), domain `merriva.id` + SSL, env production di panel
- [ ] DNS di Cloudflare (proxy ON), `www` redirect
- [ ] CI (GitHub Actions): lint + typecheck + test di setiap push/PR
- [ ] Sentry terpasang (FE+BE) + UptimeRobot ke `/api/health`
- [ ] Dokumentasikan prosedur pemulihan VPS (runbook singkat di `docs/`)

## M1 — Buat undangan (2–3 minggu)

**Hasil akhir:** klien bisa daftar, membuat, dan mem-preview undangan lengkap dari HP.

- [ ] Auth: register email + verifikasi, login, Google OAuth, reset password, halaman profil (nama, WA)
- [ ] Dashboard klien: daftar undangan + status + aksi per status; onboarding klien baru → langsung buat undangan
- [ ] Form multi-step 3 kategori (skema Zod per kategori — `SPEC.md` §4.4): info dasar & slug checker real-time, detail pihak, jadwal multi-sesi, galeri (kompresi klien 2 varian WebP + upload via `lib/storage/` driver supabase), love story/agenda, amplop digital, pengaturan (tema, toggle section)
- [ ] Autosave per step + indikator selesai
- [ ] Tema pertama (`eternal-rose` atau sejenis) via registry + `demo-data.ts` + halaman preview mode draft (hanya pemilik)
- [x] Enforcement limit paket server-side (foto/tamu) — struktur siap meski paket baru dibeli di M3

## M2 — Halaman publik & tamu (~2 minggu)

**Hasil akhir:** alur tamu end-to-end berjalan mulus di WebView WhatsApp.

- [x] Halaman `/{slug}` ISR + revalidate saat simpan; cover "Kepada Yth." + buka undangan + musik
- [x] Section: hero, countdown, jadwal + tombol Maps + simpan kalender (.ics/Google), galeri, love story, amplop (modal salin + konfirmasi privat), footer (watermark utk Basic)
- [x] RSVP + ucapan (form gabungan) + dinding ucapan (paginasi, moderasi, sembunyikan) — server action + Turnstile + rate limit + honeypot
- [x] Manajemen tamu: CRUD, label, import Excel/CSV (preview + laporan baris gagal), export
- [x] Link personal `?g=token`: prefill nama & RSVP, catat `first_viewed_at`
- [x] Halaman "Sebar Undangan": template pesan `{nama}/{link}/{acara}`, tombol `wa.me` per tamu (catat `wa_clicked_at`), salin per tamu / semua
- [x] OG image otomatis per undangan (`/api/og/[slug]`)
- [ ] Uji nyata di WebView WA Android & iOS + Lighthouse mobile ≥ 90 — **QA manual pemilik di staging/production**: kode M2 lengkap & terverifikasi lokal (server + browser mobile 390px), tetapi WebView WA nyata iOS/Android + Lighthouse ≥90 wajib diukur di build produksi/perangkat asli (SPEC §10). Fokus uji M2.6: unduh `.ics` di WebView WA iOS (opsi Google jadi cadangan bila WKWebView menolak unduhan).

## M3 — Monetisasi (1–2 minggu)

**Hasil akhir:** bayar → aktif → kuitansi, tanpa campur tangan manual.

- [x] Halaman pilih paket (data dari `packages`) + checkout → order `pending` + redirect payment link Pakasir — **M3.1**
- [ ] Webhook `/api/webhooks/pakasir`: verifikasi 2 lapis (match DB + `transactiondetail`), idempotent, aktivasi + hitung `active_until`
- [ ] Halaman cek status pembayaran (poll `transactiondetail`)
- [ ] Cron: expire order 24 jam (+ `transactioncancel`), expire undangan, reminder H-14
- [ ] Email transaksional (Resend): verifikasi, kuitansi + link aktif, pengingat expiry
- [ ] Enforcement penuh limit paket + watermark Basic
- [ ] E2E: checkout → `paymentsimulation` → webhook → aktif

## M4 — Launch (~2 minggu)

**Hasil akhir:** go-live komersial dengan 10 undangan uji lintas kategori.

- [ ] Panel admin: metrik, kelola user/undangan/order (aktivasi manual, perpanjang, suspend, ganti pemilik), CRUD paket & tema, `admin_logs`
- [ ] 5 tema tambahan (total 6: 3 wedding, 1 corporate, 1 family, 1 universal)
- [ ] Landing page final + katalog + demo + harga + FAQ + kebijakan privasi & refund
- [ ] **Aktivasi R2 + migrasi media dari Supabase** (`ARCHITECTURE.md` §6) + `cdn.merriva.id`
- [ ] Upgrade Supabase Pro; latihan restore backup 1×
- [ ] Uji beban ringan halaman undangan (k6, 200 concurrent) + checklist pra-launch `SPEC.md` §10
- [ ] Pembayaran production nominal kecil end-to-end
- [ ] Go-live + monitoring aktif

---

## Setelah MVP (gambaran — spec terpisah menyusul)

**Fase 2 — Buku tamu QR** (fondasi sudah disiapkan: `guests.token`, `invitation_events`): e-ticket QR, scanner PWA offline-first, layar sapa, dashboard kehadiran real-time (Supabase Realtime), denah meja, souvenir/angpau, doorprize, multi-gate, export. **Fase 3 — Kenangan:** upload foto/video/pesan suara tamu via QR yang sama (R2 sudah siap), moderasi, live slideshow, album pasca-acara. **Fase 4 — Skala:** reseller/white-label, WA Business API resmi, corporate lanjutan, custom domain otomatis.
