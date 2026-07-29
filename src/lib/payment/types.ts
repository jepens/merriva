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

export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

export interface PaymentVerification {
  orderCode: string;
  amountIdr: number;
  status: PaymentStatus;
  paymentMethod: string | null;
  paidAt: string | null;
}

export interface PaymentGateway {
  /** Bangun URL payment link untuk redirect klien. */
  createPaymentLink(input: CreatePaymentLinkInput): string;
  /**
   * Verifikasi OTORITATIF ke API gateway — WAJIB sebelum aktivasi.
   * Webhook = sinyal, bukan bukti (webhook Pakasir tanpa signature). Lihat SPEC §4.8.
   */
  verifyTransaction(
    orderCode: string,
    amountIdr: number,
  ): Promise<PaymentVerification>;
  /**
   * Batalkan payment link yang belum terbayar (cron expire order >24 jam, SPEC §4.8).
   * Best-effort: melempar bila API menolak. Panggil HANYA setelah verifikasi
   * memastikan order belum lunas (jangan batalkan yang sudah dibayar).
   */
  cancelTransaction(orderCode: string, amountIdr: number): Promise<void>;
}
