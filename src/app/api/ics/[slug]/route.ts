import { buildIcs, type CalendarEventInput } from "@/lib/calendar";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { parseContentForRender } from "@/lib/invitation-content";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientRateKey } from "@/lib/request-ip";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Berkas iCalendar (`.ics`) per undangan (SPEC §4.5 / M2.6) untuk tombol
 * "Simpan ke Kalender" (jalur Apple Calendar / Outlook / dll.; jalur Google
 * memakai tautan `render` langsung, tanpa endpoint ini).
 *
 * **PUBLIK & guest-agnostik**: dilayani service-role dengan filter eksplisit
 * (tabel `invitations` tanpa policy anon) — HANYA nama sesi + waktu + tempat
 * (data publik-aman). TIDAK PERNAH menyentuh guests/gift_notes/orders; `?g=`/`?to=`
 * diabaikan (berkas sama untuk semua tamu).
 *
 * Perlindungan beban (endpoint publik → boundary "rate limit endpoint publik"):
 *   1. Rate limit per-IP.
 *   2. Cheap-reject: slug reserved/draft/tak-aktif/tak-ada → 404 (tanpa rakit).
 *   3. Cache-Control agar CDN menyerap unduhan berulang. Biaya per hit rendah
 *      (1 query + perakitan string; tanpa render gambar), jadi tak sekritis OG —
 *      Cloudflare Cache Rule opsional (bila dipasang, cache key WAJIB menyertakan
 *      query `e` karena berkas berbeda per sesi).
 *
 * `?e=<eventId>` → hanya sesi tersebut; tanpa `?e` → seluruh sesi dalam satu
 * VCALENDAR. Runtime Node (admin client + hashing IP).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ICS_LIMIT = { max: 60, windowMs: 60_000 };

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Rate limit per-IP (boundary "rate limit endpoint publik").
  const rl = checkRateLimit(await clientRateKey("ics"), ICS_LIMIT);
  if (!rl.ok) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const slug = (await params).slug.trim().toLowerCase();
  if (!slug || isReservedSlug(slug) || isDraftSlug(slug)) {
    return new Response(null, { status: 404 });
  }

  // 2. Cheap-reject: hanya undangan AKTIF yang punya berkas kalender.
  const admin = createSupabaseAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, slug, category, content, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!inv || inv.status !== "active") {
    return new Response(null, { status: 404 });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("e");

  let query = admin
    .from("invitation_events")
    .select("id, name, start_at, end_at, venue_name, address")
    .eq("invitation_id", inv.id);
  if (eventId) query = query.eq("id", eventId);
  const { data: rows } = await query
    .order("sort_order", { ascending: true })
    .order("start_at", { ascending: true });

  if (!rows || rows.length === 0) {
    return new Response(null, { status: 404 });
  }

  // Deskripsi umum: nama mempelai (bila wedding) + tautan undangan.
  const content = parseContentForRender(inv.content, inv.category);
  const c = copy.public.cover;
  const link = `${appUrl}/${inv.slug}`;
  const description =
    content.category === "wedding"
      ? `${c.weddingKicker} ${content.groom.nickname || content.groom.name || c.groomFallback} & ${content.bride.nickname || content.bride.name || c.brideFallback}\n${link}`
      : link;

  const events: CalendarEventInput[] = rows.map((e) => ({
    id: e.id,
    title: e.name,
    startAt: e.start_at,
    endAt: e.end_at,
    venueName: e.venue_name,
    address: e.address,
    description,
  }));

  const ics = buildIcs(events);
  if (!ics) return new Response(null, { status: 404 });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Nama berkas ASCII-aman (slug = [a-z0-9-]); iOS/Android mengenali .ics.
      "Content-Disposition": `attachment; filename="${inv.slug}.ics"`,
      // Path tanpa ekstensi → Cloudflare tak meng-cache default (lihat catatan
      // modul); origin murah + rate limit membatasi biaya tanpa Cache Rule.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
