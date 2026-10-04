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
  /**
   * `code` = `name` dari `ErrorResponse` Resend: enum TERTUTUP
   * (`validation_error`, `invalid_api_key`, `rate_limit_exceeded`,
   * `daily_quota_exceeded`, `application_error`, ...) — aman untuk telemetri.
   * `statusCode` ikut karena `application_error` lahir dari tiga jalur runtime
   * berbeda yang HANYA dibedakan olehnya (jaringan tak tercapai = null, 5xx
   * ber-body non-JSON = status HTTP-nya, kegagalan parse lain); tanpa itu
   * ketiganya menyatu jadi satu isu raksasa di Sentry.
   *
   * `message` SENGAJA TIDAK DIBAWA. Pesan `validation_error` Resend rutin
   * mengutip kembali isi field `to`, yaitu alamat email pelanggan, dan
   * `scrubSentryEvent` hanya meredaksi token tamu — ia tak mengenal alamat
   * email. Komentar bukan gerbang: menghilangkan field-nya yang menjadi
   * gerbang. Untuk diagnosis dev, SDK Resend sendiri sudah `console.error`
   * seluruh objek galat di luar production.
   */
  | { status: "error"; code: string; statusCode: number | null };

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
  if (error) {
    return {
      status: "error",
      code: error.name ?? "unknown",
      statusCode: error.statusCode ?? null,
    };
  }
  return { status: "sent", id: data?.id ?? null };
}
