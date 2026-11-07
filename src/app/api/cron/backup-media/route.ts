import { z } from "zod";

import { reportHandledError } from "@/lib/observability";
import { isAuthorizedCron } from "@/server/cron/auth";
import { recordCronRun } from "@/server/cron/record";

/**
 * Laporan backup media harian (DECISIONS #117).
 *
 * Backupnya sendiri jalan di HOST (`scripts/backup-media.sh`, dipasang
 * `scripts/pasang-backup-media.sh`) karena ia membaca volume Docker yang tak
 * terlihat dari dalam kontainer aplikasi. Route ini hanya MENCATAT hasilnya ke
 * `cron_runs` "backup-media", supaya backup yang gagal — atau yang berhenti
 * jalan sama sekali — tampil di panel /admin dan `pnpm ops:verify` seperti
 * keempat cron lain, alih-alih hanya sebagai baris di log VPS yang tak pernah
 * dibaca siapa pun.
 *
 * Tak ada pekerjaan lain di sini: tak ada akses storage, tak ada data pribadi.
 * Auth: `Authorization: Bearer <CRON_SECRET>` (sama dengan cron lain).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Laporan = z.strictObject({
  ok: z.boolean(),
  files: z.number().int().nonnegative().optional(),
  bytes: z.number().int().nonnegative().optional(),
  error: z.string().max(300).optional(),
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) return json({ ok: false }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false }, 400);
  }
  const parsed = Laporan.safeParse(body);
  if (!parsed.success) return json({ ok: false }, 400);

  const { ok, files = 0, bytes = 0, error } = parsed.data;
  if (ok) {
    await recordCronRun("backup-media", true, { files, bytes });
  } else {
    // Kegagalan AKTIF ke Sentry, sama dengan keempat route cron lain (DECISIONS
    // #60): panel tak mendorong notifikasi, sementara lifecycle bucket terus
    // menghapus snapshot sehat berumur > 30 hari walau yang baru tak pernah
    // masuk. Pesannya dari skrip — kode HTTP/S3 dan angka, tanpa rahasia.
    const err = new Error(error || "backup gagal tanpa pesan");
    reportHandledError(err, "cron.backup-media");
    await recordCronRun("backup-media", false, { files, bytes }, err);
  }
  return json({ ok: true }, 200);
}
