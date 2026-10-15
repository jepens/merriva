import { mediaObjectPaths } from "@/lib/media";
import { getStorage } from "@/lib/storage";
import { reportHandledError } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordCronRun } from "@/server/cron/record";
import { isAuthorizedCron } from "@/server/cron/auth";
import {
  bolehPurge,
  dueWithinIso,
  retentionCutoffIso,
  tahapPeringatan,
} from "@/server/cron/retention";
import { sendPurgeWarning } from "@/server/email/notify";

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

/**
 * Rumus cutoff pindah ke `@/server/cron/retention` (B7): fase PERINGATAN dan
 * fase PURGE wajib memakai garis yang persis sama. Re-export supaya test lama
 * dan pemanggil lain tak perlu tahu perpindahannya.
 */
export { retentionCutoffIso };

export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) return json({ ok: false }, 401);

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const cutoff = retentionCutoffIso(now);

  // === FASE 1 — PERINGATAN =====================================================
  // Satu job, dua kewajiban berurutan: "peringatkan, lalu hapus yang sudah lewat
  // masa peringatannya". Sengaja BUKAN cron kelima — populasinya persis sama
  // (expired/suspended, belum dipurge), dan dua baris `cron_runs` untuk satu
  // rangkaian akan membuat kartu kesehatan di `/admin` ambigu.
  //
  // Kandidatnya dibatasi jendela TERLUAR (30 hari) lalu tahapnya diputuskan
  // fungsi murni `tahapPeringatan` — yang juga memastikan satu baris tak pernah
  // menerima dua email dalam satu run.
  const { data: calon, error: calonErr } = await admin
    .from("invitations")
    .select(
      "id, slug, user_id, active_until, purge_warned_at, purge_final_warned_at",
    )
    .in("status", ["expired", "suspended"])
    .is("purged_at", null)
    .not("active_until", "is", null)
    .lt("active_until", dueWithinIso(now, 30))
    .order("active_until", { ascending: true })
    .limit(BATCH);
  if (calonErr) {
    reportHandledError(calonErr, "cron.purge-expired.warn");
    await recordCronRun("purge-expired", false, {}, calonErr);
    return json({ ok: false }, 503);
  }

  let warned = 0;
  let warnFinal = 0;
  let warnNoOwner = 0;
  let warnFailed = 0;

  for (const row of calon ?? []) {
    if (!row.active_until) continue;
    const tahap = tahapPeringatan(
      {
        active_until: row.active_until,
        purge_warned_at: row.purge_warned_at,
        purge_final_warned_at: row.purge_final_warned_at,
      },
      now,
    );
    if (!tahap) continue;
    // Akun pemilik sudah dihapus (`user_id` NULL): tak ada alamat tujuan. Tetap
    // DIHITUNG, bukan dilewati diam-diam — barisnya akan terpilih lagi setiap
    // jalan, dan satu angka di `cron_runs.stats` lebih baik daripada lingkaran
    // tak terlihat. Backstop di fase purge yang akhirnya melepaskannya.
    if (!row.user_id) {
      warnNoOwner += 1;
      continue;
    }

    const status = await sendPurgeWarning(
      admin,
      {
        id: row.id,
        slug: row.slug,
        user_id: row.user_id,
        active_until: row.active_until,
        final: tahap === "final",
      },
      now.getTime(),
    );
    if (status !== "sent") {
      warnFailed += 1;
      continue;
    }
    // Penanda ditulis HANYA saat email benar-benar terkirim (pola
    // `expiry-reminders`). Kolomnya mengikuti tahap, dan nilainya `now` —
    // yang > `active_until`, sehingga ia menandai SIKLUS INI.
    // Dicabang EKSPLISIT, bukan kunci terhitung `{ [kolom]: ... }`: kunci
    // terhitung membuat tipe kolom Supabase runtuh jadi index signature, dan
    // dengan itu hilang pula jaring yang menangkap salah ketik nama kolom.
    const patch =
      tahap === "final"
        ? { purge_final_warned_at: now.toISOString() }
        : { purge_warned_at: now.toISOString() };
    const { error: markErr } = await admin
      .from("invitations")
      .update(patch)
      .eq("id", row.id);
    if (markErr) {
      warnFailed += 1;
      continue;
    }
    warned += 1;
    if (tahap === "final") warnFinal += 1;
  }

  // === FASE 2 — PURGE ==========================================================

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
    .select("id, active_until, purge_final_warned_at")
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
  let heldForWarning = 0; // menunggu peringatan terkirim & jedanya lewat
  let backstop = 0; // dihapus TANPA peringatan karena sudah jauh lewat tenggat

  for (const row of due ?? []) {
    // Data pribadi tak dihapus permanen tanpa peringatan yang BENAR-BENAR
    // terkirim — itu janji `/syarat` & `/privasi`. `backstop` tetap ada karena
    // pipeline email yang rusak tak boleh menahan kewajiban retensi selamanya:
    // menyimpan data melewati batas adalah pelanggaran yang berlawanan arah.
    const keputusan = bolehPurge(
      {
        active_until: row.active_until ?? "",
        purge_final_warned_at: row.purge_final_warned_at,
      },
      now,
    );
    if (keputusan === "tunggu-peringatan") {
      heldForWarning += 1;
      continue;
    }
    if (keputusan === "backstop") backstop += 1;

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

  // Objek yang gagal dihapus WAJIB berbunyi. Sebelum ini angkanya hanya
  // ditulis ke `cron_runs.stats` sementara runnya tetap ditandai `ok: true` —
  // dan `ok: true` me-NULL-kan `last_error` serta tidak menaikkan `failures`
  // (lihat `server/cron/record.ts`). Akibatnya satu-satunya permukaan yang
  // menampilkannya adalah `/admin`; `pnpm ops:verify` melaporkan cron ini
  // HIJAU, dan tak ada satu pun event Sentry.
  //
  // Yang hilang bukan sekadar angka: baris DB SUDAH dibersihkan, jadi objek
  // yang tertinggal tak punya rujukan apa pun lagi — data pribadi yang
  // seharusnya musnah menurut UU PDP tinggal di storage tanpa ada yang tahu,
  // dan tanpa jalan menemukannya kembali selain menyisir bucket.
  //
  // Jalan gagalnya nyata pada R2: satu token ber-scope read-only membuat
  // SETIAP delete 403 — tiap malam, selamanya, hijau. Bandingkan
  // `admin-users.ts` yang melaporkan kelas kegagalan yang sama; aksi admin
  // yang ditunggui manusia punya alarm, sementara cron malam tanpa penunggu
  // yang justru menegakkan retensi tidak punya. Inversi itu yang diperbaiki.
  //
  // Runnya TIDAK ditandai gagal: pekerjaan DB-nya memang berhasil, dan
  // memerahkan seluruh job akan menyembunyikan apa yang sebenarnya rusak.
  if (storageFailed > 0) {
    reportHandledError(
      new Error(
        `${storageFailed} undangan gagal dihapus objek storage-nya saat purge retensi`,
      ),
      "cron.purge-expired.storage",
      { storageFailed, purged },
    );
  }

  const scanned = due?.length ?? 0;
  await recordCronRun("purge-expired", true, {
    scanned,
    purged,
    skipped,
    storageFailed,
    heldForWarning,
    backstop,
    warned,
    warnFinal,
    warnNoOwner,
    warnFailed,
  });
  return json(
    {
      ok: true,
      scanned,
      purged,
      skipped,
      storageFailed,
      heldForWarning,
      backstop,
      warned,
      warnFinal,
      warnNoOwner,
      warnFailed,
      // Batch penuh → mungkin masih ada sisa; observabilitas backlog.
      truncated: scanned === BATCH,
    },
    200,
  );
}
