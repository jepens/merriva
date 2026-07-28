import type {
  CreatePaymentLinkInput,
  PaymentGateway,
  PaymentStatus,
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

/**
 * Peta status Pakasir → status abstraksi. Pakasir memakai `"completed"` untuk
 * transaksi lunas (dok pakasir.com/p/docs); apa pun selain itu diperlakukan
 * BELUM lunas (fail-closed — jangan aktifkan atas status tak dikenal).
 */
export function mapPakasirStatus(status: unknown): PaymentStatus {
  return status === "completed" ? "paid" : "pending";
}

/**
 * Parse respons `transactiondetail` Pakasir (MURNI/teruji). Bentuk:
 * `{ "transaction": { amount, order_id, project, status, payment_method, completed_at } }`.
 * `null` bila bentuk tak dikenal → pemanggil memperlakukan sebagai gagal-verifikasi.
 */
export function parseTransactionDetail(
  data: unknown,
): PaymentVerification | null {
  const wrapper = data as { transaction?: unknown } | null;
  const t = wrapper?.transaction;
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  const orderCode = typeof o.order_id === "string" ? o.order_id : null;
  const amount = typeof o.amount === "number" ? o.amount : null;
  if (!orderCode || amount === null) return null;
  return {
    orderCode,
    amountIdr: amount,
    status: mapPakasirStatus(o.status),
    paymentMethod:
      typeof o.payment_method === "string" ? o.payment_method : null,
    paidAt: typeof o.completed_at === "string" ? o.completed_at : null,
  };
}

export class PakasirGateway implements PaymentGateway {
  constructor(
    private readonly projectSlug: string,
    private readonly apiKey?: string,
  ) {}

  createPaymentLink(input: CreatePaymentLinkInput): string {
    return buildPakasirPaymentUrl(this.projectSlug, input);
  }

  /**
   * Verifikasi OTORITATIF ke `GET /api/transactiondetail` (webhook Pakasir TANPA
   * signature — payload = sinyal, bukan bukti; SPEC §4.8). FAIL-CLOSED: HTTP non-OK
   * atau bentuk tak dikenal → THROW (pemanggil TIDAK mengaktifkan). `api_key`
   * hanya di server, tak pernah di-log.
   */
  async verifyTransaction(
    orderCode: string,
    amountIdr: number,
  ): Promise<PaymentVerification> {
    if (!this.apiKey) throw new Error("PAKASIR_API_KEY belum di-set.");
    const url = new URL(`${PAKASIR_BASE_URL}/api/transactiondetail`);
    url.searchParams.set("project", this.projectSlug);
    url.searchParams.set("amount", String(amountIdr));
    url.searchParams.set("order_id", orderCode);
    url.searchParams.set("api_key", this.apiKey);

    // Timeout wajib: tanpa ini fetch Node/undici bisa menggantung ~300s dan
    // memacetkan handler webhook (core uang) — timeout → throw → handler 503.
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // JANGAN sertakan URL (mengandung api_key) dalam pesan error.
      throw new Error(`Pakasir transactiondetail HTTP ${res.status}`);
    }
    const parsed = parseTransactionDetail(await res.json());
    if (!parsed) {
      throw new Error("Pakasir transactiondetail: bentuk respons tak dikenal");
    }
    // Defense-in-depth: respons OTORITATIF wajib menggemakan order_id yang diminta
    // (jangan terima transaksi lunas milik order lain).
    if (parsed.orderCode !== orderCode) {
      throw new Error("Pakasir transactiondetail: order_id tak cocok");
    }
    return parsed;
  }
}
