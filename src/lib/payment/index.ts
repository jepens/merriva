import { PakasirGateway } from "./pakasir";
import type { PaymentGateway } from "./types";

/** Ambil gateway pembayaran aktif (Pakasir). */
export function getPaymentGateway(): PaymentGateway {
  const projectSlug = process.env.PAKASIR_PROJECT_SLUG;
  if (!projectSlug) {
    throw new Error("PAKASIR_PROJECT_SLUG belum di-set.");
  }
  return new PakasirGateway(projectSlug);
}

export type {
  CreatePaymentLinkInput,
  PaymentGateway,
  PaymentStatus,
  PaymentVerification,
} from "./types";
