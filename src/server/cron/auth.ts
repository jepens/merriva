import { timingSafeEqual } from "node:crypto";

/**
 * Otorisasi endpoint cron (`/api/cron/*`, ARCHITECTURE §7). Scheduled job
 * (Easypanel) mengirim header `Authorization: Bearer <CRON_SECRET>`. Perbandingan
 * timing-safe agar tak membocorkan panjang/isi via waktu respons.
 *
 * FAIL-CLOSED: `CRON_SECRET` tak di-set → tolak (endpoint mutasi tak boleh
 * terbuka tanpa rahasia). Modul ini server-only secara implisit (`node:crypto`).
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual melempar bila panjang beda → bandingkan panjang dulu (aman:
  // panjang `expected` bukan rahasia, hanya secret-nya).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
