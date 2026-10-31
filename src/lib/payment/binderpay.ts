import { randomInt } from "node:crypto";

import { stempelWaktuWib, tandaTangani } from "./binderpay-signature";
import {
  UMUR_MAKS_ORDER_PENDING_MS,
  type CreatePaymentLinkInput,
  type CreatedPaymentLink,
  type PaymentGateway,
  type PaymentStatus,
  type PaymentVerification,
} from "./types";

/**
 * Integrasi BinderPay — API SNAP, kanal QRIS saja (DECISIONS #99).
 *
 * Tak satu pun bentuk di bawah berasal dari dokumentasi saja: dokumen BinderPay
 * membantah dirinya sendiri di lima tempat, jadi semuanya DIUKUR terhadap
 * sandbox (scripts/probe-binderpay.mjs, 30–31 Okt 2026). Yang menentukan bentuk
 * modul ini:
 *
 *  * **Tak ada halaman bayar hosted.** `qr-mpm-generate` mengembalikan string QR
 *    (`qrContent`); `qrUrl` hanya gambar SVG tanpa nominal dan tanpa tombol
 *    kembali. QR dirender di halaman KITA, jadi "link bayar" adalah
 *    `redirectUrl` itu sendiri, dan `qrContent` wajib disimpan bersama order.
 *  * **Nomor order yang sama tak boleh dikirim dua kali.** Generate ulang dengan
 *    `partnerReferenceNo` yang sama dijawab HTTP 500 `5004700` — bukan
 *    find-or-create seperti Pakasir, dan 500-nya tak akan sembuh dengan dicoba
 *    ulang. QR karena itu berlaku selama ordernya hidup dan tak pernah dibuat
 *    ulang.
 *  * **Pembayar ditagih pokok + fee** (dashboard: Jumlah 10.000, Biaya 70, Total
 *    10.070; saldo masuk 10.000). Pemilik memutuskan fee ditanggung merchant
 *    (SPEC §4.8), jadi yang dikirim adalah POKOK yang dikurangi — lihat
 *    `pokokUntukHarga`.
 *  * **`qr-mpm-query` menggemakan nomor order apa pun yang dikirim** — rujukan
 *    yang tak ada dijawab 200 "Initiated" bernominal 0, dan pasangan
 *    nomor/`contractId` yang tak serasi tetap dijawab dengan transaksi yang
 *    cocok salah satunya. Gema BUKAN bukti identitas. Yang menjaga adalah
 *    pasangan nomor + `contractId` yang selalu diambil dari baris order kita,
 *    ditambah gerbang nominal.
 *  * **`X-EXTERNAL-ID` berulang di hari yang sama ditolak** (409 `4095100`),
 *    sementara halaman bayar mem-poll tiap beberapa detik — id dibuat segar
 *    di SETIAP panggilan.
 */

const TIMEOUT_MS = 8000;
const PATH_GENERATE = "/v1.0/qr/qr-mpm-generate";
const PATH_QUERY = "/v1.0/qr/qr-mpm-query";
const PATH_CANCEL = "/v1.0/qr/qr-mpm-cancel";
/** Minimum nominal QRIS BinderPay (tabel request `qr-mpm-generate`). */
const NOMINAL_MINIMUM = 100;

/**
 * Masa berlaku QR: SATU JAM LEBIH PENDEK dari umur order pending. QR harus
 * sudah mati sebelum cron bisa meng-expire ordernya, kalau tidak pelanggan bisa
 * membayar order yang sudah ditutup — uang masuk, layanan tidak. Diturunkan
 * dari konstanta cron, bukan diulang, supaya keduanya tak bisa bergeser sendiri.
 */
export const MASA_BERLAKU_QR_MS = UMUR_MAKS_ORDER_PENDING_MS - 60 * 60_000;

/**
 * Galat BinderPay dengan klasifikasi retry — semantiknya sama persis dengan
 * `PakasirError` (dibaca `reconcile.ts` untuk memisahkan "coba lagi" dari
 * "kontrak putus").
 */
export class BinderPayError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "BinderPayError";
  }
}

/**
 * `transient` hanya dibaca jalur VERIFIKASI (reconcile.ts) — generate dan
 * cancel tak pernah diulang otomatis, jadi kode yang khas keduanya tak ikut
 * menentukan: 500 `5004700` (nomor order ganda di generate) dan 409 `4097700`
 * (cancel atas transaksi yang SUDAH dibayar).
 */
function klasifikasi(status: number): boolean {
  if (status === 429) return true; // rate limit
  // Di query, 409 hanya untuk X-EXTERNAL-ID berulang (`4095100`); id dibuat
  // segar tiap panggilan, jadi percobaan berikutnya memakai id lain.
  if (status === 409) return true;
  if (status >= 500) return true;
  return false; // 400 (bodi), 401 (tanda tangan/kunci), 404
}

/**
 * Fee QRIS BinderPay untuk satu pokok: 0,7% dibulatkan BIASA ke rupiah
 * (diukur: 10.071 → 70 karena 70,497; 10.072 → 71 karena 70,504). Aritmetika
 * bulat — tanpa float di jalur uang.
 */
export function feeQris(pokok: number): number {
  return Math.floor((7 * pokok + 500) / 1000);
}

/**
 * Pokok yang dikirim ke BinderPay agar pelanggan membayar SEHARGA katalog
 * (fee ditanggung merchant, SPEC §4.8): nilai TERBESAR dengan
 * `pokok + feeQris(pokok) ≤ harga`.
 *
 * Karena pembulatan, sebagian total terlewati, jadi untuk harga tertentu tak
 * ada pokok yang pas — aturan "≤" membuat pelanggan paling buruk membayar Rp1
 * LEBIH MURAH, tak pernah lebih mahal. Keenam harga katalog per 31 Okt 2026
 * pas persis (199.000 → 197.617 + 1.383).
 */
export function pokokUntukHarga(harga: number): number {
  let p = Math.floor((harga * 1000) / 1007);
  while (p + 1 + feeQris(p + 1) <= harga) p += 1;
  while (p > 0 && p + feeQris(p) > harga) p -= 1;
  return p;
}

/** `latestTransactionStatus` SNAP → status abstraksi. HANYA `00` yang lunas. */
export function mapStatusBinderPay(kode: unknown): PaymentStatus {
  if (kode === "00") return "paid";
  if (kode === "05") return "expired"; // Canceled
  if (kode === "04" || kode === "06") return "failed"; // Refunded / Failed
  // 01 Initiated, 02 Paying, 03 Pending, 07 Not found, dan yang tak dikenal.
  return "pending";
}

/** `"10000.00"` → 10000. `null` untuk bentuk lain, termasuk pecahan sen. */
export function rupiahDariNilai(nilai: unknown): number | null {
  if (typeof nilai !== "string" || !/^\d+(\.00?)?$/.test(nilai)) return null;
  return Number(nilai.split(".")[0]);
}

function teks(nilai: unknown): string | null {
  return typeof nilai === "string" && nilai ? nilai : null;
}

function objek(nilai: unknown): Record<string, unknown> {
  return nilai && typeof nilai === "object"
    ? (nilai as Record<string, unknown>)
    : {};
}

/** Numerik, unik praktis per panggilan: ms + 6 digit acak. */
function idEksternal(): string {
  return `${Date.now()}${String(randomInt(1_000_000)).padStart(6, "0")}`;
}

export interface KonfigurasiBinderPay {
  partnerId: string;
  /** Tanpa garis miring akhir. */
  baseUrl: string;
  /** PEM kunci privat KITA (penanda tangan request). */
  kunciPrivatPem: string;
}

export class BinderPayGateway implements PaymentGateway {
  constructor(private readonly k: KonfigurasiBinderPay) {}

  /** Semua panggilan SNAP lewat satu pintu: tanda tangan, header, timeout, galat. */
  private async call(
    path: string,
    muatan: unknown,
  ): Promise<Record<string, unknown>> {
    // Bodi ditandatangani PERSIS seperti yang dikirim — satu string, tak pernah
    // di-stringify dua kali (lihat binderpay-signature.ts).
    const bodi = JSON.stringify(muatan);
    const waktu = stempelWaktuWib(Date.now());
    const res = await fetch(`${this.k.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TIMESTAMP": waktu,
        "X-SIGNATURE": tandaTangani(
          { metode: "POST", path, bodi, waktu },
          this.k.kunciPrivatPem,
        ),
        "X-PARTNER-ID": this.k.partnerId,
        "X-EXTERNAL-ID": idEksternal(),
        // Daftar tertutup; nilai karangan ditolak dengan pesan generik yang
        // terbaca seperti "tanda tangan salah".
        "CHANNEL-ID": "QRIS",
      },
      body: bodi,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const isi = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = objek(JSON.parse(isi));
    } catch {
      data = null;
    }
    const kode = teks(data?.responseCode);
    // Sukses SNAP = responseCode 2xx. Penolakan pun berbentuk JSON, jadi
    // "terbaca" tidak sama dengan "diterima".
    if (!res.ok || !kode?.startsWith("2")) {
      throw new BinderPayError(
        `BinderPay ${path} HTTP ${res.status} ${kode ?? "tanpa-kode"}: ${teks(data?.responseMessage) ?? "tanpa pesan"}`,
        res.status,
        // Tanpa kode SNAP, jawaban itu bukan penolakan BinderPay (halaman galat
        // proxy, bodi terpotong) — transien, termasuk yang ber-HTTP 200.
        kode === null ? true : klasifikasi(res.status),
      );
    }
    return data ?? {};
  }

  /**
   * Terbitkan QR dinamis dan kembalikan halaman kita sebagai "link bayar".
   *
   * JANGAN dipanggil dua kali untuk order yang sama (BinderPay menjawab 500).
   * Pemanggil memakai ulang QR yang tersimpan; order tanpa `txn_id` tak dipakai
   * ulang (cron meng-expire-nya — DECISIONS #101).
   */
  async createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<CreatedPaymentLink> {
    const pokok = pokokUntukHarga(input.amountIdr);
    if (pokok < NOMINAL_MINIMUM) {
      throw new BinderPayError(
        `BinderPay: nominal ${input.amountIdr} di bawah minimum QRIS`,
        null,
        false,
      );
    }
    const data = await this.call(PATH_GENERATE, {
      partnerReferenceNo: input.orderCode,
      amount: { value: `${pokok}.00`, currency: "IDR" },
      validityPeriod: stempelWaktuWib(Date.now() + MASA_BERLAKU_QR_MS),
      additionalInfo: { isStatic: false },
    });

    const qrContent = teks(data.qrContent);
    const contractId = teks(objek(data.additionalInfo).contractId);
    if (!qrContent || !contractId) {
      throw new BinderPayError(
        "BinderPay qr-mpm-generate: bentuk respons tak dikenal",
        null,
        false,
      );
    }
    // Di generate, gema nomor order BERMAKNA: ia transaksi yang baru dibuat.
    if (teks(data.partnerReferenceNo) !== input.orderCode) {
      throw new BinderPayError(
        "BinderPay qr-mpm-generate: partnerReferenceNo tak cocok",
        null,
        false,
      );
    }
    const tagihan = rupiahDariNilai(objek(data.amount).value);
    const fee = rupiahDariNilai(objek(data.feeAmount).value);
    if (tagihan === null || fee === null || tagihan - fee !== pokok) {
      throw new BinderPayError(
        `BinderPay qr-mpm-generate: pokok tak cocok (dikirim ${pokok}, tagihan ${tagihan}, fee ${fee})`,
        null,
        false,
      );
    }
    // Janji SPEC §4.8 ke pelanggan. Bila tarif BinderPay naik, QR ini MELEBIHI
    // harga katalog — lebih baik checkout gagal dan terlaporkan daripada
    // pelanggan ditagih lebih tanpa pemberitahuan. QR-nya mati sendiri.
    if (tagihan > input.amountIdr) {
      throw new BinderPayError(
        `BinderPay: tagihan ${tagihan} melebihi harga ${input.amountIdr} — tarif fee berubah?`,
        null,
        false,
      );
    }
    return { url: input.redirectUrl, txnId: contractId, qrContent };
  }

  /**
   * Verifikasi OTORITATIF lewat `qr-mpm-query` — WAJIB sebelum aktivasi.
   * Operasi BACA saja; tak pernah membuat transaksi (jalur ini dipicu webhook
   * publik).
   *
   * NOMINAL: BinderPay melaporkan POKOK, sedangkan `orders.amount_idr` menyimpan
   * HARGA yang dibayar pelanggan. Pokok diterjemahkan ke harga HANYA bila ia
   * persis pokok yang kita kirim untuk harga itu — pembandingan yang tak
   * bergantung pada aturan pembulatan fee mereka. Selain itu yang dilaporkan
   * adalah yang benar-benar dibayar, dan gerbang `reconcile.ts` menolaknya.
   */
  async verifyTransaction(
    orderCode: string,
    amountIdr: number,
    txnId?: string | null,
  ): Promise<PaymentVerification> {
    if (!txnId) {
      throw new BinderPayError(
        `BinderPay: order ${orderCode} tak punya txn_id — tak bisa diverifikasi`,
        null,
        false,
      );
    }
    const data = await this.call(PATH_QUERY, {
      originalPartnerReferenceNo: orderCode,
      // 47 = layanan transaksi ASAL (generate), bukan 51 (query).
      serviceCode: "47",
      additionalInfo: { contractId: txnId },
    });
    const pokok = rupiahDariNilai(objek(data.amount).value);
    if (pokok === null) {
      throw new BinderPayError(
        "BinderPay qr-mpm-query: bentuk respons tak dikenal",
        null,
        true,
      );
    }
    const fee = rupiahDariNilai(objek(data.feeAmount).value) ?? 0;
    return {
      orderCode,
      amountIdr: pokok === pokokUntukHarga(amountIdr) ? amountIdr : pokok + fee,
      status: mapStatusBinderPay(data.latestTransactionStatus),
      paymentMethod: "qris",
      paidAt: teks(data.paidTime),
    };
  }

  /**
   * Batalkan QR yang belum dibayar (`qr-mpm-cancel`) — dipanggil cron SETELAH
   * order di-expire. Diukur di sandbox (31 Okt 2026): idempoten (pembatalan
   * kedua dijawab sukses yang sama), berhasil juga atas QR yang lewat tenggat,
   * query sesudahnya `05` Canceled; rujukan tak dikenal 404 `4047701`; yang
   * SUDAH dibayar 409 `4097700` dan tetap lunas — galat itu sampai ke laporan
   * `payment.cancel` cron lengkap dengan pesannya.
   *
   * Lapis KEDUA: QR yang lewat tenggat tetap dijawab query `01` Initiated (tak
   * pernah berubah sendiri), jadi pembatalan inilah yang menutupnya secara
   * eksplisit.
   */
  async cancelTransaction(
    orderCode: string,
    _amountIdr: number,
    txnId?: string | null,
  ): Promise<void> {
    if (!txnId) {
      throw new BinderPayError(
        `BinderPay: order ${orderCode} tak punya txn_id — tak bisa dibatalkan`,
        null,
        false,
      );
    }
    await this.call(PATH_CANCEL, {
      originalPartnerReferenceNo: orderCode,
      reason: "Order kedaluwarsa",
      additionalInfo: { contractId: txnId },
    });
  }
}
