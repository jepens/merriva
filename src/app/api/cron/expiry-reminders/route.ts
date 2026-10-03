import { reportHandledError } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordCronRun } from "@/server/cron/record";
import { isAuthorizedCron } from "@/server/cron/auth";
import { sendExpiryReminder } from "@/server/email/notify";

/**
 * Cron: kirim pengingat masa aktif H-14 (SPEC §4.10, dipindah dari M3.4).
 * Pilih undangan `active` yang `active_until` dalam ≤14 hari & belum diingatkan
 * (`reminder_sent_at is null`), kirim email, lalu tandai `reminder_sent_at`
 * HANYA saat email benar-benar terkirim (`sent`) → idempoten; skip (tanpa
 * `RESEND_API_KEY`) / error → coba lagi jalankan berikutnya. `reminder_sent_at`
 * di-reset oleh `activate_paid_order` pada perpanjangan → siklus baru diingatkan
 * lagi. Auth `Authorization: Bearer <CRON_SECRET>`.
 *
 * CADENCE: jadwalkan tiap ≤12 jam (bukan 24 jam). "Tandai hanya saat terkirim"
 * bersifat at-least-once — bila email terkirim tetapi UPDATE `reminder_sent_at`
 * gagal, baris terpilih lagi berikutnya; satu-satunya penjaga kirim-ganda adalah
 * `idempotencyKey` Resend yang HANYA berlaku 24 jam. Cadence <24 jam menjaga retry
 * tetap dalam jendela itu → tanpa pengingat ganda.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // H-14
const BATCH = 100;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) return json({ ok: false }, 401);

  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const horizonIso = new Date(now + REMINDER_WINDOW_MS).toISOString();

  const { data: targets, error } = await admin
    .from("invitations")
    .select("id, slug, user_id, active_until")
    .eq("status", "active")
    .is("reminder_sent_at", null)
    .not("active_until", "is", null)
    .gt("active_until", nowIso) // belum lewat
    .lte("active_until", horizonIso) // dalam 14 hari
    .order("active_until", { ascending: true })
    .limit(BATCH);
  if (error) {
    reportHandledError(error, "cron.expiry-reminders");
    await recordCronRun("expiry-reminders", false, {}, error);
    return json({ ok: false }, 503);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let noOwner = 0;

  for (const t of targets ?? []) {
    if (!t.active_until) continue; // dijaga filter di atas; guard tipe
    // Pemilik sudah menghapus akunnya (`user_id` NULL — A6): tak ada alamat
    // tujuan. DIHITUNG, bukan di-`continue` diam-diam: barisnya akan terpilih
    // lagi setiap jalan karena `reminder_sent_at` tak pernah ditandai, dan satu
    // angka di `cron_runs.stats` lebih baik daripada lingkaran tak terlihat.
    if (!t.user_id) {
      noOwner += 1;
      continue;
    }
    const status = await sendExpiryReminder(
      admin,
      {
        id: t.id,
        slug: t.slug,
        user_id: t.user_id,
        active_until: t.active_until,
      },
      now,
    );
    if (status === "sent") {
      // Tandai HANYA saat benar terkirim; `.is null` cegah tanda ganda antar-run.
      const { error: markErr } = await admin
        .from("invitations")
        .update({ reminder_sent_at: nowIso })
        .eq("id", t.id)
        .is("reminder_sent_at", null);
      if (markErr) failed += 1;
      else sent += 1;
    } else if (status === "skipped") {
      skipped += 1; // tanpa RESEND_API_KEY (dev) → jangan tandai
    } else {
      failed += 1; // error / nodata → coba lagi jalankan berikutnya
    }
  }

  const scanned = targets?.length ?? 0;
  await recordCronRun("expiry-reminders", true, {
    scanned,
    sent,
    skipped,
    failed,
    noOwner,
  });
  return json(
    {
      ok: true,
      scanned,
      truncated: scanned === BATCH,
      sent,
      skipped,
      failed,
      noOwner,
    },
    200,
  );
}
