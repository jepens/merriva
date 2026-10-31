/**
 * Kontrak abstraksi payment gateway (SPEC §6.2 / DECISIONS #4).
 * Abstraksi dipertahankan agar bisa pindah Midtrans/Xendit dengan menyentuh satu modul.
 * Semua nominal = integer IDR (tanpa float).
 */

export interface CreatePaymentLinkInput {
  /** Dikirim sebagai `order_id` ke gateway (mis. `MRV-8F3K2`). */
  orderCode: string;
  /** Nominal integer IDR. */
  amountIdr: number;
  /** URL dashboard tujuan setelah bayar. */
  redirectUrl: string;
  /** Batasi ke QRIS saja bila true. */
  qrisOnly?: boolean;
}

export interface CreatedPaymentLink {
  /** URL yang dibuka pelanggan. */
  url: string;
  /**
   * Rujukan transaksi di sisi gateway, WAJIB disimpan ke `orders.txn_id`.
   *
   * Pakasir menyebutnya `txn_id`, dan sejak API v2 ia menjadi SATU-SATUNYA kunci
   * untuk memeriksa status maupun membatalkan transaksi — `order_id` dijawab 404.
   * Tanpa nilai ini tersimpan, order yang sudah dibayar tak bisa diverifikasi.
   *
   * Nama `txnId` dipilih sadar, meski "txn" adalah istilah Pakasir dan abstraksi
   * ini ada agar bisa pindah gateway. Alasannya: ketika jalur uang bermasalah,
   * yang menelusuri butuh nama kolom DB kita COCOK dengan nama di dashboard
   * Pakasir dan di payload webhook-nya. Nama netral (`providerRef`) membeli
   * portabilitas hipotetis dengan harga kebingungan nyata di jalur yang paling
   * mahal bila salah dibaca. Seam abstraksinya tetap antarmuka ini.
   */
  txnId: string;
  /**
   * String QRIS untuk dirender di halaman KITA — hanya gateway tanpa halaman
   * bayar hosted (BinderPay). Wajib disimpan bersama `txnId`: BinderPay menolak
   * membuat ulang QR untuk nomor order yang sama, jadi QR ini satu-satunya.
   */
  qrContent?: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

/**
 * Umur order `pending` sebelum cron meng-expire-nya (SPEC §4.8). Satu sumber
 * untuk cron DAN gateway yang menerbitkan alat bayar bertenggat (QR BinderPay):
 * alat bayar itu wajib mati LEBIH DULU, kalau tidak pelanggan bisa membayar
 * order yang sudah ditutup.
 */
export const UMUR_MAKS_ORDER_PENDING_MS = 24 * 60 * 60 * 1000;

export interface PaymentVerification {
  orderCode: string;
  amountIdr: number;
  status: PaymentStatus;
  /** `null` pada Pakasir v2 — API-nya tak lagi mengirim metode pembayaran. */
  paymentMethod: string | null;
  paidAt: string | null;
}

export interface PaymentGateway {
  /**
   * Buat/temukan transaksi di gateway lalu kembalikan URL bayar + `txnId`.
   *
   * ASINKRON sejak Pakasir v2 (AUDIT-2026-10-13): v1 cukup merakit URL di klien,
   * v2 menuntut panggilan API. Konsekuensi yang harus dipegang pemanggil:
   * operasi ini BISA GAGAL, jadi `txnId` wajib ditulis ke baris order SEBELUM
   * pelanggan diarahkan — jangan pernah mengarahkan ke link yang rujukannya
   * belum tersimpan.
   */
  createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatedPaymentLink>;
  /**
   * Verifikasi OTORITATIF ke API gateway — WAJIB sebelum aktivasi.
   * Payload webhook = SINYAL, bukan bukti (SPEC §4.8). Sejak v2 webhook Pakasir
   * membawa header `X-Secret` sehingga bisa diautentikasi, tetapi itu ADITIF:
   * bukti lunas tetap hanya dari pemanggilan ini.
   *
   * Operasi BACA saja. `txnId` wajib ada; yang hilang adalah galat yang
   * dilaporkan, bukan sesuatu yang ditambal dengan membuat transaksi baru.
   */
  verifyTransaction(
    orderCode: string,
    amountIdr: number,
    txnId?: string | null,
  ): Promise<PaymentVerification>;
  /**
   * Batalkan transaksi yang belum terbayar (cron expire order >24 jam, SPEC §4.8).
   * Best-effort: melempar bila API menolak. Panggil HANYA setelah verifikasi
   * memastikan order belum lunas (jangan batalkan yang sudah dibayar).
   */
  cancelTransaction(
    orderCode: string,
    amountIdr: number,
    txnId?: string | null,
  ): Promise<void>;
}
