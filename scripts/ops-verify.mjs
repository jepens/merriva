/**
 * `pnpm ops:verify` — memeriksa PRODUKSI, bukan niat.
 *
 * Masalah yang diselesaikannya: separuh butir `docs/LAUNCH-CHECKLIST.md` adalah
 * setelan di dasbor orang lain (Supabase, Cloudflare, Easypanel, Pakasir), dan
 * kegagalannya kelas SENYAP — cron yang berhenti, DSN Sentry yang kosong, MX
 * yang tak pernah dibuat, `otp_expiry` yang lebih longgar dari yang diterima
 * aplikasi. Tak satu pun melempar galat. Satu-satunya cara mengetahuinya adalah
 * BERTANYA, dan sebelum skrip ini jawabannya didapat dengan belasan probe
 * manual yang hasilnya hilang begitu sesi berakhir.
 *
 * ATURAN DESAIN YANG MENENTUKAN SEGALANYA: skrip ini **tidak pernah**
 * mempercayai berkas lokal untuk menjawab "apa yang terpasang di produksi".
 * `.env.production.local` adalah snapshot yang membasi — pada 15 Okt 2026 ia
 * masih menulis `STORAGE_DRIVER=supabase` dan `NEXT_PUBLIC_MEDIA_URL` kosong
 * sementara produksi sudah berjalan dengan driver `local` dan media tersaji
 * normal. Membacanya sebagai kebenaran akan menghasilkan laporan yang salah
 * dengan penuh keyakinan. Berkas lokal dipakai HANYA untuk mengambil kunci
 * (service role, token Management API); seluruh jawaban datang dari jaringan.
 *
 * Tiga tingkat hasil, dan bedanya penting:
 *   GAGAL    — terbukti salah. Keluar dengan kode 1.
 *   PERHATIAN— terbukti tidak ideal, tetapi bukan penghalang.
 *   DILEWATI — TIDAK BISA diperiksa (kunci tak ada). Bukan "aman" — tak diketahui.
 *
 * Yang sengaja TIDAK dilakukan: memanggil endpoint `/api/cron/*`. Memanggilnya
 * berarti benar-benar MENJALANKAN job — membatalkan order, mengirim email,
 * menghapus data retensi. Kesehatan cron dibaca dari tabel `cron_runs` saja.
 *
 * Pemakaian:
 *   pnpm ops:verify                     # target https://merriva.id
 *   pnpm ops:verify --url=https://staging.example
 *   pnpm ops:verify --help
 */

import { readFileSync } from "node:fs";
import { resolveMx, resolveTxt } from "node:dns/promises";

import {
  angkaStats,
  FAKTOR_BASI,
  JADWAL_JAM,
  STATS_GAGAL,
  STATS_PERHATIAN,
} from "./ops-schedule.mjs";

const ROOT = new URL("..", import.meta.url);

// --- Pengumpul hasil ---------------------------------------------------------

const hasil = [];
let bagian = "";

function mulai(nama) {
  bagian = nama;
  console.log(`\n${nama}`);
  console.log("-".repeat(nama.length));
}

function catat(tingkat, judul, detail) {
  hasil.push({ tingkat, bagian, judul });
  const tanda = { ok: "  ok ", gagal: "GAGAL", warn: "  ! ", lewat: "  – " }[
    tingkat
  ];
  console.log(`${tanda} ${judul}${detail ? ` — ${detail}` : ""}`);
}

const ok = (j, d) => catat("ok", j, d);
const gagal = (j, d) => catat("gagal", j, d);
const warn = (j, d) => catat("warn", j, d);
const lewat = (j, d) => catat("lewat", j, d);

/** Pembanding yang menulis sendiri pesan "harap X, dapat Y". */
function harap(judul, syarat, dapat, harapan) {
  if (syarat) ok(judul, String(dapat));
  else gagal(judul, `dapat ${dapat}, harap ${harapan}`);
}

// --- Kredensial (dari berkas lokal; nilainya tak pernah dicetak) -------------

function bacaEnvLokal() {
  const out = {};
  for (const nama of [".env.production.local", ".env.local"]) {
    let teks;
    try {
      teks = readFileSync(new URL(nama, ROOT), "utf8");
    } catch {
      continue;
    }
    for (const baris of teks.split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(baris.trim());
      if (!m) continue;
      const nilai = m[2].replace(/^["']|["']$/g, "");
      if (nilai && !(m[1] in out)) out[m[1]] = nilai;
    }
  }
  return out;
}

function bacaMcp() {
  try {
    const j = JSON.parse(readFileSync(new URL(".mcp.json", ROOT), "utf8"));
    const s = j.mcpServers?.supabase ?? {};
    const ref = (s.args ?? [])
      .map((a) => /^--project-ref=(.+)$/.exec(a)?.[1])
      .find(Boolean);
    return { token: s.env?.SUPABASE_ACCESS_TOKEN ?? null, ref: ref ?? null };
  } catch {
    return { token: null, ref: null };
  }
}

// --- HTTP -------------------------------------------------------------------

async function ambil(url, opts = {}) {
  try {
    const res = await fetch(url, { redirect: "manual", ...opts });
    return res;
  } catch (e) {
    return { ok: false, status: 0, galat: e.message, headers: new Headers() };
  }
}

// === 1. Situs ===============================================================

async function periksaSitus(app) {
  mulai("1. Situs");

  let basisMedia = "";
  const health = await ambil(`${app}/api/health`);
  if (health.status !== 200) {
    gagal("/api/health", `status ${health.status || health.galat}`);
    // Health 503 PUNYA badan JSON yang menyebut sebabnya — membuangnya berarti
    // kehilangan satu-satunya keterangan yang ada.
    const j = await health.json?.().catch(() => null);
    if (j?.mediaPesan) gagal("konfigurasi media", j.mediaPesan);
  } else {
    const j = await health.json().catch(() => ({}));
    // `db: "not_configured"` dinilai SEHAT oleh endpoint-nya (env Supabase
    // kosong), jadi 200 saja bukan bukti. Nilai `db` harus dilihat sendiri.
    harap("/api/health", j.db === "up", `db=${j.db}`, "db=up");

    // Pasangan STORAGE_DRIVER (runtime) x NEXT_PUBLIC_MEDIA_URL (build-time).
    if (j.media && j.media !== "ok") {
      gagal("konfigurasi media", j.mediaPesan ?? j.media);
    }

    // Basis media yang BENAR-BENAR terpasang. Ia tak pernah sampai ke chunk
    // peramban (pemanggilnya `server-only`), jadi inilah satu-satunya cara
    // memverifikasi build-arg paling menentukan saat pindah driver — dan
    // satu-satunya cara memprobe objek media lewat host yang sungguh dipakai
    // tamu, alih-alih `<app>/media/` yang dipaku dan akan salah setelah
    // cutover ke R2.
    basisMedia = typeof j.mediaBase === "string" ? j.mediaBase : "";
    if (basisMedia) ok("basis media terpasang", basisMedia);
    else lewat("basis media", "tak dilaporkan health (image lama?)");

    // Paruh RUNTIME dari pasangan itu. Dicetak bersebelahan dengan basisnya
    // supaya operator melihat KEDUANYA dalam satu layar — ketidakcocokan
    // merekalah yang menjadi seluruh alasan gerbang media ada.
    if (typeof j.driver === "string" && j.driver) {
      if (j.driver === "tak-dikenali")
        gagal("STORAGE_DRIVER", "ejaan tak dikenali — health menolaknya");
      else ok("driver storage aktif", j.driver);
    } else {
      lewat("driver storage", "tak dilaporkan health (image lama?)");
    }

    // `CRON_SECRET` KOSONG dan `CRON_SECRET` SALAH terlihat identik dari luar:
    // keduanya 401, keduanya diam. Yang ini memisahkan keduanya — selebihnya
    // tetap harus dibuktikan dengan satu panggilan cron yang 200, bukan 401.
    if (typeof j.cronSecret === "boolean") {
      harap(
        "CRON_SECRET terpasang",
        j.cronSecret,
        j.cronSecret,
        "true — tanpa ini keempat cron dijawab 401 selamanya",
      );
    } else {
      lewat("CRON_SECRET", "tak dilaporkan health (image lama?)");
    }
  }

  const syarat = await ambil(`${app}/syarat`);
  const html = syarat.status === 200 ? await syarat.text() : "";
  harap(
    "identitas pelaku usaha tayang",
    html.includes("Identitas pelaku usaha") && /Merriva/.test(html),
    syarat.status === 200 ? "ada di /syarat" : `status ${syarat.status}`,
    "nama + alamat tampil sebelum pembayaran (PP 80/2019)",
  );

  // HARUS tetap di baris terakhir. Commit b194f69 menaruh `return basisMedia`
  // tepat sebelum pemeriksaan /syarat di atas, sehingga selama dua hari
  // pemeriksaan kepatuhan itu TIDAK PERNAH JALAN — dan ketiadaannya tak
  // terlihat, karena baris yang absen di laporan tampak seperti ketiadaan,
  // bukan seperti kegagalan.
  //
  // Tak ada satu pun gerbang yang melihatnya, dan sebabnya DUA, bukan satu:
  // `scripts/**` ada di `globalIgnores` ESLint, DAN `no-unreachable` memang tak
  // pernah aktif di konfigurasi ini sama sekali (`eslint-config-next` tidak
  // memuat `eslint:recommended`). Keduanya sudah ditutup; `allowUnreachableCode:
  // false` menutup sisi TypeScript-nya.
  return basisMedia;
}

// === 2. Bundel klien (build-arg yang benar-benar ter-inline) =================

async function periksaBundel(app) {
  mulai("2. Bundel klien — bukti build-arg benar-benar ter-inline");

  const res = await ambil(`${app}/daftar`);
  if (res.status !== 200) {
    lewat("bundel", `/daftar status ${res.status || res.galat}`);
    return;
  }
  const html = await res.text();
  const chunks = [
    ...new Set(html.match(/\/_next\/static\/chunks\/[^"]+\.js/g) ?? []),
  ].slice(0, 30);
  if (chunks.length === 0) {
    lewat("bundel", "tak ada chunk yang bisa dibaca dari /daftar");
    return;
  }

  let adaDsn = false;
  let adaSitekey = false;
  for (const c of chunks) {
    const r = await ambil(`${app}${c}`);
    if (r.status !== 200) continue;
    const js = await r.text();
    if (/https:\/\/[0-9a-f]{8,}@[\w.-]*sentry[\w.-]*\/\d+/.test(js))
      adaDsn = true;
    if (/\b0x4[A-Za-z0-9]{10,}\b/.test(js)) adaSitekey = true;
    if (adaDsn && adaSitekey) break;
  }

  // Keduanya build-arg: mengisinya di panel SETELAH image jadi tak berpengaruh
  // sampai rebuild, jadi yang membuktikan hanya isi bundel itu sendiri.
  if (adaDsn) ok("NEXT_PUBLIC_SENTRY_DSN", "DSN ada di bundel → Sentry aktif");
  else
    gagal(
      "NEXT_PUBLIC_SENTRY_DSN",
      "tak ada DSN di bundel → Sentry NON-AKTIF. Isi sebagai build-arg lalu REBUILD",
    );

  if (adaSitekey) ok("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "sitekey ada di bundel");
  else
    gagal(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "tak ada sitekey → widget tak dirender → semua form ditolak",
    );
}

// === 3. DNS =================================================================

async function periksaDns(app) {
  mulai("3. DNS");

  const host = new URL(app).hostname;

  // Verifikasi domain Resend hanya memberi hak MENGIRIM. Tanpa MX, alamat yang
  // tercetak di tiga halaman hukum sebagai kanal hapus-data UU PDP memantul.
  try {
    const mx = await resolveMx(host);
    if (mx.length > 0) {
      ok(
        `MX ${host}`,
        mx.map((m) => `${m.exchange}(${m.priority})`).join(", "),
      );
    } else {
      gagal(`MX ${host}`, "kosong → halo@ tak bisa MENERIMA email");
    }
  } catch {
    gagal(
      `MX ${host}`,
      "tidak ada → halo@ tak bisa MENERIMA email (kanal hapus-data UU PDP di /syarat, /privasi, /refund)",
    );
  }

  try {
    const txt = (await resolveTxt(`_dmarc.${host}`)).flat().join(" ");
    harap(`DMARC ${host}`, /v=DMARC1/i.test(txt), txt.slice(0, 80), "v=DMARC1");
  } catch {
    warn(
      `DMARC ${host}`,
      "tidak ada — deliverability lebih rapuh dari seharusnya",
    );
  }

  try {
    const dkim = (await resolveTxt(`resend._domainkey.${host}`))
      .flat()
      .join("");
    harap(
      "DKIM resend._domainkey",
      dkim.includes("p="),
      "ada",
      "kunci publik p=",
    );
  } catch {
    gagal(
      "DKIM resend._domainkey",
      "tidak ada → email keluar gampang masuk spam",
    );
  }
}

// === 4. Konfigurasi Auth (Management API) ===================================

async function periksaAuth(token, ref) {
  mulai("4. Konfigurasi Auth Supabase");

  if (!token || !ref) {
    lewat(
      "konfigurasi auth",
      "butuh SUPABASE_ACCESS_TOKEN (env atau .mcp.json) + project ref",
    );
    return;
  }

  const res = await ambil(
    `https://api.supabase.com/v1/projects/${ref}/config/auth`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status !== 200) {
    lewat(
      "konfigurasi auth",
      `Management API status ${res.status || res.galat}`,
    );
    return;
  }
  const c = await res.json();

  const kustom = (s) =>
    typeof s === "string" &&
    s.includes("TokenHash") &&
    s.includes("/auth/confirm");

  // Templat bawaan mengirim kode PKCE yang kedaluwarsa 5 MENIT setelah
  // pendaftaran, bukan setelah klik — akun aktif tetapi tautannya "tidak valid"
  // (DECISIONS #81). Bentuk `{{ .TokenHash }}` yang menyembuhkannya.
  harap(
    "templat Confirm signup",
    kustom(c.mailer_templates_confirmation_content),
    kustom(c.mailer_templates_confirmation_content)
      ? "TokenHash + /auth/confirm"
      : "masih bawaan/tanpa TokenHash",
    "{{ .TokenHash }} + /auth/confirm",
  );
  harap(
    "templat Reset password",
    kustom(c.mailer_templates_recovery_content),
    kustom(c.mailer_templates_recovery_content)
      ? "TokenHash + /auth/confirm"
      : "masih bawaan/tanpa TokenHash",
    "{{ .TokenHash }} + /auth/confirm",
  );

  // Aplikasi menolak grant email > 30 menit (EMAIL_GRANT_MAX_AGE_SEC). Bila
  // GoTrue lebih longgar, tautan yang diklik di menit ke-31+ LOLOS verifyOtp
  // lalu ditolak aplikasi: pengguna sudah masuk, lihat form, lalu ditolak.
  harap(
    "mailer_otp_exp",
    c.mailer_otp_exp <= 1800,
    `${c.mailer_otp_exp}s`,
    "<= 1800s",
  );

  harap(
    "Confirm email aktif",
    c.mailer_autoconfirm === false,
    `mailer_autoconfirm=${c.mailer_autoconfirm}`,
    "false",
  );
  harap(
    "pendaftaran terbuka",
    c.disable_signup === false,
    `disable_signup=${c.disable_signup}`,
    "false",
  );
  harap(
    "rate limit email",
    c.rate_limit_email_sent > 2,
    `${c.rate_limit_email_sent}/jam`,
    "> 2/jam",
  );

  // SMTP bawaan Supabase MENOLAK mengirim ke alamat di luar anggota tim project:
  // tanpa custom SMTP, deliverability ke pelanggan 0% — bukan sekadar kuota.
  harap(
    "Custom SMTP",
    Boolean(c.smtp_host),
    c.smtp_host || "(kosong = SMTP bawaan)",
    "smtp.resend.com",
  );
  if (c.smtp_host && /^(noreply|no-reply)$/i.test(c.smtp_sender_name ?? "")) {
    warn(
      "smtp_sender_name",
      `"${c.smtp_sender_name}" — pelanggan melihat pengirim bernama ini, bukan "Merriva"`,
    );
  }

  harap(
    "password_min_length",
    (c.password_min_length ?? 0) >= 8,
    c.password_min_length,
    ">= 8 (samakan dgn aplikasi)",
  );
  // TETAP GAGAL, bukan diturunkan jadi peringatan: ini celah keamanan nyata,
  // dan jalannya ADA — beli Pro, yang Fase 5 memang sudah wajibkan sebelum
  // klien berbayar pertama. Yang dibetulkan hanya pesannya. Sebelum ini ia
  // berbunyi "harap true" seolah ada toggle yang tinggal diklik; Management API
  // menjawab HTTP 402 di free tier ("available on Pro Plans and up"), jadi
  // pemilik akan mencarinya di dashboard dan tak menemukan apa pun.
  harap(
    "Leaked Password Protection",
    c.password_hibp_enabled === true,
    c.password_hibp_enabled,
    "true — BUTUH Supabase Pro (API 402 di free tier); lihat Fase 5",
  );

  // DECISIONS #89 — ini satu-satunya butir yang GAGAL bila AKTIF.
  harap(
    "Secure password change MATI (ADR #89)",
    c.security_update_password_require_reauthentication === false,
    c.security_update_password_require_reauthentication,
    "false — bila true, GoTrue menuntut nonce dan KEDUA jalur kata sandi mati",
  );

  harap(
    "provider Google",
    c.external_google_enabled === true,
    c.external_google_enabled,
    "true",
  );

  const daftar = c.uri_allow_list ?? "";
  harap(
    "redirect allow list",
    daftar.includes("/auth/callback") && daftar.includes("/auth/confirm"),
    daftar || "(kosong)",
    "memuat /auth/callback DAN /auth/confirm",
  );
}

// === 5. Data produksi (PostgREST, service role) =============================

async function periksaData(env, app, basisMedia) {
  mulai("5. Data produksi");

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    lewat("data", "butuh NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    return;
  }
  const h = { apikey: key, Authorization: `Bearer ${key}` };

  async function pilih(path) {
    const r = await ambil(`${url}/rest/v1/${path}`, { headers: h });
    if (r.status !== 200) return null;
    return r.json().catch(() => null);
  }
  async function hitung(tabel, filter = "") {
    const r = await ambil(
      `${url}/rest/v1/${tabel}?select=id&limit=1${filter}`,
      {
        headers: { ...h, Prefer: "count=exact" },
      },
    );
    const cr = r.headers?.get?.("content-range");
    const n = cr ? Number(cr.split("/")[1]) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  // --- cron: kegagalannya berbentuk KEHENINGAN, bukan galat -----------------
  const cron = await pilih(
    "cron_runs?select=name,last_run_at,ok,failures,last_error,stats",
  );
  if (cron === null) {
    lewat("cron_runs", "tak terbaca");
  } else {
    const byName = new Map(cron.map((r) => [r.name, r]));
    for (const [nama, jam] of Object.entries(JADWAL_JAM)) {
      const row = byName.get(nama);
      if (!row) {
        gagal(
          `cron ${nama}`,
          "BELUM PERNAH jalan — belum terpasang di crontab host (Fase 3 pasang-cron-host.sh; backup-media: Fase 5 pasang-backup-media.sh)",
        );
        continue;
      }
      const umurJam = (Date.now() - Date.parse(row.last_run_at)) / 3_600_000;
      if (umurJam > jam * FAKTOR_BASI) {
        gagal(
          `cron ${nama}`,
          `BASI — terakhir ${umurJam.toFixed(1)} jam lalu (jadwal ${jam} jam)`,
        );
      } else if (!row.ok) {
        gagal(
          `cron ${nama}`,
          `gagal terakhir: ${row.last_error ?? "tanpa pesan"}`,
        );
      } else {
        ok(
          `cron ${nama}`,
          `${umurJam.toFixed(1)} jam lalu, ${row.failures} gagal total`,
        );
      }

      const rusak = angkaStats(row.stats, (k) => STATS_GAGAL.test(k));
      if (rusak.length) {
        gagal(`cron ${nama} — pekerjaan tak terjadi`, rusak.join(", "));
      }
      const tinjau = angkaStats(row.stats, (k) => STATS_PERHATIAN.has(k));
      if (tinjau.length) {
        warn(`cron ${nama} — perlu ditinjau`, tinjau.join(", "));
      }
    }
  }

  // --- isi awal -------------------------------------------------------------
  const lagu = await hitung("songs", "&is_active=eq.true");
  harap(
    "lagu aktif",
    (lagu ?? 0) >= 1,
    lagu,
    ">= 1 (kalau 0, musik undangan senyap)",
  );

  const tema = await hitung("themes", "&is_active=eq.true");
  harap("tema aktif", (tema ?? 0) >= 1, tema, ">= 1");

  const admin = await hitung("profiles", "&role=eq.admin");
  harap(
    "akun admin",
    (admin ?? 0) >= 1,
    admin,
    ">= 1 (tanpa ini /admin tak terjangkau)",
  );

  // Yang berisiko bukan "ada tier aktif" melainkan tier GRATIS + self-service:
  // ia membuat album tanpa order sama sekali, jadi siapa pun dengan undangan
  // aktif bisa menumpuk objek media tanpa satu rupiah masuk. Tier BERBAYAR
  // justru keadaan yang dituju — memperingatkannya membuat alarm ini berbunyi
  // selamanya dengan alasan yang keliru (dibuka 27 Okt 2026: 4 tier berbayar
  // menyala, `momen_5` tetap tertutup).
  const momen = await hitung(
    "packages",
    "&kind=eq.addon_momen&is_active=eq.true",
  );
  // Dikunci pada KODE, bukan harga. `activateFreeMomenAction` mengenali jalur
  // tanpa-order dari `MOMEN_FREE_CODE` (`momen_5`) — jadi harga yang diubah di
  // `/admin/paket` menggeser alarm ini menjauh dari gerbang yang sebenarnya:
  // `momen_5` berharga membuat alarm diam sementara jalur gratis tetap terbuka.
  const momenGratis = await hitung(
    "packages",
    "&kind=eq.addon_momen&is_active=eq.true&code=eq.momen_5",
  );
  if ((momenGratis ?? 0) > 0) {
    warn(
      "add-on Album Momen",
      `tier GRATIS self-service AKTIF — album bisa dibuat tanpa order (${momen} tier aktif)`,
    );
  } else if ((momen ?? 0) > 0) {
    ok("add-on Album Momen", `${momen} tier berbayar aktif; tier gratis tutup`);
  } else {
    ok("add-on Album Momen", "seluruh tier nonaktif");
  }

  // --- jalur uang -----------------------------------------------------------
  const orders = await hitung("orders");
  if ((orders ?? 0) === 0) {
    warn(
      "jalur pembayaran",
      "orders = 0 — belum pernah ada uang masuk di produksi (Fase 7 belum dijalankan)",
    );
  } else {
    ok("jalur pembayaran", `${orders} order pernah dibuat`);
  }

  // --- media: objek nyata, bukan baris DB ----------------------------------
  // Baris `media` yang ada TIDAK membuktikan objeknya ada: pada driver `local`
  // tanpa volume ter-mount, unggah "berhasil" ke lapisan container yang dibuang
  // tiap deploy. Yang membuktikan hanya mengambil objeknya lewat domain sendiri.
  const media = await pilih(
    "media?select=storage_path&order=created_at.desc&limit=1",
  );
  if (!media || media.length === 0) {
    lewat("objek media", "belum ada baris media untuk diuji");
  } else {
    // Lewat basis yang DILAPORKAN HEALTH, bukan `<app>/media/` yang dipaku:
    // begitu driver pindah ke R2, rute `/media` menjawab 404 untuk semua
    // permintaan dan probe yang dipaku akan melaporkan GAGAL pada migrasi yang
    // justru 100% benar. Basis dari health adalah host yang sungguh dipakai
    // tamu. Bila health tak melaporkannya (image lama), jatuh ke bentuk lama.
    const basis = basisMedia || `${app}/media`;
    const objek = `${media[0].storage_path}/1600.webp`;
    const r = await ambil(`${basis}/${objek}`);
    if (
      r.status === 200 &&
      (r.headers.get("content-type") ?? "").includes("image/")
    ) {
      ok(
        "objek media tersaji",
        `200 ${r.headers.get("content-type")} dari ${basis}`,
      );
    } else {
      gagal(
        "objek media tersaji",
        `status ${r.status || r.galat} — volume tak ter-mount, atau NEXT_PUBLIC_MEDIA_URL salah`,
      );
    }
  }

  // --- halaman publik + ISR -------------------------------------------------
  const aktif = await pilih("invitations?select=slug&status=eq.active&limit=1");
  if (!aktif || aktif.length === 0) {
    lewat(
      "halaman publik & ISR",
      "belum ada undangan `active` — ISR dan monitor kedua belum bisa diuji",
    );
  } else {
    const slug = aktif[0].slug;
    const a = await ambil(`${app}/${slug}`);
    const b = await ambil(`${app}/${slug}`);
    const cacheB = b.headers.get("x-nextjs-cache");
    if (a.status !== 200) {
      gagal(`/${slug}`, `status ${a.status || a.galat}`);
    } else if (cacheB === "HIT" || cacheB === "STALE") {
      ok(`ISR /${slug}`, `x-nextjs-cache=${cacheB}`);
    } else {
      warn(
        `ISR /${slug}`,
        `x-nextjs-cache=${cacheB ?? "(tak ada)"} — bila direktori cache tak writable, Next render per-request secara SENYAP`,
      );
    }
  }
}

// === main ===================================================================

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    [
      "pnpm ops:verify [--url=https://merriva.id]",
      "",
      "Memeriksa produksi: situs, bundel klien (build-arg), DNS, konfigurasi Auth",
      "Supabase, dan data (cron, isi awal, objek media, ISR).",
      "",
      "Kunci dibaca dari .env.production.local / .env.local dan .mcp.json, dan",
      "TIDAK PERNAH dicetak. Berkas lokal hanya sumber KUNCI — bukan sumber",
      "kebenaran tentang apa yang terpasang di produksi.",
      "",
      "Endpoint /api/cron/* sengaja TIDAK dipanggil: memanggilnya berarti",
      "menjalankan job-nya (membatalkan order, mengirim email, menghapus data).",
    ].join("\n"),
  );
  process.exit(0);
}

const app = (
  argv.map((a) => /^--url=(.+)$/.exec(a)?.[1]).find(Boolean) ??
  "https://merriva.id"
).replace(/\/$/, "");

const env = bacaEnvLokal();
const mcp = bacaMcp();
const token = process.env.SUPABASE_ACCESS_TOKEN ?? mcp.token;
const ref =
  mcp.ref ??
  /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  )?.[1] ??
  null;

console.log(`ops:verify — target ${app}`);

const basisMedia = await periksaSitus(app);
await periksaBundel(app);
await periksaDns(app);
await periksaAuth(token, ref);
await periksaData(env, app, basisMedia);

// --- Ringkasan --------------------------------------------------------------

const n = (t) => hasil.filter((h) => h.tingkat === t).length;
console.log(`\n${"=".repeat(60)}`);
console.log(
  `ok ${n("ok")} · GAGAL ${n("gagal")} · perhatian ${n("warn")} · dilewati ${n("lewat")}`,
);

if (n("gagal") > 0) {
  console.log("\nGAGAL:");
  for (const h of hasil.filter((x) => x.tingkat === "gagal")) {
    console.log(`  · [${h.bagian}] ${h.judul}`);
  }
}
if (n("lewat") > 0) {
  // "Dilewati" bukan "aman". Butir yang tak bisa diperiksa adalah butir yang
  // tak diketahui, dan itu harus terlihat — bukan lenyap dari laporan.
  console.log("\nTIDAK DIPERIKSA (bukan berarti aman):");
  for (const h of hasil.filter((x) => x.tingkat === "lewat")) {
    console.log(`  · [${h.bagian}] ${h.judul}`);
  }
}

process.exit(n("gagal") > 0 ? 1 : 0);
