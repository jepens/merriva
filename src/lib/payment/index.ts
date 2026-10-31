import { BinderPayGateway } from "./binderpay";
import { PakasirGateway } from "./pakasir";
import type { PaymentGateway } from "./types";

/**
 * Ambil gateway pembayaran aktif. Kredensial hanya server.
 *
 * BinderPay menggantikan Pakasir (DECISIONS #99) dan terpilih begitu
 * `BINDERPAY_PARTNER_ID` terisi. Sampai itu Pakasir tetap jalan, supaya tak ada
 * jendela waktu tanpa jalur bayar; Pakasir dihapus sesudah BinderPay terbukti
 * di produksi (keputusan pemilik 27 Okt 2026).
 */
export function getPaymentGateway(): PaymentGateway {
  const partnerId = process.env.BINDERPAY_PARTNER_ID;
  if (partnerId) {
    const baseUrl = (process.env.BINDERPAY_BASE_URL ?? "").replace(/\/+$/, "");
    const kunci = process.env.BINDERPAY_PRIVATE_KEY_B64;
    if (!baseUrl || !kunci) {
      throw new Error(
        "BINDERPAY_BASE_URL / BINDERPAY_PRIVATE_KEY_B64 belum di-set.",
      );
    }
    // Padanan penjaga `is_sandbox` Pakasir: Payment Simulator sandbox bisa
    // "melunasi" transaksi mana pun, jadi host sandbox tak boleh dipakai
    // produksi — salah tempel env di Easypanel = layanan gratis untuk siapa pun
    // yang punya akses dashboard sandbox.
    if (process.env.NODE_ENV === "production" && /sandbox/i.test(baseUrl)) {
      throw new Error("BINDERPAY_BASE_URL sandbox dipakai di produksi.");
    }
    return new BinderPayGateway({
      partnerId,
      baseUrl,
      kunciPrivatPem: Buffer.from(kunci, "base64").toString("utf8"),
    });
  }
  const projectSlug = process.env.PAKASIR_PROJECT_SLUG;
  if (!projectSlug) {
    throw new Error("PAKASIR_PROJECT_SLUG belum di-set.");
  }
  return new PakasirGateway(projectSlug, process.env.PAKASIR_API_KEY);
}

export type {
  CreatePaymentLinkInput,
  PaymentGateway,
  PaymentStatus,
  PaymentVerification,
} from "./types";
