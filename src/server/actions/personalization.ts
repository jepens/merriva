"use server";

import { checkRateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Resolusi nama tamu dari `?g={token}` untuk personalisasi cover + prefill RSVP
 * (SPEC §4.5), sekaligus mencatat `first_viewed_at` (penanda "sudah dibuka",
 * SPEC §4.7) pada akses pertama. Publik → **service-role** (tabel `guests` tanpa
 * policy anon) dengan filter ketat: hanya undangan AKTIF, HANYA mengembalikan
 * `name` pemilik token itu (tak pernah phone/notes/kontak). Rate limit per-IP
 * mencegah enumerasi token.
 */

const VIEW_LIMIT = { max: 30, windowMs: 60_000 };

export async function viewGuestByTokenAction(
  slug: string,
  token: string,
): Promise<{ name: string } | null> {
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  const cleanToken = typeof token === "string" ? token.trim() : "";
  if (!cleanSlug || cleanToken.length < 10 || cleanToken.length > 64) {
    return null;
  }

  const rl = checkRateLimit(await clientRateKey("guest-view"), VIEW_LIMIT);
  if (!rl.ok) return null;

  const admin = createSupabaseAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, status")
    .eq("slug", cleanSlug)
    .maybeSingle();
  if (!inv || inv.status !== "active") return null;

  const { data: guest } = await admin
    .from("guests")
    .select("id, name, first_viewed_at")
    .eq("invitation_id", inv.id)
    .eq("token", cleanToken)
    .maybeSingle();
  if (!guest) return null;

  // Catat akses pertama (idempotent — hanya bila belum pernah dibuka).
  if (!guest.first_viewed_at) {
    await admin
      .from("guests")
      .update({ first_viewed_at: new Date().toISOString() })
      .eq("id", guest.id)
      .is("first_viewed_at", null);
  }

  return { name: guest.name };
}
