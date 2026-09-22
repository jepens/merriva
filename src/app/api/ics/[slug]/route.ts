import { buildIcs, type CalendarEventInput } from "@/lib/calendar";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { parseContentForRender } from "@/lib/invitation-content";
import { checkClientRateLimit } from "@/lib/request-ip";
import { scheduledEvents } from "@/lib/schedule";
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
 *   3. Cache-Control PENDEK (5 menit): URL per sesi stabil lintas suntingan
 *      (DECISIONS #43), jadi cache tak boleh lebih lama dari yang wajar untuk
 *      jam yang baru diubah. Biaya per hit rendah (1 query + perakitan string;
 *      tanpa render gambar), jadi tak sekritis OG — Cloudflare Cache Rule
 *      opsional (bila dipasang: cache key WAJIB menyertakan query `e` karena
 *      berkas berbeda per sesi, Edge TTL tetap pendek, dan Browser TTL WAJIB
 *      "Respect origin" — bawaan zona 4 jam menimpa max-age origin yang lebih
 *      kecil). 404/429 memancarkan `no-store` eksplisit (lihat `noFile`).
 *
 * `?e=<eventId>` → hanya sesi tersebut; tanpa `?e` → seluruh sesi dalam satu
 * VCALENDAR. Runtime Node (admin client + hashing IP).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ICS_LIMIT = { max: 60, windowMs: 60_000 };

/**
 * Respons tanpa berkas (404/429) dengan `no-store` EKSPLISIT: tanpa header,
 * CDN/peramban memakai TTL bawaannya (Cloudflare: Browser Cache TTL zona, 4 jam)
 * — 404 sesaat (mis. pemilik mengosongkan jam sesi sebentar, #42) bisa tertahan
 * di peramban tamu berjam-jam setelah jamnya diisi lagi.
 */
function noFile(status: 404 | 429, headers: Record<string, string> = {}) {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Rate limit per-IP (boundary "rate limit endpoint publik").
  const rl = await checkClientRateLimit("ics", ICS_LIMIT);
  if (!rl.ok) {
    return noFile(429, { "Retry-After": "60" });
  }

  const slug = (await params).slug.trim().toLowerCase();
  if (!slug || isReservedSlug(slug) || isDraftSlug(slug)) {
    return noFile(404);
  }

  // 2. Cheap-reject: hanya undangan AKTIF yang punya berkas kalender.
  const admin = createSupabaseAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, slug, category, content, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!inv || inv.status !== "active") {
    return noFile(404);
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("e");

  let query = admin
    .from("invitation_events")
    .select("id, name, start_at, end_at, venue_name, address")
    .eq("invitation_id", inv.id)
    // Sesi draft tanpa jam (DECISIONS #42) tak punya tempat di kalender tamu.
    .not("start_at", "is", null);
  if (eventId) query = query.eq("id", eventId);
  const { data: rows } = await query
    .order("sort_order", { ascending: true })
    .order("start_at", { ascending: true });

  const scheduled = scheduledEvents(rows ?? []);
  if (scheduled.length === 0) {
    return noFile(404);
  }

  // Deskripsi umum: nama mempelai (bila wedding) + tautan undangan.
  const content = parseContentForRender(inv.content, inv.category);
  const c = copy.public.cover;
  const link = `${appUrl}/${inv.slug}`;
  const description =
    content.category === "wedding"
      ? `${c.weddingKicker} ${content.groom.nickname || content.groom.name || c.groomFallback} & ${content.bride.nickname || content.bride.name || c.brideFallback}\n${link}`
      : link;

  const events: CalendarEventInput[] = scheduled.map((e) => ({
    id: e.id,
    title: e.name.trim() || copy.public.eventFallbackName,
    startAt: e.start_at,
    endAt: e.end_at,
    venueName: e.venue_name,
    address: e.address,
    description,
  }));

  const ics = buildIcs(events);
  if (!ics) return noFile(404);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Nama berkas ASCII-aman (slug = [a-z0-9-]); iOS/Android mengenali .ics.
      "Content-Disposition": `attachment; filename="${inv.slug}.ics"`,
      // URL per sesi kini STABIL lintas suntingan (DECISIONS #43), jadi cache
      // panjang akan menyajikan jam LAMA setelah pemilik mengubah jadwal. Dulu
      // 1 jam (peramban) / 1 hari (CDN); kini 5 menit di keduanya. Path tanpa
      // ekstensi → Cloudflare tak meng-cache default; origin murah + rate limit
      // membatasi biaya tanpa Cache Rule.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
