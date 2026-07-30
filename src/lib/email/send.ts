import "server-only";

import { Resend } from "resend";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Cegah kirim ganda saat terpicu dari beberapa jalur (24 jam). Mis. `receipt/MRV-…`. */
  idempotencyKey: string;
}

export type SendEmailResult =
  | { status: "sent"; id: string | null }
  | { status: "skipped" } // RESEND_API_KEY tak di-set (dev/CI) → no-op
  | { status: "error"; message: string };

const DEFAULT_FROM = "Merriva <noreply@merriva.id>";

/**
 * Kirim satu email transaksional via Resend (M3.5). DEV-SAFE: tanpa
 * `RESEND_API_KEY` → no-op (`skipped`) agar dev/CI tanpa kredensial tak gagal.
 * SDK Resend mengembalikan `{data,error}` (TIDAK throw) → cek `error` eksplisit.
 * Kredensial hanya server, tak pernah di-log. `from` dari `EMAIL_FROM` (wajib
 * domain terverifikasi di Resend) atau default `merriva.id`.
 */
export async function sendTransactionalEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: "skipped" };

  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send(
    {
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    },
    { idempotencyKey: params.idempotencyKey },
  );
  if (error) return { status: "error", message: error.message };
  return { status: "sent", id: data?.id ?? null };
}
