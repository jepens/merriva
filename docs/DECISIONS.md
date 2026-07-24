# DECISIONS — Log Keputusan (ADR) Merriva

Format: setiap keputusan penting dicatat di sini dengan tanggal, keputusan, alasan, dan alternatif yang ditolak. Keputusan hanya boleh diubah dengan entri baru yang mereferensikan entri lama (jangan menghapus riwayat).

---

## #1 — 2026-07-24 · Model layanan: self-service penuh
**Keputusan:** klien mendaftar, mengisi, membayar, dan mengaktifkan undangan sendiri; admin bisa membuatkan untuk klien jasa EO lewat dashboard yang sama.
**Alasan:** sesuai visi platform SaaS yang bisa diskalakan; funnel otomatis tanpa kerja manual per order.
**Ditolak:** jasa-dulu (admin input semua — lebih cepat dibangun tapi bukan platform), hybrid dua jalur (scope terlalu besar untuk MVP).

## #2 — 2026-07-24 · Editor: form terstruktur multi-step (bukan drag-and-drop)
**Alasan:** 3–5× lebih cepat dibangun, hasil selalu rapi, standar mayoritas platform lokal. Drag-and-drop dipertimbangkan ulang setelah MVP terbukti.

## #3 — 2026-07-24 · Stack: Next.js + Supabase cloud, deploy Dockerfile via Easypanel di VPS sendiri
**Alasan:** preferensi & infrastruktur pemilik (VPS + Easypanel sudah ada); Supabase memberi Postgres+RLS+Auth managed; Dockerfile dipilih di atas Nixpacks untuk build deterministik & image kecil (Next `output:'standalone'`).

## #4 — 2026-07-24 · Payment gateway: Pakasir (pakasir.com)
**Keputusan:** Pakasir untuk QRIS + Virtual Account, integrasi via payment link + webhook.
**Alasan:** pilihan pemilik; biaya kompetitif (QRIS 0,7%+Rp310 / 1%; VA flat Rp2.000–3.500; tanpa biaya bulanan; settlement H+1).
**Konsekuensi teknis (wajib):** webhook Pakasir tanpa signature → verifikasi dua lapis: match order di DB + konfirmasi `GET transactiondetail` sebelum aktivasi. Abstraksi `lib/payment/` dipertahankan agar bisa pindah Midtrans/Xendit dengan menyentuh satu modul bila keandalan bermasalah.
**Ditolak:** Midtrans/Xendit sebagai gateway awal (tetap menjadi fallback terdokumentasi).

## #5 — 2026-07-24 · Nama & domain: Merriva / merriva.id
**Alasan:** dari *merry* (meriah) — universal untuk semua jenis acara, mudah diucapkan, brandable; merriva.com & merriva.id tampak belum terdaftar dan tanpa konflik brand saat riset.
**Ditolak setelah riset:** Meriah.id (terdaftar), keluarga "Hadir*" (Hadirin/Hadirly/Hadirku eksis), Acaraku (dipakai Kenangan), Hajatan (Hajatan.info eksis), Evervite (.com premium + .id sudah coming-soon pihak lain), Evinta/Vitely/Occasia/Celebrio/Attendly/Festimo (konflik brand/domain).
**Tindak lanjut:** beli merriva.id + merriva.com di registrar secepatnya; cek merek PDKI sebelum investasi branding besar.

## #6 — 2026-07-24 · Storage media: bertahap Supabase Storage → Cloudflare R2; Google Drive ditolak
**Keputusan:** development & klien awal di Supabase Storage free tier; pindah ke R2 (free 10GB, egress gratis, via `cdn.merriva.id`) menjelang launch komersial — masuk checklist M4.
**Alasan:** biaya Rp0 di kedua tahap; egress hari-H (±1–2GB/event) adalah komponen biaya terbesar dan R2 menggratiskannya; R2 siap untuk video kenangan Fase 3.
**Aturan pendukung:** DB hanya menyimpan `storage_path` relatif; akses via `lib/storage/` (driver `STORAGE_DRIVER`); media dilayani dari domain sendiri; nama file immutable.
**Ditolak:** Google Drive (rate limit 403 saat ratusan tamu mengakses = galeri mati di hari-H; risiko suspend akun; tanpa kontrol CDN) · disk VPS (hilang saat redeploy, tanpa CDN, backup manual).

## #7 — 2026-07-24 · Distribusi WhatsApp: link `wa.me` per tamu, bukan blast otomatis
**Alasan:** gratis dan aman (klien mengirim dari HP-nya sendiri); WA blast tidak resmi berisiko nomor diblokir; WA Business API resmi (±Rp780/pesan marketing) ditunda ke Fase 4 sebagai add-on.

## #8 — 2026-07-24 · Musik: hanya library royalty-free bawaan platform
**Alasan:** menghindari pelanggaran hak cipta (lagu populer di undangan = risiko takedown/klaim); upload MP3 bebas ditolak di MVP.

## #9 — 2026-07-24 · RSVP & ucapan digabung satu form; kiriman ulang tamu bertoken = update
**Alasan:** UX tamu lebih sederhana (satu langkah); mencegah duplikasi data pax; ucapan tampil dari `rsvps.message`.

## #10 — 2026-07-24 · Fondasi teknis M0: Next.js 16, pnpm, Tailwind v4, Vitest+Playwright
**Keputusan:** Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind CSS v4 + shadcn/ui (setup manual, base `neutral`); package manager **pnpm 11** (`packageManager` dikunci); testing Vitest (unit) + Playwright (E2E); ESLint flat config + Prettier.
**Alasan:** SPEC meminta "versi stabil terbaru". `create-next-app@latest` (Jul 2026) menghasilkan **Next 16 + React 19 + Tailwind v4** — bukan Next 15 seperti asumsi awal — dan diadopsi apa adanya. shadcn di-setup manual (components.json + token `globals.css`) agar deterministik di lingkungan non-interaktif.
**Konsekuensi:** `node:22-alpine` di Dockerfile selaras Node 22. Build script dependency dibatasi via `pnpm-workspace.yaml` `allowBuilds` (hanya `supabase` & `esbuild` yang diizinkan; `sharp`/`@sentry/cli`/`unrs-resolver` ditolak).

## #11 — 2026-07-24 · Fondasi DB & RLS pada migrasi v1
**Keputusan:** RLS aktif di 12 tabel; `service_role` (server) bypass RLS tanpa policy; admin dibedakan lewat `public.is_admin()` (SECURITY DEFINER, anti-rekursi ke RLS `profiles`), kepemilikan tabel anak lewat `public.owns_invitation()`. Trigger `handle_new_user` membuat baris `profiles` otomatis saat register; trigger `set_updated_at` untuk `invitations` & `rsvps`. Enum Postgres untuk himpunan literal tetap; `packages.code` tetap `text`. Seed `packages` ditaruh **di dalam migrasi** (idempoten `on conflict do nothing`), bukan `seed.sql`.
**Alasan:** pola standar Supabase; mencegah chicken-egg RLS pada `profiles`; `packages` adalah config esensial yang wajib ada di semua environment (ikut `supabase db push`, sementara `seed.sql` hanya jalan pada `db reset` lokal).
**Ditolak:** text+CHECK untuk semua status (dipilih enum demi integritas); seed packages hanya di `seed.sql` (tidak terbawa ke staging/prod).
**Konsekuensi:** fungsi `language sql` yang mereferensikan tabel harus didefinisikan **setelah** tabelnya (body di-parse-check saat CREATE).

## #12 — 2026-07-24 · Health check `/api/health` = probe reachability Supabase
**Keputusan:** `/api/health` mengembalikan `{status, db, uptime, timestamp}`; `db` diperoleh dari probe HTTP ringan ke endpoint REST Supabase (schema-agnostic, timeout 2,5 dtk). HTTP **200** bila `up`/`not_configured`, **503** bila `down`. Dipakai Docker `HEALTHCHECK` + UptimeRobot.
**Alasan:** cek reachability tanpa mengikat skema tertentu; `not_configured` → 200 agar container tetap dianggap hidup di lingkungan tanpa env DB (build/CI).

## #13 — 2026-07-24 · Model privilege DB eksplisit + hardening kolom (pasca-audit adversarial)
**Keputusan:** Migrasi v1 memberi GRANT privilege objek EKSPLISIT ke peran Supabase (service_role `ALL`; authenticated `SELECT/INSERT/UPDATE/DELETE`; anon `SELECT` katalog saja) plus `ALTER DEFAULT PRIVILEGES` untuk objek migrasi berikutnya — tidak bergantung pada konfigurasi default-privileges environment. Di ATAS RLS, kolom sensitif dikunci di level privilege: client tidak bisa `UPDATE` `profiles.role` (anti-eskalasi admin), `invitations.status/active_until/package_id/published_at` (anti-aktivasi tanpa bayar), maupun kolom data `rsvps` selain `is_hidden/is_approved`. Kolom terkunci hanya ditulis service_role (server action).
**Alasan:** temuan audit adversarial M0 — (a) tanpa GRANT eksplisit, RLS jadi moot & seluruh query DB gagal `permission denied` saat deploy (RLS hanya jalan bila peran punya privilege objek); (b) RLS membatasi BARIS, bukan KOLOM, sehingga policy "UPDATE baris sendiri" membuka eskalasi privilege & bypass pembayaran. Semua diverifikasi fungsional di Postgres lokal (`has_column_privilege` + uji akses per-peran).
**Konsekuensi:** setiap migrasi baru dengan tabel/kolom sensitif WAJIB menyertakan grant + (bila perlu) hardening kolom; mutasi kolom terkunci HARUS lewat server action service_role.

---

## Template entri baru

```
## #N — YYYY-MM-DD · [Judul keputusan]
**Keputusan:** ...
**Alasan:** ...
**Ditolak:** ... (alternatif + kenapa)
**Konsekuensi:** ... (bila ada dampak teknis/biaya yang harus diingat)
```
