# ARCHITECTURE — Merriva

**Versi:** 1.0 — 24 Juli 2026 · Detail fitur: `../SPEC.md` §4 · Skema data: `DATA-MODEL.md`

---

## 1. Gambaran

```
[Tamu & Klien (HP)] ──HTTPS──> [Cloudflare (DNS + proxy/CDN, gratis)]
                                    │
                          [VPS + Easypanel (Traefik, SSL otomatis)]
                                    │  container Docker
                              [Next.js app (standalone)]
                                    │
        ┌───────────────┬───────────┴──────────┬────────────────┐
   [Supabase cloud]  [Pakasir]            [Resend]         [Turnstile]
   Postgres + RLS,   payment link QRIS/VA  email            anti-spam
   Auth, Storage*    + webhook
        │
   *media pindah ke [Cloudflare R2 + cdn.merriva.id] menjelang launch (lihat §6)
```

**Prinsip:** (1) halaman undangan publik harus sangat cepat dan tahan lonjakan hari-H → ISR cache, bukan query per kunjungan; (2) semua vendor eksternal dibungkus abstraksi (`lib/payment/`, `lib/storage/`) agar bisa ditukar tanpa menyentuh fitur; (3) biaya tetap mendekati Rp0 sampai ada pendapatan.

## 2. Stack & alasan

| Komponen | Pilihan | Alasan |
|---|---|---|
| Framework | Next.js App Router + TypeScript strict | SSR/ISR untuk halaman undangan cepat & SEO; satu codebase untuk marketing + dashboard + halaman publik |
| Styling | Tailwind + shadcn/ui (dashboard) + Framer Motion (tema) | Kecepatan develop; animasi tema premium dengan `prefers-reduced-motion` |
| DB/Auth | Supabase cloud (Postgres + RLS + Auth) | Managed, RLS untuk isolasi data antar user, free tier saat dev → Pro $25/bln saat launch (backup harian, tanpa auto-pause) |
| Media | `lib/storage/` driver `supabase` → `r2` | Lihat §6 |
| Pembayaran | Pakasir | Keputusan pemilik (DECISIONS #4); QRIS 0,7%+Rp310 / 1%, VA flat Rp2.000–3.500, settlement H+1 |
| Email | Resend (fallback SMTP) | Free tier cukup; template transaksional sederhana |
| Anti-spam | Cloudflare Turnstile invisible | RSVP/ucapan publik tanpa mengganggu tamu |
| Deploy | Dockerfile → Easypanel di VPS | Keputusan pemilik; Dockerfile > Nixpacks: build deterministik & image kecil |
| Monitoring | Sentry + UptimeRobot + log Easypanel | Free tier; downtime hari-H tidak bisa ditoleransi |

## 3. Rendering & caching

Halaman undangan `/{slug}`: **SSR + ISR** — di-cache di server Next, di-revalidate (`revalidateTag`) saat pemilik menyimpan perubahan atau status berubah. Personalisasi tamu (`?g=token`) TIDAK boleh membatalkan cache halaman: data tamu diambil client-side ringan (atau streaming) di atas shell halaman yang di-cache. Landing & katalog: static + revalidate berkala. Dashboard: dynamic (auth). Gambar: `next/image` dengan dua varian yang sudah dibuat saat upload (400px/1600px WebP) — tanpa on-the-fly resizing berbayar.

**OG image `/api/og/[slug]` (M2.5):** Route Handler dinamis (satori render + query DB per hit) untuk pratinjau tautan WhatsApp. Karena path **tanpa ekstensi**, Cloudflare TIDAK meng-cache-nya secara default meski `Cache-Control: s-maxage` diset. **Wajib tambah Cloudflare Cache Rule** untuk `/api/og/*`: *Eligible for cache* + Edge TTL, dengan **cache key = path saja** (abaikan query string) agar scrape berulang & `?v` acak tetap kolaps ke satu entri cache dan tak menghajar origin. Pertahanan sisi-kode (rate limit per-IP + cheap-reject slug non-aktif ke `/og-default.png` statis) membatasi biaya origin bahkan sebelum aturan itu dipasang. Busting saat pemilik menyimpan lewat `?v=updated_at` pada URL gambar (edit → `?v` baru → scrape baru dapat gambar segar).

## 4. Pembayaran — Pakasir (dok: pakasir.com/p/docs)

Alur: buat `order` (status `pending`, `order_code` unik mis. `MRV-8F3K2`, `amount` integer) → redirect ke `https://app.pakasir.com/pay/{project_slug}/{amount}?order_id={order_code}&redirect={url_sukses}` → tamu bayar QRIS/VA → Pakasir POST webhook `{amount, order_id, project, status, payment_method, completed_at}`.

**Keamanan (kritis):** webhook Pakasir **tidak memiliki signature**. Handler wajib: (1) cocokkan `order_id`+`amount`+`project` dengan order `pending` di DB; (2) panggil `GET /api/transactiondetail?project&amount&order_id&api_key` dan hanya aktifkan bila status lunas menurut API; (3) idempotent — notifikasi duplikat tidak menggandakan aktivasi; (4) `api_key` hanya di server. Order pending > 24 jam: cron expire + `POST /api/transactioncancel`. Dashboard punya halaman "cek status" yang mem-poll `transactiondetail`. Testing: `POST /api/paymentsimulation` (sandbox).

## 5. Sistem tema (kontrak inti)

Satu folder per tema di `src/themes/{slug}/`: `index.tsx` (komponen menerima props `InvitationData` hasil parse Zod — **dilarang fetch sendiri**), `theme.json` (metadata: kategori yang didukung, varian warna, section yang didukung), `demo-data.ts` (data fiktif untuk halaman demo). `registry.ts` memetakan slug → dynamic import. Menambah tema = folder baru + baris registry + seed metadata; kode inti tidak disentuh. Perubahan kontrak props = keputusan "tanya dulu" (berdampak semua tema).

## 6. Storage media — strategi bertahap (biaya Rp0 → skala)

| Tahap | Driver | Biaya | Catatan |
|---|---|---|---|
| Dev + klien awal | Supabase Storage (free: 1GB, egress 5GB) | Rp0 | Tanpa akun/kartu baru |
| Menjelang launch (checklist M4, **wajib sebelum event ramai**) | Cloudflare R2 (free: 10GB + **egress gratis**) via `cdn.merriva.id` + cache CF | Rp0 | Egress Supabase free hanya 5GB ≈ 3–4 event |
| > 10GB (±1.000 undangan) | R2 $0,015/GB/bln | ±Rp10–25rb/bln | Siap video kenangan Fase 3 |

Aturan yang membuat migrasi = ganti env: DB hanya menyimpan `storage_path` relatif; semua akses via `lib/storage/` (interface `upload/getUrl/delete`, driver dipilih `STORAGE_DRIVER`); media disajikan dari domain sendiri (`NEXT_PUBLIC_MEDIA_URL`); nama file immutable (hash). Migrasi: script copy S3-sync + ganti env. **Google Drive dilarang** (rate limit saat ramai = mati di hari-H; risiko akun; lihat DECISIONS #6). Upload: kompresi & resize di browser klien (2 varian WebP), naik via presigned/signed upload — VPS tidak memproses gambar.

## 7. Email & cron

Resend: verifikasi akun, kuitansi + link aktif, pengingat H-14 expiry, (opsional) rekap RSVP mingguan. Cron (Easypanel scheduled job memanggil `/api/cron/*` dengan header `CRON_SECRET`, atau `pg_cron`): expire order pending >24 jam · set `expired` untuk undangan lewat `active_until` · email pengingat · pembersihan data lewat retensi (lihat DATA-MODEL §5).

## 8. Deployment (VPS + Easypanel)

`Dockerfile` multi-stage: `node:22-alpine` → install (pnpm, frozen lockfile) → build (`output: 'standalone'`) → runtime hanya `.next/standalone` + `public` + `.next/static`, user non-root, `EXPOSE 3000`, healthcheck `GET /api/health` (cek DB reachable). Easypanel: app dari repo Git (push → auto build+deploy), domain `merriva.id` di-attach (SSL Let's Encrypt otomatis via Traefik), env vars di panel. DNS di Cloudflare (proxy oranye ON untuk cache statis + perlindungan).

**Dua project Supabase:** `merriva-staging` (development, gratis) dan `merriva-prod`. Alur migrasi: kembangkan & uji di staging → merge ke `main` → deploy → `supabase db push` ke prod secara sadar/manual. Jangan pernah mengarahkan dev ke DB prod.

Env (nilai di Easypanel/`.env`, daftar di `.env.example`):

```
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, PAKASIR_PROJECT_SLUG, PAKASIR_API_KEY,
RESEND_API_KEY, TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY,
CRON_SECRET, STORAGE_DRIVER (supabase|r2), NEXT_PUBLIC_MEDIA_URL,
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET   # saat driver=r2
```

## 9. Keamanan & kepatuhan

RLS di semua tabel (matrix di `DATA-MODEL.md`) · halaman publik dilayani server-side dengan penyaringan eksplisit — `guests`, `gift_notes`, `orders` tidak pernah ke publik · insert publik (RSVP/ucapan) lewat server action + Turnstile + rate limit per IP + honeypot · secrets hanya env · webhook: verifikasi aktif ke API (lihat §4) · UU PDP: kebijakan privasi, retensi data tamu 6 bulan pasca-expired lalu hapus otomatis, PSE Kominfo via OSS sebelum promosi besar.

## 10. Observability & pemulihan

Sentry (error FE+BE) · UptimeRobot ke `/api/health` production · log via Easypanel. Backup: Supabase Pro harian (7 hari) — **latihan restore minimal 1× sebelum launch**. Skenario VPS mati: data aman di Supabase/R2; pemulihan = deploy ulang container di VPS/Easypanel baru + arahkan DNS — dokumentasikan langkahnya saat M0 selesai.
