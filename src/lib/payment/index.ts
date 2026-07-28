import { PakasirGateway } from "./pakasir";
import type { PaymentGateway } from "./types";

/** Ambil gateway pembayaran aktif (Pakasir). `api_key` (verifikasi) hanya server. */
export function getPaymentGateway(): PaymentGateway {
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
