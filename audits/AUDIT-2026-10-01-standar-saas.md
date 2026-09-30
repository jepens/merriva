# Audit Standar SaaS — Merriva

**Tanggal:** 2026-10-01 · **Cakupan:** celah standar SaaS (bukan bug kode) ·
**Status produk:** MVP Fase 1, pra-launch, ter-deploy sebagai staging di
`etc-merriva.naz0ei.easypanel.host` · **Audit sebelumnya:** `AUDIT-2026-09-04.md`

Audit ini berangkat dari satu pertanyaan pemilik — *"kenapa kata sandi tidak
diverifikasi saat mendaftar?"* — lalu diperluas ke pertanyaan yang sebenarnya:
**apa lagi yang tidak memenuhi standar SaaS?** Yang dicari bukan bug (sudah
ditangani review terpisah, DECISIONS #45–#46), melainkan hal yang wajar
diharapkan ada oleh pelanggan yang membayar, kompetitor sekelas, atau
regulator/penyedia pembayaran — tetapi tidak ada atau setengah jadi.

---

## 1. Ringkasan eksekutif

Kodenya sehat; **produknya yang belum jadi layanan.** Delapan permukaan
teknis inti (RLS, verifikasi pembayaran dua lapis, retensi UU PDP, header
keamanan, ISR, anggaran bundle) sudah dikerjakan dengan disiplin yang di atas
rata-rata untuk produk seukuran ini. Yang belum ada justru lapisan yang
membuat sebuah aplikasi bisa disebut layanan berbayar: **kontrak (Syarat &
Ketentuan), bukti transaksi yang bisa diambil ulang, jalur menghubungi manusia,
jalan keluar bagi pelanggan (hapus akun, upgrade paket), dan kepastian bahwa
email akun benar-benar sampai.**

Satu temuan bersifat pasti, bukan probabilistik, dan menentukan go/no-go:
**jalur daftar → verifikasi email → masuk belum pernah sekali pun berhasil di
proyek produksi.** Dibuktikan langsung di database, bukan disimpulkan dari
kode — `auth.users` berisi tepat satu baris, yaitu admin yang dibuat manual
(`confirmation_sent_at` NULL, `email_confirmed_at` sama persis dengan
`created_at`). Tidak ada satu pun pendaftaran self-service yang pernah jadi.
Bila Custom SMTP belum disetel di dashboard Supabase, SMTP bawaan **menolak
mengirim ke alamat di luar anggota tim proyek** — bukan melambat, tetapi tidak
terkirim sama sekali — sementara `resetPasswordForEmail` sengaja mengabaikan
error demi anti-enumerasi, sehingga kegagalannya **tak meninggalkan jejak apa
pun**. Pelanggan melihat "cek email Anda", emailnya tidak pernah datang, dan
karena verifikasi wajib, ia tidak bisa masuk selamanya.

Dari 32 temuan awal: **18 berdiri setelah verifikasi adversarial, 6 gugur,
8 belum sempat diuji ulang** (lihat §2). Tidak ada temuan kritis yang
menyangkut keamanan data pelanggan — RLS, pemisahan `service_role`, dan
penyaring PII Sentry semuanya sudah benar.

| Severity | Jumlah | Keterangan |
|---|---|---|
| Tinggi | 7 | 6 pemblokir launch + 1 pengambilalihan akun |
| Sedang | 5 | ditangani 30 hari pertama |
| Rendah | 6 | backlog ber-tanggal |
| **Total berdiri** | **18** | dari 32 temuan awal |
| Gugur di verifikasi | 6 | lihat §5 — penting dibaca |

---

## 2. Metode & tingkat keyakinan

Delapan auditor membaca kode secara paralel, satu per dimensi (akun, billing,
legal, kendali data, email, kepercayaan, keamanan operasional, operasi), dengan
kewajiban membuktikan **ketiadaan** lewat pencarian yang disebutkan eksplisit —
bukan sekadar "saya tidak menemukan". Setiap temuan lalu diserahkan ke penguji
independen yang tugasnya **membantah**, dari dua sudut: *"apakah ini sebenarnya
sudah ada di tempat lain?"* dan *"apakah ini benar standar untuk produk
sekelas ini, atau kebutuhan enterprise yang diimpor tanpa alasan?"*

**Keyakinan tidak seragam, dan itu harus dinyatakan:**

- **Temuan A2–A4, A6, B1–B3** (dimensi akun & billing) diuji **dua** penguji
  berlensa berbeda. Nol bantahan dari 15 verdik.
- **Temuan A1, A5, B4–B7, dan seluruh gelombang C** diuji **satu** penguji
  berlensa gabungan, yang terbukti jauh lebih keras: 6 dari 16 temuan
  dibantah dan hampir semua sisanya diturunkan severity-nya.
- **Konsekuensinya:** severity pada kelompok pertama **belum diuji dengan
  standar seketat kelompok kedua.** Bila diuji ulang dengan lensa yang sama,
  sebagian mungkin turun. Isi temuannya tetap berdiri — yang belum teruji
  adalah bobotnya, bukan faktanya.

Penguji putaran kedua beberapa kali menemukan bahwa auditor pertama salah kutip
pasal UU PDP, salah baca ADR yang sudah ada, atau membesar-besarkan dampak.
Koreksi itu dipakai; temuan yang dibantah dibuang dan dicatat di §5.

---

## 3. Gelombang A — Pemblokir launch

> Jangan menerima uang pelanggan sebelum enam butir ini beres.

### A1. Email siklus-akun belum terbukti terkirim — dan kegagalannya senyap
**Severity: Tinggi** · **Usaha: jam** (satu setelan dashboard + satu kata di checklist)

Verifikasi akun dan reset kata sandi 100% bergantung GoTrue
([auth.ts:75-85](../src/server/actions/auth.ts#L75-L85),
[auth.ts:209-211](../src/server/actions/auth.ts#L209-L211)) — tidak ada jalur
kirim-sendiri lewat Resend (`generateLink|inviteUserByEmail|admin.createUser`
nol hit). `src/lib/email/` hanya melayani kuitansi dan pengingat H-14.

Dokumentasi Supabase sendiri menyatakan SMTP bawaan **"is not meant for
production use"** dan **"will refuse to deliver messages to addresses that are
not part of the project's team"**. Namun `docs/LAUNCH-CHECKLIST.md:32` masih
menandai pengalihan ke Resend sebagai **"(Opsional)"**, dan `docs/AUTH-SETUP.md`
§4 hanya menyarankan. `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`, dan
`docs/DECISIONS.md` nol hit untuk "smtp" — tak pernah ada keputusan sadar.

**Bukti empiris (bukan inferensi):** `auth.users` di proyek cloud
`ophmeifbjsffxklbeqla` berisi **satu** baris — admin yang dibuat manual,
`confirmation_sent_at` NULL. Kriteria terima SPEC §4.2 ("register→verifikasi→
login berjalan di HP") belum pernah benar-benar dijalankan terhadap produksi.

Diperparah dua kegagalan senyap di kode:
[auth.ts:209-211](../src/server/actions/auth.ts#L209-L211) mengabaikan error
`resetPasswordForEmail` sepenuhnya dan selalu menjawab sukses generik (benar
demi anti-enumerasi, tetapi berarti nol telemetri), dan penolakan pengiriman
saat signup jatuh ke `copy.auth.genericAuthError`. Tidak ada satu pun sinyal
yang membuat kondisi ini terlihat.

> **Catatan:** `supabase/config.toml` **tidak** membuktikan apa pun tentang
> produksi — itu konfigurasi stack lokal (`project_id = "saas-undangan"`, port
> 54321, `[local_smtp]` mail-catcher). Blok `[auth.email.smtp]` yang
> terkomentari di sana adalah perilaku yang **benar** untuk dev.

**Perbaikan:** setel Custom SMTP → Resend di dashboard Supabase cloud (host
`smtp.resend.com`, sender sama dengan `EMAIL_FROM`); naikkan butir
LAUNCH-CHECKLIST dari "Opsional" jadi **wajib**; perbaiki `AUTH-SETUP.md:65-66`
yang menyebut alasannya hanya "dibatasi rate-nya" (menyesatkan — sebenarnya
menolak kirim). **Uji terima:** daftar 3 akun uji dengan alamat di luar tim
dalam satu jam; ketiganya harus menerima email dari domain sendiri.

---

### A2. Tidak ada Syarat & Ketentuan, dan identitas badan usaha nihil
**Severity: Tinggi** · **Usaha: hari** (teknisnya kecil; biayanya di penyusunan isi)

`src/app/(marketing)/` hanya berisi `privasi` dan `refund`. Tidak ada
`/syarat`, `/ketentuan`, maupun `/tos` — dan tidak ada butirnya di
`LAUNCH-CHECKLIST.md` maupun `ROADMAP.md`, jadi ini celah yang **belum
direncanakan**, bukan yang tertunda.

Akibatnya tidak ada dasar kontraktual untuk hal-hal yang **kodenya sudah
kerjakan**: masa aktif berakhir (`cron/expire-invitations`), penghapusan
permanen 6 bulan (`cron/purge-expired`), penangguhan konten oleh admin
(`adminSuspendInvitationAction`), dan penolakan refund setelah aktivasi.
Pelanggan yang undangannya disuspend di hari-H tidak punya klausul apa pun
untuk dirujuk — begitu pula Merriva.

Identitas penjual juga nihil: satu-satunya kontak di seluruh produk adalah
`halo@merriva.id` ([copy.ts:1511](../src/lib/copy.ts#L1511)), tanpa nama badan
usaha, alamat, atau telepon. `PT Merriva Indonesia` di
[copy.ts:467](../src/lib/copy.ts#L467) adalah *placeholder* field "Penyelenggara"
untuk undangan korporat, bukan identitas Merriva. PP 80/2019 dan Permendag
31/2020 (PMSE) mewajibkan pelaku usaha menampilkan identitas sebelum
pembayaran; aggregator pembayaran rutin menangguhkan merchant yang halaman
T&C-nya tidak ada. `SPEC.md:444` masih mencantumkan keputusan badan usaha
sebagai pertanyaan terbuka — itu yang harus dikunci lebih dulu.

**Perbaikan:** `src/app/(marketing)/syarat/page.tsx` memakai komponen
`LegalPage` yang sudah ada (pola identik `/privasi` & `/refund`), isi minimal:
definisi layanan & paket, masa aktif + konsekuensi expired, retensi 6 bulan,
larangan konten (hak cipta musik/foto), hak menangguhkan, kepemilikan konten,
batas tanggung jawab, rujukan ke `/refund`, hukum Indonesia. Tambahkan blok
identitas badan usaha di `copy.marketing.legal`, render di footer + `/privasi`
+ `/syarat`, dan tautkan dari halaman checkout serta `/daftar`.

---

### A3. Kebijakan refund menjanjikan proses konkret tanpa satu pun jalur eksekusi
**Severity: Tinggi** · **Usaha: hari**

Enum `order_status` sudah punya `'refunded'`
([init_schema.sql:26](../supabase/migrations/20260724182301_init_schema.sql#L26)),
tetapi **nol kode yang pernah menulisnya** — tiga hit `refund` di `src/server/`
seluruhnya komentar. `/admin/order` read-only: hanya tabel + filter + paginasi,
tanpa satu pun `<form action=…>`. `admin.ts` tidak punya aksi order sama sekali,
dan `PaymentGateway` ([types.ts](../src/lib/payment/types.ts)) hanya punya
`createPaymentLink` / `verifyTransaction` / `cancelTransaction`.

Sementara [copy.ts:1589+](../src/lib/copy.ts#L1589) menjanjikan "kami menanggapi
setiap permintaan dalam 3 hari kerja" dan "diproses melalui metode pembayaran
asal dalam 7–14 hari kerja". Saat refund disetujui, admin mengerjakannya di
luar sistem: order tetap `paid`, undangan tetap aktif → pelanggan dapat uang
kembali **dan** layanan tetap jalan, sementara rekonsiliasi rusak dan tidak ada
jejak siapa menyetujui apa.

Pengecualian yang dijanjikan sendiri — "pembayaran ganda" — justru **paling
mungkin terjadi**: `createCheckoutAction` tidak punya penahan order pending,
padahal pola itu **sudah ada** untuk add-on (`copy.checkout.momenOrderPending`).

**Perbaikan:** RPC `admin_refund_order(order_code, admin_id, reason)` mengikuti
pola `admin_lifecycle_rpcs.sql` (kunci baris → set status → opsional cabut
aktivasi → tulis `admin_logs`, satu transaksi) + Server Action ber-`requireAdmin`
+ tombol di `/admin/order` + email pemberitahuan. Tambahkan penahan order
pending di `createCheckoutAction`. Catat runbook refund di `docs/`.

---

### A4. Pelanggan tidak punya riwayat pesanan — bukti bayar hanya satu email sekali kirim
**Severity: Tinggi** · **Usaha: hari**

Satu-satunya bacaan `orders` dari sisi pelanggan ada di
`dashboard/undangan/[id]/bayar/page.tsx:39-44` dan itu `.limit(1)` — hanya order
**terakhir**, sehingga order perpanjangan menimbun order aktivasi pertama.
Halaman itu pun tak bisa dijangkau dari UI setelah pembayaran selesai:
satu-satunya pembuat tautannya adalah `redirectUrl` Pakasir
([checkout.ts:163](../src/server/actions/checkout.ts#L163)).

Jadi satu-satunya bukti transaksi adalah email kuitansi yang dikirim **sekali
tanpa retry** — komentar di
[notify.ts:115-125](../src/server/email/notify.ts#L115-L125) mengakui sendiri
"kegagalan = kuitansi hilang permanen" — dan tidak ada aksi kirim ulang di mana
pun. Sementara kebijakan refund Anda **mewajibkan pelanggan menyebutkan kode
order** yang hanya ada di email itu. Kuitansinya juga tidak memuat identitas
penjual, sehingga lemah sebagai bukti transaksi (PP 80/2019).

**Perbaikan:** route `/dashboard/pesanan` yang melist **semua** order milik user
(RLS `orders_select` sudah mengizinkan — ini murni UI), plus halaman kuitansi
print-friendly per order berisi nomor, tanggal, metode bayar
(`orders.payment_method` sudah ada), identitas penjual, rincian paket, total.
Tambahkan tombol "Kirim ulang kuitansi" (idempotency key cukup diberi sufiks
agar kirim-ulang manual tak ditolak 24 jam).

---

### A5. Tidak ada saluran dukungan yang bisa dijangkau dari dalam produk
**Severity: Sedang** (dinaikkan ke pemblokir karena A3 & A4 bergantung padanya) · **Usaha: jam**

Satu-satunya kontak, `halo@merriva.id`, hanya dirender di `/faq`, `/privasi`,
dan `/refund`. **Tidak ada** di `site-footer.tsx`, tidak ada di
`dashboard/layout.tsx`, tidak ada di `admin/layout.tsx`.

Titik paling kritis: [copy.ts:351](../src/lib/copy.ts#L351) ("…Hubungi kami bila
butuh bantuan") dan [copy.ts:915](../src/lib/copy.ts#L915) ("…hubungi kami
dengan menyebut kode pesanan di atas") dirender oleh `payment-status-poller.tsx`
pada state `review` dan `timeout` — **tepat saat uang pelanggan sudah keluar
tetapi undangannya belum aktif** — dan satu-satunya tombol di kartu itu
mengembalikannya ke dashboard. Tidak ada alamat, tidak ada nomor.

Karena webhook Pakasir tanpa signature, state `review`/`timeout` memang skenario
yang dirancang untuk terjadi. Email kuitansinya pun buntu: dikirim dari
`noreply@merriva.id` tanpa `replyTo`, dengan footer "Mohon jangan membalas email
ini". Pelanggan yang panik di H-1 tidak punya satu pun jalan.

**Perbaikan:** satu kunci `copy.support` (email + WhatsApp + jam operasional),
dirender di: kolom "Bantuan" di footer marketing, footer ringkas di layout
dashboard & admin, **di dalam kartu `review`/`timeout`/`error`** bersama kode
order yang siap disalin, dan sebagai `replyTo` di `sendTransactionalEmail`.
Tambahkan butir "saluran dukungan tayang & dijaga" ke LAUNCH-CHECKLIST Fase 8.

---

### A6. Hapus akun tidak ada di mana pun — padahal /privasi menjanjikannya
**Severity: Tinggi** · **Usaha: hari**

`grep hapus akun|deleteAccount|auth.admin.deleteUser` → **nol hit di seluruh
repo**. `admin-users.ts` hanya punya `adminSetUserRole`, `adminSuspendUser`
(ban GoTrue 100 tahun), `adminReinstateUser` — admin pun **hanya bisa
membekukan, tidak bisa menghapus**. Halaman profil tidak punya danger zone;
email dikunci `disabled readOnly` tanpa jalur ganti email di mana pun.

Padahal [copy.ts:1560](../src/lib/copy.ts#L1560) — sudah tayang publik di
`/privasi` — berbunyi "Anda dapat meminta penghapusan data kapan saja", dan
[copy.ts:1572](../src/lib/copy.ts#L1572) menjanjikan hak "mengakses,
memperbaiki, atau menghapus". Janji yang tidak dapat ditepati oleh siapa pun
adalah eksposur kepatuhan (UU PDP 27/2022), bukan sekadar celah fitur — dan
pra-launch adalah saat termurah menutupnya, sebelum ada data pelanggan sungguhan
yang harus dihapus buru-buru.

**Perbaikan (bertahap, jangan sekaligus):**
1. **Sebelum launch:** runbook penghapusan di `docs/RUNBOOK.md` — urutan tabel,
   objek storage yang ikut, dan data yang sengaja **dipertahankan** untuk
   pembukuan (`orders` dianonimkan, bukan dihapus; retensi keuangan ≥2 tahun).
   Selaraskan kalimat `copy.ts:1560/1572` dengan kenyataan itu.
2. `adminDeleteUserAction` mengikuti pola yang ada (`requireAdmin` → validasi →
   RPC yang memanggil `purge_invitation_data` per undangan → `deleteUserById` →
   `logAdminAction` → revalidate), menolak bila masih ada undangan `active`.
   RPC purge-nya **sudah ada** di `20260808140000_data_retention_purge.sql` —
   ini merangkai, bukan membangun dari nol.
3. Barulah danger zone self-service di `/dashboard/profil`.

---

## 4. Gelombang B — 30 hari pertama

### B1. Ganti kata sandi tanpa bukti kehadiran pemilik — dan komentar kodenya salah
**Severity: Tinggi** · **Usaha: hari**

[`updatePasswordAction`](../src/server/actions/auth.ts#L219-L247) hanya
memeriksa `getUser()` tidak null, lalu langsung `updateUser({ password })`.
Tidak ada kata sandi lama, tidak ada cek bahwa sesinya memang sesi recovery,
**dan tidak ada rate limit** (berbeda dari `signInAction` dan
`requestPasswordResetAction` yang keduanya dibatasi).

Komentar di `reset-password/ubah/page.tsx` menyatakan *"Jika dibuka tanpa sesi
recovery, updatePasswordAction akan menolak (getUser null)"* — **itu salah**.
Sesi dashboard biasa membuat `getUser()` tidak null. Siapa pun yang memegang
perangkat yang masih login (HP tertinggal, browser warnet) bisa membuka URL itu
langsung dan mengganti kata sandi tanpa tahu yang lama. Pemilik asli tersingkir
permanen, dan karena notifikasi "kata sandi berubah" tidak ada di **kedua**
saluran yang mungkin (template GoTrue maupun Resend sendiri — `notify.ts` hanya
mengekspor `notifyOrderPaid` dan `sendExpiryReminder`), tidak ada satu pun email
yang memberi tahu itu terjadi.

Terpisah tapi satu akar: tidak ada "Ubah kata sandi" di `/dashboard/profil`
sama sekali. Pelanggan yang hanya ingin ganti sandi harus berpura-pura lupa dan
menunggu email.

> **Koreksi teknis penting:** `secure_password_change` Supabase **bukan** "minta
> sandi lama" — flag itu mensyaratkan sesi yang baru login **atau**
> re-autentikasi lewat nonce OTP. Pola "masukkan kata sandi saat ini" tetap
> harus dibangun sendiri. Jadi pekerjaannya tiga bagian, bukan dua toggle.

**Perbaikan:** (a) halaman/kartu "Ubah kata sandi" di `/dashboard/profil` dengan
tiga field; (b) di server, buktikan kepemilikan dengan
`signInWithPassword({ email: user.email, password: current })` sebelum
`updateUser`; (c) perketat `updatePasswordAction` agar jalur tanpa sandi lama
hanya menerima sesi recovery, tambahkan rate limit, dan **perbaiki komentar
yang mendeskripsikan penjagaan yang tidak ada**; (d) aktifkan notifikasi
`password_changed` di dashboard Supabase cloud.

---

### B2. Form kata sandi tanpa satu pun pengaman salah-ketik
**Severity: Tinggi** · **Usaha: jam**

*Ini pertanyaan yang memulai audit ini.*

[`registerSchema`](../src/lib/validation/auth.ts#L26-L35) tidak punya `confirm`,
sementara [`updatePasswordSchema`](../src/lib/validation/auth.ts#L44-L53) di
file yang sama **punya** `.refine(password === confirm)`. Jadi produk ini sudah
memutuskan standar itu layak dipakai, lalu meninggalkannya justru di tempat
kata sandi diciptakan.

Tidak ada tombol "lihat kata sandi" di mana pun (`grep showPassword|EyeOff` di
`src/components/auth/` → nol; satu-satunya `EyeOff` di repo adalah toggle
visibilitas *section* tema). Aturan "minimal 8 karakter" hanya muncul **setelah**
submit ditolak — dan tantangan Turnstile sudah terpakai. Halaman **masuk** juga
tanpa toggle, jadi orang yang sudah salah ketik tak bisa melihat apa yang ia
ketik saat mencoba login.

Rantai dampaknya nyata dan sudah diverifikasi baris demi baris: salah ketik →
akun terbentuk → email verifikasi diklik → gagal masuk dengan pesan "Email atau
kata sandi salah" (yang justru mengarahkan dugaan ke email). Upaya pemulihan
naifnya — mendaftar ulang — malah menyesatkan:
[auth.ts:87-100](../src/server/actions/auth.ts#L87-L100) memperlakukan
email-sudah-terdaftar sebagai sukses generik, sehingga ia melihat "Akun dibuat,
kami mengirim tautan verifikasi" padahal kata sandinya tetap yang salah dan
tidak ada email baru.

> Perilaku anti-enumerasi itu **benar dan jangan dicabut** (keputusan sadar,
> temuan review M1.1). Justru karena jalur pemulihan sengaja dibuat buram,
> satu-satunya tempat yang sah untuk mencegah salah-ketik adalah form itu sendiri.

**Rekomendasi:** **satu kolom + tombol lihat** (bukan dua kolom) di ketiga form.
Lebih ramah HP — dan HP adalah tempat produk ini hidup — serta sejalan dengan
NIST SP 800-63B §5.1.1.2 yang menganjurkan reveal ketimbang field konfirmasi.
Konfirmasi ganda menggandakan pengetikan di keyboard ponsel dan sering disiasati
dengan salin-tempel, sehingga salah ketiknya ikut tersalin. `lucide-react`
(Eye/EyeOff) sudah dipakai di repo — nol dependency baru. Tambahkan hint statis
"Minimal 8 karakter" di bawah field, sejajar `phoneHint` yang sudah ada.
Bila tetap memilih dua kolom: string `passwordConfirm: "Ulangi kata sandi"`
**sudah ada** di [copy.ts:36](../src/lib/copy.ts#L36) dan pola `.refine`-nya
tinggal dipakai ulang — nol copy baru.

---

### B3. Tidak ada jalur upgrade paket — dan pesan kuotanya menyuruh melakukan yang mustahil
**Severity: Tinggi** · **Usaha: minggu** (butuh persetujuan pemilik — menyentuh struktur harga)

`PAYABLE_STATUSES = {draft, expired, pending_payment}` — tanpa `active` — dipakai
`checkout.ts` sebagai gerbang uang, dan `aktifkan/page.tsx` me-redirect undangan
`active` ke dashboard. Jalur admin juga tertutup: `admin_lifecycle_rpcs.sql:47`
menolak status di luar tiga itu, dan `admin_extend_invitation` hanya memperpanjang
**bulan**, tidak mengubah `package_id`.

Sementara [copy.ts:162-163](../src/lib/copy.ts#L162-L163) berbunyi *"Kuota tamu
paket sudah penuh. **Tingkatkan paket** untuk menambah tamu"* dan
[copy.ts:546](../src/lib/copy.ts#L546) senada untuk foto. Instruksi yang tombolnya
tidak ada. Satu-satunya jalan keluar pelanggan: buat undangan **baru**, slug
berbeda, bayar penuh lagi — padahal link lama sudah tersebar di grup WhatsApp.
Tamu ke-151 praktis tidak diundang.

Ini kehilangan upsell paling alami yang ada: pelanggan yang sudah terbukti mau
bayar, sedang termotivasi, di momen paling panas.

**Perbaikan:** order bertipe upgrade sebesar **selisih** harga; pada aktivasi
hanya tukar `package_id` — **jangan** sentuh `active_until`/`status` agar
invarian lifecycle dan verifikasi dua lapis Pakasir tetap utuh. Jangan lebarkan
`PAYABLE_STATUSES`; buat `UPGRADABLE_STATUSES` terpisah (komentar di
`invitation-status.ts` sendiri memperingatkan gerbang uang tak boleh melebar
diam-diam). **Karena ini menyentuh struktur paket, `SPEC.md` §4.8 wajib diubah
dulu dengan persetujuan pemilik** (boundary "TANYA DULU").
**Penambal cepat sementara:** aksi admin "ganti paket" di `/admin/undangan/[id]`
dengan `admin_logs`, **atau** ubah `copy.ts:163` & `:546` agar jujur.

---

### B4. Tidak ada throttle tingkat akun pada login
**Severity: Sedang** · **Usaha: hari**

[`signInAction`](../src/server/actions/auth.ts#L104-L141) hanya memakai
`checkClientRateLimit("auth-signin", {max: 10, windowMs: 60_000})` dengan argumen
`identity` **dikosongkan** — padahal [request-ip.ts:96-140](../src/lib/request-ip.ts#L96-L140)
menyediakan lapis itu, dan `requestPasswordResetAction` di file yang sama
**memakainya** (`staticRateKey("auth-reset-email", …)`, 3/15 menit) plus
Turnstile lebih dulu. Login tidak punya Turnstile sama sekali.

Credential stuffing datang terdistribusi dari ribuan IP, sehingga plafon per-blok
jaringan praktis tak menyentuhnya. Leaked Password Protection juga masih mati
(`LAUNCH-CHECKLIST.md:33` belum dicentang), jadi kata sandi bocor diterima apa
adanya. Rekomendasi `AUDIT-2026-09-04` KEA-1 belum diadopsi.

**Perbaikan:** tambahkan lapis `identity` per-email di `signInAction` — polanya
identik dengan reset, satu blok kode; wajibkan Turnstile setelah N kegagalan
untuk email yang sama (`TurnstileField` + `verifyTurnstile` sudah ada);
aktifkan Leaked Password Protection di dashboard Supabase.

---

### B5. Kebijakan kata sandi berhenti di panjang 8
**Severity: Sedang** · **Usaha: jam**

[`passwordField`](../src/lib/validation/auth.ts#L13-L16) = min 8, max 72 — tanpa
syarat komposisi, tanpa blocklist, tanpa cek kebocoran. `12345678`, `password`,
dan `merriva123` lolos mulus; semuanya ada di daftar bocoran teratas.

Pagar panjang-8 itu hidup di Zod sisi aplikasi, jadi hanya berlaku selama setiap
penulisan kata sandi melewati form Merriva. Setelan lapis auth di proyek cloud
perlu diselaraskan agar tidak lebih longgar.

**Perbaikan:** di Supabase cloud → Authentication → Policies: set minimum
password length 8 dan aktifkan Leaked Password Protection (menutup B4 sekaligus).
Naikkan juga `minimum_password_length` di `supabase/config.toml` ke 8 agar dev
lokal tak lebih longgar dari produksi. Catat kebijakan finalnya sebagai §baru di
`docs/AUTH-SETUP.md` supaya setelan dashboard yang tak ter-versioning itu punya
jejak.

---

### B6. Media tidak punya backup sama sekali
**Severity: Sedang** · **Usaha: hari**

Seluruh `grep backup` di `docs/*.md` hanya tentang Postgres
(`RUNBOOK.md:32-36`, `LAUNCH-CHECKLIST.md:54-55`, `ARCHITECTURE.md:103`). Nol
baris tentang versioning atau replikasi objek Storage. `src/lib/storage/` hanya
punya put/delete tanpa lapis pemulihan, dan penghapusan permanen tersebar di
enam jalur (cron purge, pemilik menghapus undangan, `media.ts`, moderasi momen,
`momen-guest.ts`).

Backup managed Postgres **tidak** mencakup objek Storage. Konsekuensinya bukan
sekadar "foto hilang": restore Postgres justru menghasilkan keadaan **tak
konsisten** — baris `media`/`momen_photos` hidup kembali sementara objeknya sudah
tidak ada, galeri tampil 404, dan tak ada cara mengembalikannya. Untuk Album
Momen kerugiannya tak tergantikan: jepretan tamu di acara yang sudah lewat.
`RUNBOOK.md` menyatakan media "Hilang bila VPS mati? Tidak" — benar untuk
skenario itu, tetapi itu satu-satunya skenario yang pernah dipertimbangkan.

**Perbaikan:** (1) saat pindah ke R2 (LAUNCH-CHECKLIST Fase 5), aktifkan object
versioning + lifecycle rule (simpan versi lama 30 hari) **sebelum** trafik nyata
masuk — satu setelan menutup penghapusan keliru maupun bug purge; (2) jadikan
penghapusan di jalur pemilik/moderasi sebagai tunda-hapus (`deleted_at`, objek
dihapus cron setelah 30 hari); (3) tambahkan §"Backup & restore media" di
`RUNBOOK.md` yang menyatakan tegas bahwa backup Supabase **tidak** mencakup
Storage, dan masukkan verifikasi media ke latihan restore wajib Fase 5.

---

### B7. Data dihapus permanen tanpa peringatan; transisi lifecycle lain juga senyap
**Severity: Sedang** · **Usaha: hari**

`cron/purge-expired` menghapus permanen tamu, RSVP, `gift_notes`,
`invitation_events`, objek media galeri, dan foto Album Momen — **tanpa satu pun
import email**. Sama untuk `cron/expire-invitations` (link berhenti tayang).
`adminActivateInvitationAction` (aktivasi manual/transfer bank) dan
`adminSuspendInvitationAction` juga tidak memberi tahu siapa pun.

Seluruh inventaris email produk ini = **3 templat, 2 call-site**. Satu-satunya
email pra-kehilangan adalah pengingat H-14 yang hanya mengajak memperpanjang —
tak pernah menyebut data akan dihapus atau menyarankan mengunduh dulu.
Sementara `docs/DATA-MODEL.md:68` **menjanjikan** "Email pengingat sebelum
penghapusan" yang tidak pernah dibuat.

**Perbaikan:** templat + cron peringatan pra-purge H-30 dan H-7 (kolom
`purge_warned_at` mengikuti pola `reminder_sent_at` yang sudah terbukti
idempoten) berisi tautan ekspor; email pada `expire-invitations`; panggil
`notifyOrderPaid` dari `adminActivateInvitationAction` agar aktivasi manual tetap
berkuitansi; email alasan + cara banding pada suspend.

---

## 5. Gugur di verifikasi — dan kenapa itu penting

Enam temuan dibantah penguji independen. Dicatat di sini karena **alasan
gugurnya sendiri adalah informasi**, dan karena hampir semua menyisakan inti
kecil yang tetap layak dikerjakan.

| Temuan | Kenapa gugur | Sisa yang berdiri |
|---|---|---|
| **Kebijakan privasi tidak lengkap** (diklaim tinggi) | Pasal 21(1) UU PDP tidak mewajibkan penyebutan seluruh pemroses — itu bahasa GDPR Art. 13(1)(e) yang diimpor; Pasal 56 mewajibkan *memastikan* pelindungan, bukan mengungkap. Klaim "tamu tak pernah diberi pemberitahuan" juga berlebihan: [copy.ts:817-826](../src/lib/copy.ts#L817-L826) memberi tujuan + jenis data + waktu reveal sebelum kamera dibuka. Sentry pun belum aktif (DSN kosong). | **Rendah:** kategori data Album Momen (foto, `guest_name`, `device_id`) tak disebut di `copy.ts:1526`; tak ada paragraf transfer lintas yurisdiksi; tak ada tautan `/privasi` di form RSVP/amplop. Satu sesi edit copy, 30–60 menit — kerjakan saat mencentang `LAUNCH-CHECKLIST.md:85`. |
| **Deploy tidak bergerbang CI** (diklaim tinggi) | Judulnya salah. `Dockerfile:41` menjalankan `next build`, dan `next.config.ts` **tidak** menyetel `typescript.ignoreBuildErrors` — jadi commit merah di Typecheck/Build **gagal dibangun** dan kontainer lama tetap menyajikan trafik. Kelas kegagalan terparah sudah ter-gerbang platform. Preseden "build merah 30 Jul" juga salah alamat: saat itu belum ada aplikasi ter-deploy. | **Rendah:** yang benar-benar lolos hanya `pnpm test` (vitest tak ada di image), `pnpm lint`, dan gerbang anggaran bundle. Judul jujurnya: "gerbang unit-test & anggaran bundle tidak menahan deploy". |
| **CSP setengah jadi** (diklaim sedang) | Mekanismenya tak bekerja di arsitektur ini: CSP ber-nonce menuntut render per-request, sementara `/[slug]` ISR karena mandat Lighthouse ≥90 / LCP <2,5 dtk. CSP yang bisa dipasang di sana (`script-src 'self' 'unsafe-inline'`) tidak mengurung XSS sama sekali. Argumen supply-chain juga salah sasaran — paket npm jahat ter-bundel sebagai `'self'`. | **Rendah:** empat direktif **gratis** di header global tanpa menyentuh ISR: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. Dua terakhir menutup eskalasi pasca-XSS tanpa `script-src`. Dan: ADR #27 memberi alasan yang benar (`style-src`) untuk direktif yang salah — layak dikoreksi di DECISIONS. |
| **Ekspor ucapan & amplop** (diklaim tinggi) | "Ucapan tidak bisa diunduh sama sekali" salah: ucapan tamu bertoken **sudah** jadi kolom di `daftar-tamu.xlsx` (`guest-import-export.tsx:150,168`). Seluruh RSVP non-token dan buku amplop tampil penuh di `/ucapan` selama 12–18 bulan. Pengecualian `gift_notes` dari ekspor tamu **disengaja** demi privasi (DECISIONS #733 — sengaja tak menyimpan `guest_id`). | **Rendah:** `gift_notes` tak punya tombol unduh; RSVP non-token butuh sheet kedua (bukan filter yang keliru). |
| **Boundary galat per route group** (diklaim sedang) | Bertabrakan dengan ADR #45 yang menyebut satu per satu ketiga boundary dan alasannya, termasuk kenapa `/[slug]` **sengaja** tanpa boundary (bundel tamu 71,2 KB > anggaran 64 KB). Premis teknisnya juga runtuh: `(admin)`, `/dashboard`, `/dashboard/profil` **menelan** galat DB (`const { data } = …`) sehingga boundary tak pernah kena; `(auth)` tak membaca tabel DB sama sekali. | **Rendah:** satu `not-found.tsx` di level `(dashboard)` — 20 pemanggilan `notFound()` kini mendarat di halaman bergaya marketing yang teksnya ditulis untuk **tamu** dan CTA-nya ke `/`, melempar pemilik keluar dari sesi kerjanya. |
| **robots/sitemap/favicon** (diklaim sedang) | Framing "fondasi akuisisi pencarian organik" tidak cocok dengan produk ini: `PRD.md:27` menyatakan mesin akuisisinya viral tamu→pembeli lewat WhatsApp + bundling EO; pencarian organik tak pernah terdaftar sebagai kanal. Konten yang berskala (`/[slug]`) justru **sengaja** noindex demi privasi. Enam halaman statis yang tersisa semuanya tertaut dari navbar/footer — sitemap tak menambah apa pun. Slug "robots"/"sitemap" yang dipesan di `slug.ts` adalah higiene namespace, bukan pekerjaan yang ditinggalkan. | **Rendah:** ikon situs/favicon memang belum ada dan kasatmata di setiap tab — tapi itu isu **branding**, ~15 menit, bukan SEO. |

---

## 6. Temuan baru yang muncul justru dari verifikasi

**Dashboard & panel admin menelan galat DB tanpa penanda.** Saat memeriksa
temuan boundary, penguji menemukan kebalikannya: `(admin)` (9 bacaan) dan
`/dashboard`, `/dashboard/profil`, `undangan/baru` semuanya memakai
`const { data } = await …` tanpa cek error. Saat DB berkedip, **pemilik melihat
daftar undangan kosong dan admin melihat tabel kosong — tanpa tanda bahwa
sesuatu gagal.** Ini persis kelas yang ditutup DECISIONS #45/#46 untuk permukaan
tamu, tetapi belum ditutup di dua area ter-auth. *Severity: sedang.*

---

## 7. Hal yang sudah memenuhi standar

Disebutkan supaya tidak dirusak saat memperbaiki yang lain:

- **RLS aktif di seluruh tabel**, `service_role` dipisah rapi, dan tidak ada
  satu pun secret di sejarah git (`.gitignore` dan `.dockerignore` keduanya benar).
- **Anti-enumerasi email** dikerjakan konsisten di signup **dan** reset —
  termasuk mendahulukan Turnstile sebelum membuat kunci limiter apa pun
  (DECISIONS #39). Ini di atas rata-rata; jangan dicabut demi UX.
- **Verifikasi pembayaran dua lapis**: webhook Pakasir diperlakukan sebagai
  sinyal, bukan bukti, dan selalu dikonfirmasi lewat `transactiondetail`.
- **Retensi UU PDP** benar-benar diimplementasikan (`purge_invitation_data`,
  termasuk foto Album Momen), bukan hanya dijanjikan di halaman privasi.
- **Header keamanan** lengkap kecuali CSP penuh: HSTS (hanya production),
  nosniff, Referrer-Policy, Permissions-Policy dengan `camera=(self)` yang
  memang dibutuhkan Album Momen, dan `frame-ancestors 'none'` di permukaan
  ter-auth.
- **Penyaring PII Sentry** (`sentry-scrub.ts`) fail-closed dan membuang
  `guests.token` dari URL, header, cookie, body, span, dan breadcrumb.
- **Boundary galat** yang ada ditempatkan dengan alasan terukur dan tercatat
  (ADR #45), bukan asal pasang — termasuk keputusan sadar untuk **tidak**
  memasangnya di `/[slug]` demi anggaran bundle.
- **Ekspor daftar tamu** ke Excel sudah berfungsi, memenuhi kriteria terima
  SPEC §4.7.

---

## 8. Roadmap

**Gelombang A — sebelum menerima uang pertama**
1. A1 Custom SMTP + uji 3 akun di luar tim *(jam)* — **paling menentukan**
2. A2 Halaman `/syarat` + identitas badan usaha *(hari; kunci dulu `SPEC.md:444`)*
3. A5 `copy.support` di 4 titik *(jam)* — prasyarat A3 & A4
4. A4 `/dashboard/pesanan` + kuitansi cetak + kirim ulang *(hari)*
5. A3 RPC refund + tombol admin + penahan order pending *(hari)*
6. A6 Runbook hapus akun + `adminDeleteUserAction` *(hari)*

**Gelombang B — 30 hari pertama**
7. B2 Toggle lihat-sandi di 3 form + hint *(jam)* — termurah, langsung terasa
8. B5 Password policy + Leaked Password Protection *(jam)*
9. B4 Throttle per-email + Turnstile login *(hari)*
10. B1 Ubah kata sandi di profil + verifikasi sandi lama + notifikasi *(hari)*
11. B7 Peringatan pra-purge + email lifecycle *(hari)*
12. B6 Versioning R2 + tunda-hapus *(hari; jadwalkan bersama Fase 5)*
13. B3 Upgrade paket *(minggu; **butuh persetujuan** — ubah `SPEC.md` §4.8 dulu)*

**Gelombang C — backlog ber-tanggal**
Monitoring cron (dead-man switch), observabilitas email (`reportHandledError`
menggantikan `console.warn` — sekalian hapus komentar yang salah mengklaim
Sentry menangkap console), Dependabot + gitleaks di CI, §rotasi kredensial di
RUNBOOK, notis persetujuan + bagian "dasar pemrosesan" di kebijakan privasi,
kategori data Album Momen di `/privasi`, empat direktif CSP gratis, favicon,
ekspor `gift_notes`, `not-found.tsx` untuk `(dashboard)`, gerbang deploy
`needs: verify`, dan penanganan galat DB di dashboard/admin (§6).

---

## 9. Cakupan & keterbatasan

- **Read-only.** Tidak ada kode aplikasi yang diubah selama audit.
- **Dikecualikan:** `node_modules/`, `.next/`, komponen shadcn yang di-vendor
  di `src/components/ui/`, dan file hasil generate.
- **Tidak bisa diperiksa dari kode:** setelan dashboard Supabase cloud (Custom
  SMTP, Leaked Password Protection, Secure password change, panjang minimum
  kata sandi) tidak ada di repo. Yang terbukti adalah **kontrak launch
  memperlakukannya opsional** dan jalur signup belum pernah berhasil — bukan
  bahwa setelannya pasti belum ada. Verifikasi manual di dashboard tetap wajib.
- **Tidak dijalankan:** Lighthouse, uji WebView WhatsApp, uji screen reader,
  dan `pnpm test:db` (pgTAP) — semuanya butuh lingkungan yang tidak tersedia
  saat audit. Kontras warna & ukuran bundle tidak diaudit ulang (sudah dicakup
  `AUDIT-2026-09-04` dan gerbang anggaran CI).
- **Asimetri keyakinan** antara temuan gelombang A/B kelompok pertama dan
  sisanya — lihat §2. Severity pada A2–A4, A6, B1–B3 belum diuji dengan lensa
  seketat yang dipakai pada temuan lain.
