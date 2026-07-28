import { z } from "zod";

/**
 * Payload webhook Pakasir (SPEC §4.8): `{amount, order_id, project, status,
 * payment_method, completed_at}`. Webhook TANPA signature → payload hanya SINYAL;
 * bukti lunas diambil dari verifikasi `transactiondetail` (lihat handler).
 */
export const pakasirWebhookSchema = z.object({
  amount: z.number().int().nonnegative(),
  order_id: z.string().min(1),
  project: z.string().min(1),
  status: z.string(),
  payment_method: z.string().nullish(),
  completed_at: z.string().nullish(),
});

export type PakasirWebhookPayload = z.infer<typeof pakasirWebhookSchema>;
