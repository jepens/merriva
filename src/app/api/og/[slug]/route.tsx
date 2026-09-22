import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { copy } from "@/lib/copy";
import { formatDateOnly, formatEventDateTime } from "@/lib/datetime";
import { parseContentForRender } from "@/lib/invitation-content";
import { checkClientRateLimit } from "@/lib/request-ip";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { settingsSchema } from "@/lib/validation/content";

/**
 * OG image dinamis per undangan (SPEC §4.5 / M2.5) untuk pratinjau tautan di
 * WhatsApp. **PUBLIK & guest-agnostik**: dilayani service-role dengan filter
 * eksplisit (tabel `invitations` tanpa policy anon) — HANYA nama mempelai +
 * tanggal (data publik-aman). TIDAK PERNAH menyentuh guests/gift_notes/orders,
 * dan TIDAK memvariasikan gambar per tamu (`?g=`/`?to=` diabaikan).
 *
 * Perlindungan beban (endpoint publik → boundary "rate limit endpoint publik"):
 *   1. Rate limit per-IP (satori render ± DB tiap hit = mahal & asimetris).
 *   2. Cheap-reject: slug reserved/draft/tak-aktif/tak-ada → redirect ke gambar
 *      STATIS `/og-default.png` (tanpa render) — hanya undangan AKTIF yang dirender.
 *   3. Cache-Control agar CDN menyerap scrape berulang. CATATAN DEPLOY: path
 *      `/api/og/*` TANPA ekstensi → Cloudflare TIDAK meng-cache-nya secara default.
 *      Wajib menambah Cache Rule "Eligible for cache" untuk `/api/og/*` dengan
 *      cache key = path saja (abaikan query) agar `s-maxage` benar-benar berlaku
 *      (lihat docs/ARCHITECTURE.md). Rate limit + cheap-reject membatasi biaya
 *      origin bahkan tanpa aturan itu.
 *
 * Runtime Node (satori bawaan `next/og`); font di-embed dari `public/fonts`
 * (satori tak bisa memakai variabel CSS `next/font`).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;
const OG_LIMIT = { max: 60, windowMs: 60_000 };

// Palet eternal-rose (selaras tema).
const C = {
  bg: "#fbf6f3",
  names: "#8c4b56",
  gold: "#7e6532",
  muted: "#7a625f",
  line: "rgba(140, 75, 86, 0.28)",
  divider: "#b76e79",
};

// Muat font sekali per proses (bukan per request). process.cwd() = root proyek;
// `public/` disalin ke image standalone (lihat Dockerfile). Font STATIS (satori
// gagal/native-crash pada TTF variabel — mis. Cormorant Garamond `[wght]`), jadi
// serif memakai Crimson Text SemiBold (mirip Cormorant, statis & ringan).
// `.catch(null)` → font hilang (mis. salah path saat ganti font) tak pernah jadi
// unhandled rejection; GET mengembalikan 500 ter-scope, bukan mematikan proses.
const fontsPromise: Promise<[Buffer, Buffer] | null> = Promise.all([
  readFile(join(process.cwd(), "public", "fonts", "CrimsonText-SemiBold.ttf")),
  readFile(join(process.cwd(), "public", "fonts", "GreatVibes-Regular.ttf")),
])
  .then((fonts) => fonts as [Buffer, Buffer])
  .catch((err) => {
    console.error("[og] gagal memuat font", err);
    return null;
  });

interface OgFields {
  kicker: string;
  names: { groom: string; bride: string } | null;
  eventName: string | null;
  dateLabel: string | null;
}

/** Potong nama panjang agar layout tetap muat (fallback dari `name` bila tanpa
 * nickname bisa mencapai 120 char). */
function cap(s: string, max = 34): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Ukuran font nama adaptif — nama panjang mengecil agar tetap di dalam bingkai. */
function nameFontSize(title: string, script: boolean): number {
  const n = title.length;
  if (script)
    return n <= 18 ? 150 : n <= 28 ? 116 : n <= 42 ? 86 : n <= 58 ? 64 : 50;
  return n <= 18 ? 96 : n <= 34 ? 72 : n <= 50 ? 56 : 46;
}

/** Ambil field publik-aman untuk gambar (nama mempelai + tanggal). NULL =
 * reserved/draft/tak-aktif/tak-ada → pemanggil pakai gambar default statis. */
async function resolveOgFields(rawSlug: string): Promise<OgFields | null> {
  const slug = rawSlug.trim().toLowerCase();
  if (!slug || isReservedSlug(slug) || isDraftSlug(slug)) return null;

  const admin = createSupabaseAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, category, content, settings, event_date, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!inv || inv.status !== "active") return null;

  const content = parseContentForRender(inv.content, inv.category);
  const c = copy.public.cover;
  // Wedding: pasangan nama (skrip). Non-wedding (corporate/family): nama acara —
  // `eventName` wajib di skema kategori, jadi selalu ada untuk undangan aktif.
  const names =
    content.category === "wedding"
      ? {
          groom: cap(
            content.groom.nickname || content.groom.name || c.groomFallback,
          ),
          bride: cap(
            content.bride.nickname || content.bride.name || c.brideFallback,
          ),
        }
      : null;
  const eventName =
    content.category === "wedding"
      ? null
      : cap(content.eventName || copy.brand.name, 60);

  const tz =
    settingsSchema.safeParse(inv.settings).data?.timezone ?? "Asia/Jakarta";
  const { data: firstEvent } = await admin
    .from("invitation_events")
    .select("start_at")
    .eq("invitation_id", inv.id)
    // Urut `sort_order` + limit 1: tanpa saringan ini sesi draft tanpa jam di
    // urutan pertama menutupi sesi berjam sesudahnya (DECISIONS #42).
    .not("start_at", "is", null)
    .order("sort_order", { ascending: true })
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let dateLabel: string | null = null;
  if (firstEvent?.start_at) {
    const f = formatEventDateTime(firstEvent.start_at, tz);
    dateLabel = f ? `${f.weekday}, ${f.date}` : null;
  } else if (inv.event_date) {
    const f = formatDateOnly(inv.event_date);
    dateLabel = f ? `${f.weekday}, ${f.date}` : null;
  }

  return {
    kicker: names ? c.weddingKicker : c.defaultKicker,
    names,
    eventName,
    dateLabel,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Rate limit per-IP (boundary "rate limit endpoint publik").
  const rl = await checkClientRateLimit("og", OG_LIMIT);
  if (!rl.ok) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const { slug } = await params;
  const fields = await resolveOgFields(slug);

  // 2. Cheap-reject: non-aktif/tak-ada → gambar default STATIS (tanpa render).
  if (!fields) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/og-default.png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  }

  // 3. Font (hanya untuk render undangan aktif).
  const fonts = await fontsPromise;
  if (!fonts) return new Response("OG image unavailable", { status: 500 });
  const [serif, greatVibes] = fonts;

  const title = fields.names
    ? `${fields.names.groom} & ${fields.names.bride}`
    : (fields.eventName ?? copy.brand.name);
  const kicker = fields.kicker;
  const useScript = Boolean(fields.names);
  const dateLabel = fields.dateLabel;
  const nameFont = nameFontSize(title, useScript);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
        fontFamily: "Crimson Text",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: WIDTH - 96,
          height: HEIGHT - 96,
          border: `2px solid ${C.line}`,
          borderRadius: 10,
          padding: 48,
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 10,
            textTransform: "uppercase",
            color: C.gold,
            textAlign: "center",
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            display: "flex",
            maxWidth: WIDTH - 96 - 96,
            fontFamily: useScript ? "Great Vibes" : "Crimson Text",
            fontSize: nameFont,
            fontWeight: 600,
            lineHeight: 1.1,
            color: C.names,
            marginTop: 20,
            textAlign: "center",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: 96,
            height: 2,
            background: C.divider,
            opacity: 0.6,
            margin: "28px 0",
          }}
        />
        {dateLabel ? (
          <div style={{ fontSize: 40, color: C.muted }}>{dateLabel}</div>
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 34,
          fontSize: 24,
          letterSpacing: 4,
          color: C.gold,
        }}
      >
        merriva.id
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Crimson Text", data: serif, style: "normal", weight: 600 },
        { name: "Great Vibes", data: greatVibes, style: "normal", weight: 400 },
      ],
      headers: {
        "Content-Type": "image/png",
        // Butuh Cloudflare Cache Rule (path tanpa ekstensi tak ter-cache default)
        // agar s-maxage berlaku — lihat catatan modul di atas & docs/ARCHITECTURE.md.
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
