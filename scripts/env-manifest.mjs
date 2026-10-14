/**
 * MANIFEST environment variable + pemindai pemakaian di kode.
 *
 * Dipisah dari `check-env.mjs` supaya bisa DIUJI: `tests/unit/env-manifest.test.ts`
 * memastikan manifest ini tetap sejalan dengan `process.env.X` yang benar-benar
 * dibaca kode. Tanpa test itu, daftar ini akan membusuk persis seperti setiap
 * daftar manual lain di repo ini — dan variabel yang tak terdaftar adalah
 * variabel yang akan terlewat saat mengisi panel produksi.
 *
 * `kapan`:
 *   always   — dev DAN produksi
 *   prod     — hanya dituntut di produksi
 *   opsional — ada default, atau kegagalannya kosmetik
 *   r2       — hanya bila STORAGE_DRIVER=r2
 *   tooling  — skrip/test saja; aplikasi runtime tak pernah membacanya
 */
export const MANIFEST = [
  // --- Supabase -------------------------------------------------------------
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    kapan: "always",
    buildArg: true,
    rusak:
      "`next build` GAGAL (pra-render /, /harga, /tema membaca DB) dan di runtime middleware melewati refresh sesi",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    kapan: "always",
    buildArg: true,
    rusak: "sama dengan di atas; form login/daftar di browser rusak",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    kapan: "always",
    rahasia: true,
    rusak:
      "SETIAP halaman undangan /[slug] → 500 untuk SEMUA tamu; webhook, cron, panel admin mati; /api/health 503 → container restart loop",
  },
  // --- Aplikasi -------------------------------------------------------------
  {
    key: "NEXT_PUBLIC_APP_URL",
    kapan: "prod",
    buildArg: true,
    rusak:
      "DIAM TOTAL (default localhost:3000) tetapi hostname Turnstile diturunkan darinya → RSVP, ucapan, hadiah, sesi Momen, daftar akun, reset sandi semuanya ditolak, dengan pesan yang MENYESATKAN",
  },
  {
    key: "NEXT_PUBLIC_MEDIA_URL",
    kapan: "prod",
    buildArg: true,
    rusak:
      "GAGAL-KERAS runtime: setiap undangan berfoto/bermusik → 500. Sengaja TIDAK dicek saat build, jadi CI tetap hijau",
  },
  {
    key: "STORAGE_DRIVER",
    kapan: "opsional",
    rusak:
      "tak ada — kosong berarti `supabase`. Ejaan yang tak dikenali kini GAGAL-KERAS (dulu jatuh diam-diam ke Supabase)",
  },
  {
    key: "MEDIA_ROOT",
    kapan: "opsional",
    rusak:
      "tak ada — default `data/media` (= /app/data/media di container). Yang berbahaya bukan variabel ini melainkan LUPA MEMASANG VOLUME ke sana: unggah tetap berhasil, lalu hilang tiap deploy",
  },
  {
    key: "MOMEN_SESSION_SECRET",
    kapan: "prod",
    rahasia: true,
    gen: "openssl rand -hex 32",
    rusak:
      "melempar di produksi, tetapi LAZILY: app start normal, yang 500 hanya /[slug]/momen saat tamu di acara mengunggah foto",
  },
  // --- Pembayaran -----------------------------------------------------------
  {
    key: "PAKASIR_PROJECT_SLUG",
    kapan: "prod",
    rusak: "tombol bayar/checkout mati dengan galat generik",
  },
  {
    key: "PAKASIR_API_KEY",
    kapan: "prod",
    rahasia: true,
    rusak:
      "verifikasi otoritatif `transactiondetail` mati → webhook & cron TAK PERNAH bisa mengaktifkan order lunas",
  },
  {
    key: "PAKASIR_WEBHOOK_SECRET",
    kapan: "prod",
    rahasia: true,
    rusak:
      'webhook pembayaran TIDAK terautentikasi. Sejak API v2 Pakasir mengirim header `X-Secret` (lihat pakasir.com/p/webhook), jadi premis lama "webhook tanpa signature" sudah kedaluwarsa. Kosongnya SENGAJA tidak menolak webhook — menolak akan mematikan seluruh aktivasi pembayaran bila nilainya belum disalin saat deploy — tetapi dilaporkan ke Sentry sebagai `payment.webhook.secret-unset`. Nilainya dilihat/di-reset di bagian bawah halaman detail project Pakasir',
  },
  // --- Email ----------------------------------------------------------------
  {
    key: "RESEND_API_KEY",
    kapan: "prod",
    rahasia: true,
    rusak:
      "DIAM: keenam email (kuitansi, pengingat H-14, notis kedaluwarsa, pra-purge H-30/H-7, penangguhan, pencabutan) semuanya no-op tanpa satu pun galat",
  },
  {
    key: "EMAIL_FROM",
    kapan: "prod",
    rusak:
      "default `noreply@merriva.id`; bila domainnya tak terverifikasi di Resend, SEMUA kiriman ditolak 403",
  },
  // --- Anti-spam ------------------------------------------------------------
  {
    key: "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    kapan: "prod",
    buildArg: true,
    rusak:
      "widget tak dirender → tak ada token → verifikasi menolak semua form",
  },
  {
    key: "TURNSTILE_SECRET_KEY",
    kapan: "prod",
    rahasia: true,
    rusak:
      "GAGAL-TUTUP total di produksi: semua form ditolak, satu console.error per permintaan, NOL event Sentry",
  },
  // --- Cron -----------------------------------------------------------------
  {
    key: "CRON_SECRET",
    kapan: "prod",
    rahasia: true,
    gen: "openssl rand -hex 32",
    rusak:
      "keempat endpoint cron dijawab 401 tanpa galat terlihat → rekonsiliasi pembayaran DAN retensi UU PDP berhenti diam-diam",
  },
  // --- Monitoring -----------------------------------------------------------
  {
    key: "NEXT_PUBLIC_SENTRY_DSN",
    kapan: "prod",
    buildArg: true,
    rusak:
      "Sentry non-aktif — dan kegagalan SMTP yang sengaja senyap di sisi pengguna jadi tak terlihat sama sekali",
  },
  {
    key: "SENTRY_ORG",
    kapan: "opsional",
    rusak: "stack trace Sentry tetap terminifikasi",
  },
  { key: "SENTRY_PROJECT", kapan: "opsional", rusak: "sama" },
  {
    key: "SENTRY_AUTH_TOKEN",
    kapan: "opsional",
    rahasia: true,
    rusak: "sama (dipakai saat BUILD untuk unggah sourcemap)",
  },
  // --- Kondisional / tooling ------------------------------------------------
  { key: "R2_ACCOUNT_ID", kapan: "r2" },
  { key: "R2_ACCESS_KEY_ID", kapan: "r2", rahasia: true },
  { key: "R2_SECRET_ACCESS_KEY", kapan: "r2", rahasia: true },
  { key: "R2_BUCKET", kapan: "r2" },
  { key: "PEXELS_API_KEY", kapan: "tooling" },
  { key: "E2E_EMAIL", kapan: "tooling" },
  { key: "E2E_PASSWORD", kapan: "tooling" },
  { key: "E2E_INVITATION_ID", kapan: "tooling" },
  { key: "E2E_INVITATION_ID_WEBHOOK", kapan: "tooling" },
];

/**
 * Dibaca kode tetapi BUKAN konfigurasi pemilik — bawaan runtime, flag CI, atau
 * artefak pemindaian. Jangan dituntut ada di manifest.
 */
export const BAWAAN_RUNTIME = new Set([
  "NODE_ENV",
  "CI",
  "NEXT_PHASE",
  "NEXT_RUNTIME",
  "BASE_URL",
  "PW_CHANNEL",
  // `process.env.NEXT_PUBLIC_` muncul sebagai prefix dinamis di kode, bukan
  // sebagai nama variabel yang sebenarnya.
  "NEXT_PUBLIC_",
]);

/**
 * Buang KOMENTAR sebelum memindai.
 *
 * Tanpa ini, setiap berkas yang menulis `process.env.X` di dokumentasinya sendiri
 * — termasuk berkas ini dan test-nya — melaporkan variabel palsu bernama "X".
 * Memelihara daftar nama berkas yang dikecualikan sudah dicoba dan salah: ia
 * harus diperbarui setiap kali ada docstring baru, yaitu jenis daftar yang
 * persis dijaga test ini agar tak dipakai.
 *
 * Yang dibuang HANYA: blok `/* … *\/` dan baris yang DIMULAI dengan `//` atau
 * `*`. Sengaja tidak membuang `//` di tengah baris — itu akan memotong kode
 * setelah URL di dalam string, dan false NEGATIVE (variabel nyata terlewat)
 * jauh lebih berbahaya daripada false positive.
 */
function tanpaKomentar(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((ln) => {
      const t = ln.trim();
      return !t.startsWith("//") && !t.startsWith("*");
    })
    .join("\n");
}

const DIR_PINDAI = ["src", "scripts", "config", "tests"];
const BERKAS_PINDAI = ["next.config.ts", "playwright.config.ts"];

/**
 * Semua nama `process.env.X` yang benar-benar muncul di kode.
 * `fs`/`path` disuntik agar modul ini tetap bisa diimpor dari Vitest.
 */
export function envDipakaiKode({ readFileSync, readdirSync, statSync, join }) {
  const hit = new Set();
  const ambil = (src) => {
    for (const m of tanpaKomentar(src).matchAll(
      /process\.env\.([A-Z0-9_]+)/g,
    )) {
      hit.add(m[1]);
    }
  };
  const lihat = (dir) => {
    for (const e of readdirSync(dir)) {
      if (e === "node_modules" || e === ".next" || e === ".git") continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) lihat(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(e)) ambil(readFileSync(p, "utf8"));
    }
  };
  for (const d of DIR_PINDAI) {
    try {
      lihat(d);
    } catch {
      /* folder opsional */
    }
  }
  for (const f of BERKAS_PINDAI) {
    try {
      ambil(readFileSync(f, "utf8"));
    } catch {
      /* berkas opsional */
    }
  }
  return hit;
}
