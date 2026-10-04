import { mediaObjectPaths } from "@/lib/media";
import { getStorage } from "@/lib/storage";
import { reportHandledError } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordCronRun } from "@/server/cron/record";
import { isAuthorizedCron } from "@/server/cron/auth";

/**
 * Cron: HAPUS PERMANEN data pribadi undangan yang expired > 6 bulan (retensi
 * UU PDP 27/2022, DATA-MODEL §5). Menegakkan janji /privasi & LAUNCH-CHECKLIST
 * Fase 8 — sebelum ini tak ada purge sama sekali (cron `expire-invitations`
 * hanya membalik status).
 *
 * Alur per undangan (RPC `purge_invitation_data`, service_role, atomik):
 *  1. Hapus tamu/RSVP/gift_notes/media/invitation_events + scrub `content`.
 *  2. Baris `invitations` TETAP sebagai kerangka statistik (`purged_at` di-set →
 *     tak diproses ulang). `orders` (incl. raw_notification) DIPERTAHANKAN
 *     (retensi keuangan >= 2 tahun).
 *  3. Objek storage media dibersihkan DI SINI (SQL tak bisa sentuh bucket);
 *     best-effort — orphan tak berbahaya & tak tertebak.
 *
 * Cutoff = now − 6 bulan atas `active_until` (saat undangan menjadi expired).
 * Auth: header `Authorization: Bearer <CRON_SECRET>`. Mutasi → service_role.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Batasi kerja per-jalankan (retensi harian, volume rendah). Sisa diambil
// jalankan berikutnya; `truncated` menandai backlog (bukan truncation senyap).
const BATCH = 100;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Cutoff: 6 bulan kalender sebelum `now` (UTC). Diekspor untuk diuji. */
export function retentionCutoffIso(now: Date): string {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  return cutoff.toISOString();
}

export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) return json({ ok: false }, 401);

  const admin = createSupabaseAdminClient();
  const cutoff = retentionCutoffIso(new Date());

  // Kandidat: kedaluwarsa ATAU DITANGGUHKAN, belum dipurge, active_until lewat
  // cutoff. Indeks parsial `invitations_purge_scan_v2_idx` melayani scan ini.
  //
  // `suspended` IKUT sejak 2026-10-05 (keputusan pemilik): sebelumnya undangan
  // yang ditangguhkan tak pernah sampai ke `expired` — `admin_suspend_invitation`
  // tak menyentuh `active_until` dan cron `expire-invitations` hanya membalik
  // `active` → `expired` — sehingga nama tamu, nomor HP, dan isi ucapan tersimpan
  // SELAMANYA, di luar retensi yang dijanjikan `/privasi`. Yang menanggungnya
  // tamu, yang tak melakukan apa pun. Jam retensinya tetap `active_until`, yang
  // memang tak disentuh suspend.
  const { data: due, error } = await admin
    .from("invitations")
    .select("id")
    .in("status", ["expired", "suspended"])
    .is("purged_at", null)
    .not("active_until", "is", null)
    .lt("active_until", cutoff)
    .order("active_until", { ascending: true })
    .limit(BATCH);
  if (error) {
    reportHandledError(error, "cron.purge-expired");
    await recordCronRun("purge-expired", false, {}, error);
    return json({ ok: false }, 503);
  }

  const storage = getStorage();
  let purged = 0;
  let skipped = 0; // race: keburu dipurge/diperpanjang antar-select & RPC
  let storageFailed = 0; // objek storage gagal dihapus (baris DB sudah bersih)

  for (const row of due ?? []) {
    const { data: res, error: rpcErr } = await admin.rpc(
      "purge_invitation_data",
      { p_invitation_id: row.id },
    );
    if (rpcErr) {
      skipped += 1;
      continue;
    }
    const outcome = res?.[0];
    if (outcome?.result !== "purged") {
      skipped += 1; // not_found / not_expired / already_purged
      continue;
    }
    purged += 1;

    // Bersihkan objek storage (best-effort). `media_paths` = prefix galeri (2
    // varian WebP per prefix); `momen_paths` = path objek PENUH foto momen.
    const results = await Promise.allSettled([
      ...(outcome.media_paths ?? []).flatMap((prefix) =>
        mediaObjectPaths(prefix).map((p) => storage.delete(p)),
      ),
      ...(outcome.momen_paths ?? []).map((p) => storage.delete(p)),
    ]);
    if (results.some((r) => r.status === "rejected")) storageFailed += 1;
  }

  const scanned = due?.length ?? 0;
  await recordCronRun("purge-expired", true, {
    scanned,
    purged,
    skipped,
    storageFailed,
  });
  return json(
    {
      ok: true,
      scanned,
      purged,
      skipped,
      storageFailed,
      // Batch penuh → mungkin masih ada sisa; observabilitas backlog.
      truncated: scanned === BATCH,
    },
    200,
  );
}
