# Runbook — E2E Pembayaran (M3.6)

Verifikasi jalur bayar end-to-end (SPEC §4.8): **checkout → pembayaran simulasi → webhook/poll → undangan aktif → kuitansi**, plus penegakan limit paket. Bagian yang butuh gateway dijalankan terhadap **SANDBOX**-nya (bukan uang asli — boundary "`paymentsimulation` di luar production").

Gateway yang teruji ditentukan `BINDERPAY_PARTNER_ID` di `.env.local` (DECISIONS #102): **kosong → Pakasir** (§A–C; jalur bayar produksi sampai peralihan, lalu dipensiunkan), **terisi → BinderPay QRIS** (§D).

## Prasyarat

- **Project SANDBOX Pakasir**: `PAKASIR_PROJECT_SLUG` + `PAKASIR_API_KEY` sandbox.
- **Akun uji** terverifikasi di DB target (email + kata sandi), ber-peran `client` — admin/Pro tak pernah ditagih sehingga tak pernah melihat pemilih paket berbayar (DECISIONS #100) → `E2E_EMAIL`, `E2E_PASSWORD`.
- **Undangan uji** milik akun itu, status `draft`/`expired`, dengan **slug asli** (bukan `draft-…`) dan **minimal satu sesi jadwal yang tanggal & jam mulainya lengkap** → `E2E_INVITATION_ID`. Checkout MENOLAK slug `draft-…` (alamat terkunci setelah aktif → wajib diatur dulu) dan undangan tanpa sesi berjam (tamu tak tahu kapan acaranya — DECISIONS #44); halaman aktivasi lalu menampilkan daftar syarat, bukan pemilih paket. Reset undangan ke `draft` sebelum menjalankan ulang.
- DB target (Supabase staging/lokal) sudah dimigrasi (`supabase db push`) — termasuk `20261031100000_orders_qr_content.sql`: checkout & `/bayar` membaca `orders.qr_content` di KEDUA gateway. Tanpa kolom itu kegagalannya senyap: checkout menolak dengan galat umum (terlapor `checkout.pending-lookup`) dan `/bayar` memantulkan ke `/aktifkan` — cek `select qr_content from public.orders limit 0;`.
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

> ⚠️ Spec ini dan `payment-webhook.spec.ts` **khusus Pakasir**: keduanya menunggu redirect ke `app.pakasir.com` lalu memanggil `PakasirGateway.simulatePayment`. Daftar env wajibnya tak menyebut `BINDERPAY_*`, jadi bila `BINDERPAY_PARTNER_ID` terisi di `.env.local` keduanya **tidak di-skip** melainkan **time-out** — checkout mendarat di `/bayar` kita dan `waitForURL` menyerah setelah 30 dtk. Kosongkan variabel itu untuk menjalankan §A; BinderPay diuji manual (§D).

```bash
pnpm exec playwright install   # sekali
pnpm test:e2e                  # menjalankan spec bila env sandbox tersedia
```

Alur test: login → `/aktifkan/{E2E_INVITATION_ID}` → checkout Basic →
`simulatePayment` (sandbox) → buka `/bayar` → poller mem-verifikasi
`transactiondetail` → assert **"Pembayaran berhasil!"** + tautan "Lihat undangan"
mengarah ke slug asli (bukan `draft-…`).

## B. Manual — Pakasir (cakup metode QRIS + VA — jalur lama)

`paymentsimulation` hanya menandai lunas tanpa memilih metode. Untuk memenuhi
cakupan QRIS + VA jalur Pakasir (SPEC §4.8 kini QRIS saja — #99), bayar lewat **UI sandbox** Pakasir:

1. Login → buat/siapkan undangan `draft` (atur alamat + isi minimal satu sesi jadwal berjam) → **Aktifkan** → pilih paket.
2. Di halaman bayar Pakasir sandbox, selesaikan sebagai **QRIS** (ulangi untuk **VA**, undangan lain).
3. Amati: webhook masuk (log `/api/webhooks/pakasir`) **dan/atau** poller `/bayar` → `active`.
4. Cek **kuitansi** terkirim (< 1 menit) ke email akun uji; tautan undangan benar.

## C. Yang harus lolos (kriteria terima SPEC §4.8)

Butir di bawah ditulis untuk Pakasir; padanan BinderPay-nya di §D.

- [ ] Simulasi/bayar QRIS + ≥1 VA → undangan `active`, `active_until` terhitung.
- [ ] **Webhook palsu tak mengaktifkan**: order tak ada / amount beda / `transactiondetail` tak konfirmasi → TIDAK aktif (sudah terverifikasi lokal M3.2; ulangi di sandbox).
- [ ] **Idempoten**: kirim ulang webhook / poll berkali-kali → tak menggandakan aktivasi (order tetap `paid`, satu kuitansi — `idempotencyKey`).
- [ ] Order `pending` >24 jam → cron `expire-orders` → `expired` + `transactioncancel` (jalankan cron manual: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" .../api/cron/expire-orders`).
- [ ] `api_key` tak pernah muncul di browser/log.
- [ ] **Limit paket** ditegakkan: beli Premium → 20 foto / tamu tanpa batas / **tanpa watermark**; Basic → 8 foto / 150 tamu / watermark (penegakan foto & tamu OTORITATIF di DB `invitation_effective_limits` — sudah terverifikasi lokal).

## D. Varian BinderPay (QRIS) — manual

Berlaku begitu `BINDERPAY_PARTNER_ID` terisi: `getPaymentGateway()` lalu memakai BinderPay untuk SEMUA penerbitan QR, verifikasi, dan pembatalan — termasuk order lama era Pakasir. Kanal **QRIS saja**; tak ada VA. Tak ada versi otomatis: API BinderPay tak punya padanan `simulatePayment`, dan satu-satunya cara melunasi transaksi sandbox adalah **Payment Simulator** di dashboard sandbox BinderPay.

**Prasyarat** — akun uji, undangan uji, dan DB seperti di atas (kredensial Pakasir tak dipakai), ditambah kredensial **SANDBOX** BinderPay. Host sandbox DITOLAK bila `NODE_ENV=production` (simulatornya bisa melunasi transaksi sandbox mana pun).

```bash
# .env.local
BINDERPAY_PARTNER_ID=<partner-id-sandbox>
BINDERPAY_BASE_URL=https://api-sandbox.binderpay.id
BINDERPAY_PRIVATE_KEY_B64=<PEM kunci privat kita, base64 satu baris>
BINDERPAY_PUBLIC_KEY_B64=<PEM kunci publik BinderPay, base64>
```

Tutup dulu order `pending` era Pakasir milik undangan uji (`select * from public.expire_pending_order('<kode>');`). Kalau tidak, checkout menerbitkan QR BinderPay untuk nomor order lama, sementara `/bayar` menghitung masa berlaku QR dari `created_at` order itu — QR-nya bisa tak tampil sama sekali.

1. Login → undangan uji → **Aktifkan** → pilih paket. Checkout tak keluar ke domain gateway: ia mendarat di `/dashboard/undangan/{id}/bayar`, yang menampilkan QR (PNG buatan server dari `orders.qr_content`, bukan `qrUrl` vendor), "Berlaku sampai …" (23 jam), dan tombol **Simpan gambar QR**. Checkout ulang paket yang sama selagi QR itu berlaku membuka QR yang SAMA — satu order tak pernah mendapat QR kedua.
2. Lunasi transaksinya lewat **Payment Simulator**.
3. Amati aktivasi. Callback sandbox dikirim ke URL Callback proyek, `https://merriva.id/api/webhooks/binderpay` — **bukan ke mesin lokal** (di produksi ia tak menyentuh apa pun selama `BINDERPAY_PARTNER_ID` di sana kosong). Jadi di lokal aktivasi datang dari **poller** `/bayar` (`qr-mpm-query` OUTBOUND tiap 4 dtk s/d ±6 menit; lewat itu tekan **Cek sekarang**) atau dari cron pass 1 (order ≥ 10 menit; `curl` seperti di §C).
4. Cek kuitansi seperti B.4.

**Yang harus lolos — beda dari §C:**

- [ ] Rincian transaksi di dashboard sandbox: Jumlah = **pokok**, Total = **harga katalog** (Basic: 98.312 + biaya 688 = 99.000) — pelanggan tak pernah ditagih di atas harga; fee ditanggung merchant (SPEC §4.8).
- [ ] QRIS saja (SPEC §4.8, keputusan pemilik #99) — tak ada VA di jalur ini.
- [ ] **Webhook palsu tak mengaktifkan** — dikunci `tests/unit/binderpay-webhook.test.ts` (tanda tangan/stempel waktu salah → 401 sebelum menyentuh DB; order tak dikenal → 200 tanpa aktivasi; `X-PARTNER-ID` lain → dilaporkan, query tetap yang memutuskan). Callback sungguhan tak teruji dari lokal (langkah 3); bentuk & header aslinya BELUM terukur.
- [ ] Order `pending` > 24 jam → cron → `expired` + **`qr-mpm-cancel`** (bukan `transactioncancel`); query sesudahnya `05 Canceled`.
- [ ] `BINDERPAY_PRIVATE_KEY_B64` (padanan `api_key`) tak pernah muncul di browser/log.

## Catatan

- `simulatePayment` (`PakasirGateway`) **melempar di `NODE_ENV=production`** — tak bisa dipakai menandai lunas gratis di produksi.
- Jalur **poll** (`/bayar`) adalah aktivator kedua yang setara webhook; keduanya lewat `verifyAndActivate` yang sama (fail-closed).
- Cron `expire-orders` **merekonsiliasi dulu** (`transactiondetail`; BinderPay: `qr-mpm-query`) sebelum membatalkan → order lunas-tapi-webhook-hilang tetap diaktifkan, bukan dibatalkan.
