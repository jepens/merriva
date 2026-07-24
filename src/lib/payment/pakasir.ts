import type {
  CreatePaymentLinkInput,
  PaymentGateway,
  PaymentVerification,
} from "./types";

const PAKASIR_BASE_URL = "https://app.pakasir.com";

/**
 * Pure function pembangun URL payment link Pakasir (bisa diuji tanpa jaringan).
 * Bentuk: `{base}/pay/{project_slug}/{amount}?order_id=..&redirect=..[&qris_only=1]`.
 */
export function buildPakasirPaymentUrl(
  projectSlug: string,
  input: CreatePaymentLinkInput,
): string {
  const params = new URLSearchParams({
    order_id: input.orderCode,
    redirect: input.redirectUrl,
  });
  if (input.qrisOnly) params.set("qris_only", "1");
  return `${PAKASIR_BASE_URL}/pay/${projectSlug}/${input.amountIdr}?${params.toString()}`;
}

export class PakasirGateway implements PaymentGateway {
  constructor(private readonly projectSlug: string) {}

  createPaymentLink(input: CreatePaymentLinkInput): string {
    return buildPakasirPaymentUrl(this.projectSlug, input);
  }

  verifyTransaction(
    _orderCode: string,
    _amountIdr: number,
  ): Promise<PaymentVerification> {
    // M3: GET /api/transactiondetail + hanya kembalikan `paid` bila API mengonfirmasi lunas.
    throw new Error(
      "PakasirGateway.verifyTransaction belum diimplementasikan (M3).",
    );
  }
}
