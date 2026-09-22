# Runbook — E2E Pembayaran (M3.6)

Verifikasi jalur bayar end-to-end (SPEC §4.8): **checkout → pembayaran simulasi → webhook/poll → undangan aktif → kuitansi**, plus penegakan limit paket. Bagian yang butuh Pakasir dijalankan terhadap **project SANDBOX** (bukan uang asli — boundary "`paymentsimulation` di luar production").

## Prasyarat

- **Project SANDBOX Pakasir**: `PAKASIR_PROJECT_SLUG` + `PAKASIR_API_KEY` sandbox.
- **Akun uji** terverifikasi di DB target (email + kata sandi) → `E2E_EMAIL`, `E2E_PASSWORD`.
- **Undangan uji** milik akun itu, status `draft`/`expired`, dengan **slug asli** (bukan `draft-…`) dan **minimal satu sesi jadwal yang tanggal & jam mulainya lengkap** → `E2E_INVITATION_ID`. Checkout MENOLAK slug `draft-…` (alamat terkunci setelah aktif → wajib diatur dulu) dan undangan tanpa sesi berjam (tamu tak tahu kapan acaranya — DECISIONS #44); halaman aktivasi lalu menampilkan daftar syarat, bukan pemilih paket. Reset undangan ke `draft` sebelum menjalankan ulang.
- DB target (Supabase staging/lokal) sudah dimigrasi (`supabase db push`).
- Untuk uji **webhook** sungguhan (Pakasir → kita), app harus punya **URL publik** (staging) yang di-set sebagai webhook di dashboard Pakasir. Uji **jalur poll** (`/bayar`) tak butuh URL publik — `transactiondetail` dipanggil OUTBOUND dari server kita.

```bash
# .env.local (dipakai `pnpm dev` yang dijalankan Playwright) + environment shell:
PAKASIR_PROJECT_SLUG=<sandbox-slug>
PAKASIR_API_KEY=<sandbox-key>
E2E_EMAIL=<akun-uji>
E2E_PASSWORD=<kata-sandi>
E2E_INVITATION_ID=<uuid-undangan-draft-dengan-slug-asli-dan-sesi-berjam>
# Opsional untuk uji kuitansi nyata:
RESEND_API_KEY=<key>   EMAIL_FROM="Merriva <noreply@domain-terverifikasi>"
```

## A. Otomatis (Playwright)

`tests/e2e/payment-simulation.spec.ts` — **di-skip** bila env di atas tak lengkap.

```bash
pnpm exec playwright install   # sekali
pnpm test:e2e                  # menjalankan spec bila env sandbox tersedia
```

Alur test: login → `/aktifkan/{E2E_INVITATION_ID}` → checkout Basic →
`simulatePayment` (sandbox) → buka `/bayar` → poller mem-verifikasi
`transactiondetail` → assert **"Pembayaran berhasil!"** + tautan "Lihat undangan"
mengarah ke slug asli (bukan `draft-…`).

## B. Manual (cakup metode QRIS + VA — kriteria SPEC)

`paymentsimulation` hanya menandai lunas tanpa memilih metode. Untuk memenuhi
kriteria "QRIS dan minimal 1 VA", bayar lewat **UI sandbox** Pakasir:

1. Login → buat/siapkan undangan `draft` (atur alamat + isi minimal satu sesi jadwal berjam) → **Aktifkan** → pilih paket.
2. Di halaman bayar Pakasir sandbox, selesaikan sebagai **QRIS** (ulangi untuk **VA**, undangan lain).
3. Amati: webhook masuk (log `/api/webhooks/pakasir`) **dan/atau** poller `/bayar` → `active`.
4. Cek **kuitansi** terkirim (< 1 menit) ke email akun uji; tautan undangan benar.

## C. Yang harus lolos (kriteria terima SPEC §4.8)

- [ ] Simulasi/bayar QRIS + ≥1 VA → undangan `active`, `active_until` terhitung.
- [ ] **Webhook palsu tak mengaktifkan**: order tak ada / amount beda / `transactiondetail` tak konfirmasi → TIDAK aktif (sudah terverifikasi lokal M3.2; ulangi di sandbox).
- [ ] **Idempoten**: kirim ulang webhook / poll berkali-kali → tak menggandakan aktivasi (order tetap `paid`, satu kuitansi — `idempotencyKey`).
- [ ] Order `pending` >24 jam → cron `expire-orders` → `expired` + `transactioncancel` (jalankan cron manual: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" .../api/cron/expire-orders`).
- [ ] `api_key` tak pernah muncul di browser/log.
- [ ] **Limit paket** ditegakkan: beli Premium → 20 foto / tamu tanpa batas / **tanpa watermark**; Basic → 8 foto / 150 tamu / watermark (penegakan foto & tamu OTORITATIF di DB `invitation_effective_limits` — sudah terverifikasi lokal).

## Catatan

- `simulatePayment` (`PakasirGateway`) **melempar di `NODE_ENV=production`** — tak bisa dipakai menandai lunas gratis di produksi.
- Jalur **poll** (`/bayar`) adalah aktivator kedua yang setara webhook; keduanya lewat `verifyAndActivate` yang sama (fail-closed).
- Cron `expire-orders` **merekonsiliasi dulu** (`transactiondetail`) sebelum membatalkan → order lunas-tapi-webhook-hilang tetap diaktifkan, bukan dibatalkan.
