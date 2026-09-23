"use server";

import { reportHandledError } from "@/lib/observability";
import { checkClientRateLimit } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Resolusi nama tamu dari `?g={token}` untuk personalisasi cover + prefill RSVP
 * (SPEC §4.5), sekaligus mencatat `first_viewed_at` (penanda "sudah dibuka",
 * SPEC §4.7) pada akses pertama. Publik → **service-role** (tabel `guests` tanpa
 * policy anon) dengan filter ketat: hanya undangan AKTIF, HANYA mengembalikan
 * `name` pemilik token itu (tak pernah phone/notes/kontak). Rate limit per-IP
 * mencegah enumerasi token.
 */

/**
 * Plafon di-scope PER UNDANGAN dan dilonggarkan (AUDIT-2026-09-04 PER-3).
 *
 * Nilai lama 30/menit per-/24 tanpa cakupan: di WiFi venue tamu ke-31 kehilangan
 * sapaan personal tanpa penjelasan. Proteksi enumerasi token tetap utuh — token
 * 10-64 karakter, dan 300/menit (~432 ribu percobaan/hari untuk SATU undangan
 * dari SATU jaringan) masih jauh di luar jangkauan tebakan.
 */
const VIEW_LIMIT = { max: 300, windowMs: 60_000 };

/**
 * `rate` DIBEDAKAN dari `none` supaya UI bisa mencoba lagi. Sebelumnya keduanya
 * `null`: penolakan rate limit tak bisa dibedakan dari token tak dikenal, jadi
 * tamu sah kehilangan namanya secara permanen di pemuatan itu.
 */
export type GuestViewResult =
  | { status: "ok"; name: string }
  | { status: "rate" }
  /**
   * Galat DB — DIBEDAKAN dari `none` (DECISIONS #46). Dulu keduanya `none`:
   * kedipan DB membuang token tamu, sehingga sapaan hilang DAN RSVP-nya tak
   * tertaut ke tamu (pax dipotong ke 2, ekspor menandainya "belum RSVP").
   */
  | { status: "error" }
  | { status: "none" };

export async function viewGuestByTokenAction(
  slug: string,
  token: string,
): Promise<GuestViewResult> {
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  const cleanToken = typeof token === "string" ? token.trim() : "";
  if (!cleanSlug || cleanToken.length < 10 || cleanToken.length > 64) {
    return { status: "none" };
  }

  const rl = await checkClientRateLimit("guest-view", VIEW_LIMIT, cleanSlug);
  if (!rl.ok) return { status: "rate" };

  const admin = createSupabaseAdminClient();
  const { data: inv, error: invError } = await admin
    .from("invitations")
    .select("id, status")
    .eq("slug", cleanSlug)
    .maybeSingle();
  if (invError) {
    reportHandledError(invError, "personalization.invitation", {
      slug: cleanSlug,
    });
    return { status: "error" };
  }
  if (!inv || inv.status !== "active") return { status: "none" };

  const { data: guest, error: guestError } = await admin
    .from("guests")
    .select("id, name, first_viewed_at")
    .eq("invitation_id", inv.id)
    .eq("token", cleanToken)
    .maybeSingle();
  if (guestError) {
    // Token TIDAK dilaporkan (identitas tamu, SPEC §11).
    reportHandledError(guestError, "personalization.guest", {
      slug: cleanSlug,
    });
    return { status: "error" };
  }
  if (!guest) return { status: "none" };

  // Catat akses pertama (idempotent — hanya bila belum pernah dibuka).
  if (!guest.first_viewed_at) {
    const { error: seenError } = await admin
      .from("guests")
      .update({ first_viewed_at: new Date().toISOString() })
      .eq("id", guest.id)
      .is("first_viewed_at", null);
    // Sapaan tak boleh gagal karena penanda ini; cukup dilaporkan (dashboard
    // pemilik akan menandai tamu "belum dibuka" → kirim ulang WA sia-sia).
    if (seenError) {
      reportHandledError(seenError, "personalization.firstViewed", {
        slug: cleanSlug,
      });
    }
  }

  return { status: "ok", name: guest.name };
}
