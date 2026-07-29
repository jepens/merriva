import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/server/cron/auth";

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
    .select("slug");
  if (error) return json({ ok: false }, 503);

  for (const row of data ?? []) revalidatePath(`/${row.slug}`);

  return json({ ok: true, expired: data?.length ?? 0 }, 200);
}
