import { revalidatePath } from "next/cache";

import { reportHandledError } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordCronRun } from "@/server/cron/record";
import { isAuthorizedCron } from "@/server/cron/auth";
import { sendExpiredNotice } from "@/server/email/notify";

/**
 * Batas email per jalan — BUKAN batas UPDATE-nya.
 *
 * UPDATE status sengaja tetap tak berbatas: membiarkan undangan yang masa
 * aktifnya habis tetap tampil kepada tamu adalah cacat berbayar, dan memecahnya
 * per batch berarti sebagian undangan hidup sehari lebih lama dari yang dibeli.
 * Yang dibatasi hanya pengiriman email, karena Resend berjalan ~2 permintaan per
 * detik: 500 kiriman berurutan membuat job ini berjalan beberapa menit dan
 * berisiko dibunuh runner cron SEBELUM `recordCronRun` — dan job sehat yang tak
 * pernah melapor akan dituduh mati di `/admin`, kerusakan yang lebih besar
 * daripada email yang hilang. Sisanya dilaporkan sebagai `notifyTruncated`
 * (terlihat, bukan terpotong diam-diam).
 */
const NOTIFY_BATCH = 100;

/**
 * Cron: set `expired` untuk undangan `active` yang lewat `active_until`
 * (SPEC §4.8 lifecycle, ARCHITECTURE §7). Satu UPDATE atomik (service_role),
 * lalu revalidate ISR halaman publik tiap slug agar menampilkan notis kedaluwarsa
 * (DECISIONS #25). Renewal yang baru memperpanjang `active_until` tak ikut ter-
 * expire (klausa `active_until < now`). Auth: `Authorization: Bearer <CRON_SECRET>`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) return json({ ok: false }, 401);

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // updated_at diurus trigger set_invitations_updated_at.
  const { data, error } = await admin
    .from("invitations")
    .update({ status: "expired" })
    .eq("status", "active")
    .not("active_until", "is", null)
    .lt("active_until", nowIso)
    .select("id, slug, user_id, active_until");
  if (error) {
    // Dulu 503 ini hanya jadi exit code curl di panel Easypanel — tak masuk
    // Sentry, tak terlihat di mana pun (AUDIT-2026-10-01).
    reportHandledError(error, "cron.expire-invitations");
    await recordCronRun("expire-invitations", false, {}, error);
    return json({ ok: false }, 503);
  }

  for (const row of data ?? []) revalidatePath(`/${row.slug}`);

  // Notis "masa aktif berakhir" (B7). Dikirim DI SINI karena inilah satu-satunya
  // tempat transisi `active → expired` terjadi — dan pemilik yang tak dikabari
  // menemukannya dari tamunya sendiri.
  //
  // Sekali jalan, tanpa penanda dan tanpa retry: UPDATE di atas sudah memindahkan
  // statusnya, jadi baris yang sama takkan terpilih lagi pada siklus ini.
  // Asimetrinya dengan peringatan pra-purge disengaja — peringatan itu
  // MENGGERBANGI penghapusan permanen sehingga wajib ditandai hanya saat benar
  // terkirim; notis ini tak menggerbangi apa pun: pengingat H-14 sudah lebih dulu
  // terkirim, datanya utuh enam bulan, dan peringatan pra-purge masih menyusul.
  // Kehilangannya merugikan, bukan merusak — sementara menahan expiry demi email
  // akan membiarkan undangan yang sudah habis masa aktifnya tetap tampil.
  let notified = 0;
  let notifyNoOwner = 0;
  let notifyFailed = 0;
  const rows = data ?? [];
  const notifyRows = rows.slice(0, NOTIFY_BATCH);
  for (const row of notifyRows) {
    if (!row.active_until) continue;
    // Pemilik bisa TAK ADA — akun yang dihapus meninggalkan kerangka undangan
    // ber-`user_id` NULL demi pembukuan (A6). Tak ada alamat tujuan, dan itu
    // bukan galat; tetap DIHITUNG agar tidak hilang tanpa jejak.
    if (!row.user_id) {
      notifyNoOwner += 1;
      continue;
    }
    const status = await sendExpiredNotice(admin, {
      id: row.id,
      slug: row.slug,
      user_id: row.user_id,
      active_until: row.active_until,
    });
    if (status === "sent") notified += 1;
    else notifyFailed += 1;
  }

  const expired = rows.length;
  const notifyTruncated = Math.max(0, expired - notifyRows.length);
  await recordCronRun("expire-invitations", true, {
    expired,
    notified,
    notifyNoOwner,
    notifyFailed,
    notifyTruncated,
  });
  return json(
    {
      ok: true,
      expired,
      notified,
      notifyNoOwner,
      notifyFailed,
      notifyTruncated,
    },
    200,
  );
}
