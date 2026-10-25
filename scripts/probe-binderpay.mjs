/**
 * PROBE sandbox BinderPay — mengubah dokumentasi yang membantah dirinya sendiri
 * menjadi jawaban terukur.
 *
 *   node scripts/probe-binderpay.mjs [--nominal 10000] [--file .env.local]
 *
 * KENAPA BERKAS INI ADA. Dokumentasi BinderPay bertentangan di tiga tempat yang
 * menyentuh jalur uang (DECISIONS #99), dan ketiganya tak bisa ditebak dengan
 * aman:
 *
 *   #3 `contractId` — "ID kontrak merchant" ATAU "kode referensi request"?
 *      Ia kandidat `txnId` kita, yang WAJIB non-null dan menjadi satu-satunya
 *      kunci untuk memeriksa status kelak.
 *   #4 `feeAmount`  — contohnya menyebut 550 di satu tempat, 1000 di tempat
 *      lain, untuk transaksi yang sama.
 *   #5 `amount`     — `qr-mpm-generate` memberi 50550.00 (sudah termasuk fee),
 *      `qr-mpm-query` memberi 50000.00 (asli), callback memberi 35490.
 *
 * #5 menabrak `src/server/payment/reconcile.ts` yang membandingkan nominal
 * dengan kesetaraan KETAT. Bila `query` mengembalikan nominal ber-fee, penjaga
 * itu menolak SETIAP pembayaran yang sah; bila kita melonggarkannya lebih dulu
 * "untuk aman", ia berhenti berbunyi justru pada kasus yang ia ada untuk
 * menangkapnya — orang membayar Rp10.000 untuk paket Rp199.000.
 *
 * Satu kali jalan di sini menyelesaikan ketiganya.
 *
 * CATATAN SALINAN KODE. Penandatanganan di bawah MENYALIN
 * `src/lib/payment/binderpay-signature.ts` (modul kanonik, 21 test). Ia tak
 * bisa diimpor dari sini: berkasnya TypeScript tanpa runner, dan ber-`import
 * "server-only"` yang memang melempar di luar konteks server. Agar
 * penyimpangan tak pernah senyap, probe ini MENCETAK string-to-sign yang
 * dipakainya — bandingkan dengan modul kanonik bila hasilnya mengejutkan.
 *
 * Probe ini hanya MEMBUAT QR dan MEMBACA statusnya. Tak ada uang berpindah
 * sampai ada yang memindainya.
 */

import { createHash, createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const argv = process.argv.slice(2);

function opsi(nama, bawaan) {
  const i = argv.indexOf(nama);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
}

const BERKAS = opsi("--file", ".env.local");
const NOMINAL = Number(opsi("--nominal", "10000"));

// --- kredensial -------------------------------------------------------------

function bacaEnv(path) {
  let raw;
  try {
    raw = readFileSync(join(ROOT, path), "utf8");
  } catch {
    return null;
  }
  const out = new Map();
  for (const ln of raw.split("\n")) {
    const t = ln.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out.set(t.slice(0, i).trim(), t.slice(i + 1).trim());
  }
  return out;
}

const env = bacaEnv(BERKAS);
if (!env) {
  console.error(`✗ ${BERKAS} tak ditemukan.`);
  process.exit(1);
}

const WAJIB = [
  "BINDERPAY_PARTNER_ID",
  "BINDERPAY_BASE_URL",
  "BINDERPAY_PRIVATE_KEY_B64",
];
const kosong = WAJIB.filter((k) => !env.get(k));
if (kosong.length) {
  console.error(`✗ Belum terisi di ${BERKAS}:\n`);
  for (const k of kosong) console.error(`    ${k}=`);
  console.error(
    [
      "",
      "  Ambil dari dashboard BinderPay (pakai kredensial SANDBOX).",
      "  Kunci privat: PEM ter-base64 satu baris —",
      "      base64 -w0 binderpay-sandbox.pem",
      "  Keterangan tiap variabel ada di .env.example.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const PARTNER_ID = env.get("BINDERPAY_PARTNER_ID");
const BASE_URL = env.get("BINDERPAY_BASE_URL").replace(/\/+$/, "");
const KUNCI_PRIVAT = Buffer.from(
  env.get("BINDERPAY_PRIVATE_KEY_B64"),
  "base64",
).toString("utf8");

const tampakSandbox = /sandbox|sbox|dev|staging|uat/i.test(BASE_URL);
if (!tampakSandbox && !argv.includes("--produksi")) {
  console.error(
    [
      `✗ ${BASE_URL} tidak tampak seperti sandbox.`,
      "",
      "  Probe ini membuat transaksi sungguhan di host mana pun yang diberikan.",
      "  Bila memang disengaja, ulangi dengan --produksi.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

// --- tanda tangan (salinan modul kanonik — lihat docstring) -----------------

function hashBodi(bodi) {
  return createHash("sha256").update(bodi, "utf8").digest("hex");
}

function stringUntukDitandatangani({ metode, path, bodi, waktu }) {
  return `${metode.toUpperCase()}:${path}:${hashBodi(bodi)}:${waktu}`;
}

function tandaTangani(bahan) {
  const s = createSign("RSA-SHA256");
  s.update(stringUntukDitandatangani(bahan), "utf8");
  s.end();
  return s.sign(KUNCI_PRIVAT, "base64");
}

function stempelWaktuWib(ms) {
  const d = new Date(ms + 7 * 60 * 60_000);
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}` +
    `+07:00`
  );
}

// --- pemanggilan ------------------------------------------------------------

let urutan = 0;

async function panggil(path, muatan) {
  // Bodi di-hash PERSIS seperti yang dikirim — satu string, tak pernah
  // di-stringify dua kali. Ini sebab paling umum tanda tangan "seharusnya
  // benar" tetapi ditolak.
  const bodi = JSON.stringify(muatan);
  const waktu = stempelWaktuWib(Date.now());
  const bahan = { metode: "POST", path, bodi, waktu };
  const s2s = stringUntukDitandatangani(bahan);
  const externalId = `${Date.now()}${String(++urutan).padStart(3, "0")}`;

  console.log(`\n── POST ${path}`);
  console.log(`   string-to-sign : ${s2s}`);
  console.log(`   bodi           : ${bodi}`);

  let res, teks;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TIMESTAMP": waktu,
        "X-SIGNATURE": tandaTangani(bahan),
        "X-PARTNER-ID": PARTNER_ID,
        "X-EXTERNAL-ID": externalId,
        "CHANNEL-ID": "MERRIVA",
      },
      body: bodi,
      signal: AbortSignal.timeout(20_000),
    });
    teks = await res.text();
  } catch (err) {
    console.log(`   ✗ jaringan     : ${err.message}`);
    return null;
  }

  console.log(`   HTTP           : ${res.status}`);
  console.log(`   jawaban        : ${teks}`);

  try {
    return JSON.parse(teks);
  } catch {
    // Jawaban non-JSON sudah tercetak utuh di atas; itu pun ground truth.
    return null;
  }
}

// --- jalan ------------------------------------------------------------------

const ref = `PROBE-${Date.now()}`;

console.log(`BinderPay probe · ${BASE_URL}`);
console.log(
  `partner ${PARTNER_ID.slice(0, 6)}… · nominal Rp${NOMINAL} · ${ref}`,
);

// Bentuk bodi di bawah mengikuti SNAP QRIS MPM. Bila BinderPay menuntut field
// lain, jawabannya akan mengatakannya — dan pesan galat itu pun jawaban yang
// kita cari. Sesuaikan di sini lalu jalankan lagi.
const generate = await panggil("/v1.0/qr/qr-mpm-generate", {
  partnerReferenceNo: ref,
  amount: { value: `${NOMINAL}.00`, currency: "IDR" },
  merchantId: env.get("BINDERPAY_MERCHANT_ID") || undefined,
  terminalId: env.get("BINDERPAY_TERMINAL_ID") || undefined,
  validityPeriod: stempelWaktuWib(Date.now() + 60 * 60_000),
});

const refGateway =
  generate?.referenceNo ?? generate?.contractId ?? generate?.data?.referenceNo;

const query = refGateway
  ? await panggil("/v1.0/qr/qr-mpm-query", {
      originalPartnerReferenceNo: ref,
      originalReferenceNo: refGateway,
      serviceCode: "47",
    })
  : null;

// --- yang kita datang untuk mengetahuinya -----------------------------------

const nilai = (o, ...jalan) => {
  for (const j of jalan) {
    const v = j.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
    if (v !== undefined) return v;
  }
  return "—";
};

console.log(`\n${"─".repeat(68)}`);
console.log("JAWABAN ATAS TIGA PERTENTANGAN (DECISIONS #99)\n");

console.log(`  nominal yang KITA kirim         : ${NOMINAL}.00`);
console.log(
  `  #5 amount dari generate         : ${nilai(generate, "amount.value", "data.amount.value")}`,
);
console.log(
  `  #5 amount dari query            : ${nilai(query, "amount.value", "data.amount.value")}`,
);
console.log(
  `  #4 feeAmount generate / query   : ${nilai(generate, "feeAmount.value", "data.feeAmount.value")}` +
    ` / ${nilai(query, "feeAmount.value", "data.feeAmount.value")}`,
);
console.log(
  `  #3 contractId / referenceNo     : ${nilai(generate, "contractId", "data.contractId")}` +
    ` / ${nilai(generate, "referenceNo", "data.referenceNo")}`,
);

console.log(
  [
    "",
    "  Yang menentukan: apakah `amount` dari QUERY sama dengan yang kita kirim.",
    "  SAMA   → `reconcile.ts` tetap memakai kesetaraan ketat, tanpa perubahan.",
    "  BEDA   → nominal yang dibandingkan harus nominal ASLI, dan `orders`",
    "           menyimpan keduanya; gerbangnya TIDAK dilonggarkan.",
    "",
    "  Lalu: mana di antara contractId / referenceNo yang diterima query di atas?",
    "  Itulah yang menjadi `txnId` kita.",
    "",
  ].join("\n"),
);
