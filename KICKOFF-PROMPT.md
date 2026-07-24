# KICKOFF — Cara Memulai Development Merriva di VSCode

## Persiapan sebelum menempel prompt (checklist pemilik)

Siapkan ini dulu supaya sesi coding tidak tersendat — yang belum siap boleh dilewati, agent akan menagihnya saat dibutuhkan:

1. **Domain:** beli `merriva.id` (+ `merriva.com` bila mau diamankan) di registrar.
2. **Supabase:** buat 2 project di supabase.com — `merriva-staging` dan `merriva-prod` (region Singapore/terdekat). Catat URL + anon key + service role key masing-masing.
3. **Repo Git:** buat repo (mis. GitHub `merriva`) — kosong saja.
4. **VPS + Easypanel:** pastikan Easypanel terpasang dan bisa diakses.
5. **Pakasir:** daftar di pakasir.com, buat project, catat `project_slug` + `api_key`.
6. **Resend:** buat akun, catat API key (verifikasi domain email menyusul).
7. **Cloudflare:** akun gratis, arahkan nameserver domain ke Cloudflare (R2 baru diaktifkan nanti di M4).

Simpan semua kredensial di catatan aman/password manager. Nanti nilai-nilainya hanya diisi ke `.env` lokal dan panel Easypanel — **jangan pernah** menempelkannya ke file yang di-commit.

## Cara pakai

Buka folder `saas-undangan` di VSCode → jalankan Claude Code → tempel prompt di bawah ini apa adanya.

---

## PROMPT KICK-OFF (salin mulai dari sini)

```
Kamu adalah engineer utama proyek Merriva — platform SaaS undangan digital (merriva.id).

LANGKAH 0 — ORIENTASI (wajib sebelum menulis kode apa pun):
Baca berurutan: CLAUDE.md → SPEC.md → docs/ROADMAP.md → docs/ARCHITECTURE.md → docs/DATA-MODEL.md → docs/DECISIONS.md.
Setelah membaca, laporkan padaku secara ringkas: (a) pemahamanmu tentang scope MVP Fase 1 dalam 5 kalimat, (b) daftar pertanyaan/ambiguitas yang kamu temukan (kalau ada), (c) rencana kerjamu untuk Milestone M0 sesuai checklist docs/ROADMAP.md. Tunggu konfirmasiku sebelum lanjut.

TUGAS — MILESTONE M0 (Fondasi) SAJA:
Kerjakan checklist M0 di docs/ROADMAP.md sampai kriterianya terpenuhi: init Next.js App Router + TypeScript strict + Tailwind + shadcn/ui + tooling (ESLint/Prettier/Vitest/Playwright), struktur folder sesuai SPEC.md §7, .env.example lengkap sesuai docs/ARCHITECTURE.md §8, migrasi Supabase v1 untuk SELURUH skema docs/DATA-MODEL.md (tabel + RLS + index + seed packages), Dockerfile multi-stage standalone + endpoint /api/health, CI GitHub Actions (lint+typecheck+test), serta Sentry.

ATURAN MAIN:
1. Patuhi boundaries di CLAUDE.md (bagian SELALU / TANYA DULU / JANGAN PERNAH) tanpa pengecualian.
2. Kerjakan bertahap dengan commit kecil (Conventional Commits). Setelah tiap langkah besar: jalankan pnpm lint && pnpm typecheck && pnpm test dan laporkan hasilnya.
3. Saat butuh kredensial (Supabase staging, dsb), berhenti dan minta padaku — jangan mengarang nilai, jangan menulis rahasia ke file yang di-commit.
4. Semua pekerjaan DB lewat file migrasi di supabase/migrations (bukan perubahan manual), target project staging dulu.
5. Keputusan teknis di luar dokumen (pilihan library, dsb) → catat di docs/DECISIONS.md dengan format templatenya.
6. JANGAN mengerjakan fitur M1+ (auth UI, form undangan, tema, pembayaran) — M0 murni fondasi.

SELESAI M0 = /api/health hijau lokal via docker run, CI hijau, migrasi berhasil di staging, lalu berikan padaku: (a) ringkasan apa saja yang dibuat, (b) instruksi langkah-demi-langkah setup app di Easypanel + env yang harus kuisi + cara menghubungkan repo, supaya aku bisa deploy dan memverifikasi https://merriva.id/api/health sendiri.
```

---

## Setelah M0 selesai

Prompt lanjutan tinggal singkat, misalnya: `Baca CLAUDE.md dan docs/ROADMAP.md, M0 sudah selesai dan terverifikasi. Lanjutkan Milestone M1 dengan aturan main yang sama.` Ulangi pola ini per milestone (M2, M3, M4). Bila di tengah jalan ada perubahan keinginan, ubah dulu SPEC.md/dokumen terkait (bisa minta agent yang mengubahnya), baru minta implementasi — jangan biarkan kode dan dokumen berpisah jalan.
