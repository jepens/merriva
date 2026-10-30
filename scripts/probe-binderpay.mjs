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
 * SUDAH TERJAWAB TANPA PROBE (riset 25 Okt 2026, lihat DECISIONS #99). Sumber
 * yang memutuskan bukan halaman dokumentasi melainkan SDK RESMI mereka
 * (`binderpay-nodejs`) — kode yang benar-benar memanggil server mereka:
 *   - Tanda tangan: empat komponen RSA-SHA256, TANPA access token. Itu cabang
 *     resmi SNAP "Asymmetric Signature without Get Token", bukan penyimpangan.
 *   - Tidak ada langkah ambil token. Tidak ada header Authorization.
 *   - `CHANNEL-ID` bernilai "QRIS". Nilai karangan ditolak dengan pesan generik
 *     yang mudah sekali salah dibaca sebagai tanda tangan salah.
 *   - `additionalInfo.isStatic` wajib boolean; `merchantId` tidak ada di tipe
 *     mereka; `qr-mpm-query` menuntut `additionalInfo.contractId` dan TIDAK
 *     menerima `originalReferenceNo`.
 * Versi pertama probe ini salah di kelima hal itu dan akan pulang "sukses"
 * tanpa menguji apa pun — lihat JALUR_KONTRAK di bawah.
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

async function panggil(path, muatan, externalIdPaksa) {
  // Bodi di-hash PERSIS seperti yang dikirim — satu string, tak pernah
  // di-stringify dua kali. Ini sebab paling umum tanda tangan "seharusnya
  // benar" tetapi ditolak.
  const bodi = JSON.stringify(muatan);
  const waktu = stempelWaktuWib(Date.now());
  const bahan = { metode: "POST", path, bodi, waktu };
  const s2s = stringUntukDitandatangani(bahan);
  const externalId =
    externalIdPaksa ?? `${Date.now()}${String(++urutan).padStart(3, "0")}`;

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
        // "QRIS", bukan nama merchant. Daftar nilainya tertutup, dan nilai
        // karangan ditolak dengan pesan generik yang SANGAT mudah salah dibaca
        // sebagai "tanda tangan salah".
        "CHANNEL-ID": "QRIS",
      },
      body: bodi,
      signal: AbortSignal.timeout(20_000),
    });
    teks = await res.text();
  } catch (err) {
    console.log(`   ✗ jaringan     : ${err.message}`);
    return null;
  }

  console.log(`   X-EXTERNAL-ID  : ${externalId}`);
  console.log(`   HTTP           : ${res.status}`);
  console.log(`   jawaban        : ${teks}`);

  // Stempel waktu IKUT ditandatangani, jadi jam yang menyimpang menolak SETIAP
  // panggilan dengan pesan yang terbaca persis seperti "tanda tangan salah".
  // Periksa ini SEBELUM menyalahkan kripto.
  const tanggalServer = res.headers.get("date");
  if (tanggalServer) {
    const selisih = Math.round((Date.parse(tanggalServer) - Date.now()) / 1000);
    const catatan =
      Math.abs(selisih) > 60 ? "  ← JAM MENYIMPANG, perbaiki dulu" : "";
    console.log(`   selisih jam    : ${selisih} dtk${catatan}`);
  }

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

const PATH_GENERATE = "/v1.0/qr/qr-mpm-generate";
const PATH_QUERY = "/v1.0/qr/qr-mpm-query";

// Bodi mengikuti `QrisGenerateParams` di SDK RESMI BinderPay, bukan contoh di
// halaman dokumentasinya. Tiga hal yang membedakannya dan ketiganya menggigit:
// `additionalInfo.isStatic` wajib dan harus BOOLEAN (SDK melempar keras
// tanpanya), `validityPeriod` wajib bila isStatic=false, dan `merchantId` TIDAK
// ADA di tipe mereka — ia field SNAP umum, bukan milik BinderPay.
const bodiGenerate = (referensi) => ({
  partnerReferenceNo: referensi, // pola ^[a-zA-Z0-9_-]{5,50}$
  amount: { value: `${NOMINAL}.00`, currency: "IDR" },
  validityPeriod: stempelWaktuWib(Date.now() + 60 * 60_000),
  additionalInfo: { isStatic: false },
});

const generate = await panggil(PATH_GENERATE, bodiGenerate(ref));

// `contractId` BERSARANG di `additionalInfo` menurut dokumen mereka. Dicoba
// berurutan, dan jalur yang terpakai DICETAK — versi pertama probe ini hanya
// membaca akar, sehingga nilainya `undefined`, panggilan query terlewat
// diam-diam, dan probe pulang "sukses" tanpa menguji apa pun.
const JALUR_KONTRAK = [
  ["additionalInfo.contractId", (o) => o?.additionalInfo?.contractId],
  ["contractId (akar)", (o) => o?.contractId],
  ["referenceNo (akar)", (o) => o?.referenceNo],
  [
    "data.additionalInfo.contractId",
    (o) => o?.data?.additionalInfo?.contractId,
  ],
];

function cariKontrak(jawaban) {
  for (const [nama, ambil] of JALUR_KONTRAK) {
    const v = ambil(jawaban);
    if (v !== undefined && v !== null) return { nilai: v, jalur: nama };
  }
  return { nilai: undefined, jalur: "(tak ditemukan)" };
}

const kontrak = cariKontrak(generate);

// Badan query menuntut KETIGANYA, dan `originalReferenceNo` BUKAN salah satunya
// — ia tak ada di tabel request mereka maupun di tipe SDK, meski tujuh PJP lain
// memakainya. `serviceCode` 47 merujuk transaksi ASAL (generate), bukan 51.
const bodiQuery = {
  originalPartnerReferenceNo: ref,
  serviceCode: "47",
  additionalInfo: { contractId: kontrak.nilai },
};

// R1 — halaman bayar kita mem-poll tiap ~4 detik. Bila query menegakkan
// keunikan X-EXTERNAL-ID per hari (galat 4094700), poll KEDUA langsung gagal
// dan poller harus membangkitkan id segar tiap panggilan. SDK vendor justru
// memakai id deterministik, jadi salah satu dari keduanya pasti keliru.
const idTetap = `probe-query-${Date.now()}`;
const query = kontrak.nilai
  ? await panggil(PATH_QUERY, bodiQuery, idTetap)
  : null;
const queryIdSama = kontrak.nilai
  ? await panggil(PATH_QUERY, bodiQuery, idTetap)
  : null;
const queryIdBaru = kontrak.nilai ? await panggil(PATH_QUERY, bodiQuery) : null;

// R2 — `contractId` per-transaksi, atau konstanta merchant? Ini memutuskan
// apakah skema kita pecah: `orders.txn_id` punya UNIQUE INDEX, jadi nilai
// konstan membuat order KEDUA gagal dan pelanggan tak bisa membayar sama sekali.
const refB = `${ref}-B`;
const generateB = await panggil(PATH_GENERATE, bodiGenerate(refB));
const kontrakB = cariKontrak(generateB);

// --- yang kita datang untuk mengetahuinya -----------------------------------

const nilai = (o, ...jalan) => {
  for (const j of jalan) {
    const v = j.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
    if (v !== undefined) return v;
  }
  return "—";
};

/**
 * EMVCo TLV: tiap elemen = tag(2) + panjang(2) + nilai. Tag 54 = Transaction
 * Amount, yaitu angka yang BENAR-BENAR ditagihkan ke pembayar — bukti paling
 * menentukan untuk pertentangan #5, dan terbaca tanpa seorang pun memindai QR.
 * Tag 55-57 = convenience fee; kehadirannya berarti model biaya ketiga yang tak
 * terbaca dari dokumen mana pun.
 */
function bacaTlv(qr) {
  const out = new Map();
  let i = 0;
  while (typeof qr === "string" && i + 4 <= qr.length) {
    const tag = qr.slice(i, i + 2);
    const len = Number(qr.slice(i + 2, i + 4));
    if (!Number.isInteger(len) || i + 4 + len > qr.length) break;
    out.set(tag, qr.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return out;
}

const qrContent = nilai(generate, "qrContent", "data.qrContent");
const tlv = bacaTlv(qrContent);
const tag54 = tlv.get("54") ?? "—";
const tagBiaya = ["55", "56", "57"].filter((t) => tlv.has(t));

// Dari `responseCode` (2xx SNAP), BUKAN dari "jawaban JSON terbaca": penolakan
// pun berbentuk JSON. Versi sebelumnya melaporkan 409 "Duplicate X-EXTERNAL-ID
// for today" sebagai "jawaban diterima" (jalan pertama, 30 Okt 2026).
const hasilHttp = (j) =>
  j && String(j.responseCode ?? "").startsWith("2")
    ? "diterima"
    : `DITOLAK${j?.responseCode ? ` (${j.responseCode})` : ""}`;

console.log(`\n${"─".repeat(68)}`);
console.log("JAWABAN ATAS PERTENTANGAN DOKUMENTASI (DECISIONS #99)\n");

console.log(`  nominal yang KITA kirim         : ${NOMINAL}.00`);
console.log(`  tag 54 di dalam QR (ditagihkan) : ${tag54}`);
if (!tlv.has("54")) {
  // Sandbox memberi QR TIRUAN: TLV-nya terpotong di tag 26, tanpa tag 54 & 63
  // (CRC). Nominal yang ditagihkan hanya terukur dari QR produksi.
  console.log(
    "    ↳ QR tak terbaca sebagai EMVCo utuh — ukur dari QR produksi",
  );
}
if (tagBiaya.length) {
  console.log(`  ⚠ tag biaya tambahan hadir      : ${tagBiaya.join(", ")}`);
}
console.log(
  `  amount generate / query         : ${nilai(generate, "amount.value", "data.amount.value")}` +
    ` / ${nilai(query, "amount.value", "data.amount.value")}`,
);
console.log(
  `  feeAmount generate / query      : ${nilai(generate, "feeAmount.value", "data.feeAmount.value")}` +
    ` / ${nilai(query, "feeAmount.value", "data.feeAmount.value")}`,
);
console.log(`  contractId ditemukan di         : ${kontrak.jalur}`);
console.log(`  contractId A / B                : ${kontrak.nilai ?? "—"}`);
console.log(`                                    ${kontrakB.nilai ?? "—"}`);
console.log(
  `  query: id sama ulang / id baru  : ${hasilHttp(queryIdSama)} / ${hasilHttp(queryIdBaru)}`,
);

console.log(
  [
    "",
    "  CARA MEMBACANYA",
    "",
    "  tag 54 == nominal kita     → biaya TIDAK dibebankan ke pembayar;",
    "                               `amount` hampir pasti nominal pokok.",
    "  tag 54 == nominal + fee    → biaya dilipat ke tagihan; driver harus",
    "                               menormalkan ke pokok sebelum dibandingkan.",
    "  tag 55/56/57 muncul        → model biaya ketiga. BERHENTI, rancang ulang.",
    "",
    "  contractId A == B          → KONSTANTA merchant. JANGAN pernah ditulis ke",
    "                               orders.txn_id: unique index-nya akan menolak",
    "                               order kedua dan pelanggan tak bisa membayar.",
    "  contractId A != B          → per-transaksi; simpan per-order.",
    "",
    "  id sama DITOLAK, id baru OK → poller WAJIB membangkitkan X-EXTERNAL-ID",
    "                               segar tiap panggilan (jangan tiru SDK vendor).",
    "",
    "  Gerbang nominal di reconcile.ts TETAP kesetaraan ketat apa pun hasilnya.",
    "  Yang berubah hanya nominal mana yang diisikan driver ke perbandingan itu.",
    "",
  ].join("\n"),
);
