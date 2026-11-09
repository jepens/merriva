import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route OG `/api/og/[slug]` (pratinjau tautan WhatsApp). og:image menunjuk
 * `/api/og/<slug>.jpg?v=…`, yang di-cache Cloudflare secara bawaan (DECISIONS
 * #122), jadi apa pun yang dijawab route ini bisa ter-cache untuk SEMUA scraper.
 * Karena itu (DECISIONS #45):
 *  - galat DB → 503 `no-store`, BUKAN gambar default ber-`s-maxage=86400`
 *    (dulu: satu kedipan DB = pratinjau default selama sehari) dan BUKAN
 *    gambar bertanggal salah (dulu: jatuh ke `event_date`, di-cache sehari);
 *  - 429 ber-`no-store` agar tak menjadi jawaban ter-cache.
 * Render gambar (satori) tak diuji di sini — `ImageResponse` di-mock.
 */

const { refs, reportHandledError, rateLimit } = vi.hoisted(() => ({
  refs: {
    inv: null as unknown,
    invError: null as unknown,
    firstEvent: null as unknown,
    eventsError: null as unknown,
    image: null as null | { headers?: Record<string, string> },
    queries: 0,
    /** Nilai `.eq("slug", …)` yang dikirim ke DB. */
    slugs: [] as string[],
    /** Byte yang "dirender" ImageResponse tiruan; `null` = render melempar. */
    png: null as Uint8Array | null,
  },
  reportHandledError: vi.fn(),
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 1, retryAfterMs: 0 })),
}));

vi.mock("@/lib/request-ip", () => ({ checkClientRateLimit: rateLimit }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    getPublicUrl: (p: string) => `https://media.test/${p}`,
  }),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(_el: unknown, opts: { headers?: Record<string, string> }) {
      refs.image = opts;
    }
    // Satori merender saat body dibaca — galat render muncul di sini.
    async arrayBuffer() {
      if (!refs.png) throw new Error("satori meledak");
      return refs.png.slice().buffer;
    }
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      refs.queries += 1;
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "not", "order", "limit"]) {
        chain[op] = () => chain;
      }
      chain.eq = (col: string, val: unknown) => {
        if (col === "slug") refs.slugs.push(String(val));
        return chain;
      };
      chain.maybeSingle = () =>
        Promise.resolve(
          table === "invitations"
            ? { data: refs.inv, error: refs.invError }
            : { data: refs.firstEvent, error: refs.eventsError },
        );
      return chain;
    },
  }),
}));

import { encode as encodePng } from "fast-png";

import { GET } from "@/app/api/og/[slug]/route";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";

/** PNG RGBA kecil yang sah — bentuk keluaran next/og. */
const PNG_RGBA = encodePng({
  width: 8,
  height: 4,
  data: new Uint8Array(8 * 4 * 4).fill(200),
  channels: 4,
  depth: 8,
});

/** Bentuk galat postgrest-js sungguhan (objek polos, bukan Error). */
const BOOM = {
  message: "TypeError: fetch failed",
  details: "",
  hint: "",
  code: "",
};

function panggil(slug = "andi-sinta") {
  return GET(new Request(`http://localhost/api/og/${slug}`), {
    params: Promise.resolve({ slug }),
  }) as Promise<Response>;
}

beforeEach(() => {
  refs.inv = {
    id: "inv-1",
    category: "wedding",
    content: emptyContent("wedding"),
    settings: DEFAULT_SETTINGS,
    event_date: "2026-12-20",
    status: "active",
  };
  refs.invError = null;
  refs.firstEvent = { start_at: "2026-12-20T02:00:00Z" };
  refs.eventsError = null;
  refs.image = null;
  refs.queries = 0;
  refs.slugs = [];
  refs.png = PNG_RGBA;
  reportHandledError.mockClear();
  rateLimit.mockClear();
});

const sementara = (res: Response) => {
  expect(res.status).toBe(503);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  expect(res.headers.get("Retry-After")).toBe("30");
  expect(res.headers.get("Location")).toBeNull();
};

describe("GET /api/og/[slug]", () => {
  it("undangan aktif → JPEG dengan cache CDN panjang (DECISIONS #119)", async () => {
    const res = await panggil();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
    const b = new Uint8Array(await res.arrayBuffer());
    expect([b[0], b[1]]).toEqual([0xff, 0xd8]); // SOI JPEG, bukan signature PNG
    // Cloudflare tak menyajikan salinan basi bila ada s-maxage (#122).
    expect(res.headers.get("Cache-Control")).not.toContain(
      "stale-while-revalidate",
    );
  });

  it("segmen `<slug>.jpg` (og:image sejak #122) → slug TANPA ekstensi ke DB, dirender sama", async () => {
    const res = await panggil("andi-sinta.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(refs.slugs).toEqual(["andi-sinta"]);
  });

  it("Content-Length eksplisit = panjang badan (tanpa ini Next mengirim chunked)", async () => {
    const res = await panggil("andi-sinta.jpg");
    const b = new Uint8Array(await res.arrayBuffer());
    expect(b.byteLength).toBeGreaterThan(0);
    expect(res.headers.get("Content-Length")).toBe(String(b.byteLength));
  });

  it("konversi JPEG gagal → PNG lama, dilaporkan, dan TIDAK ter-cache CDN", async () => {
    // 16-bit: bukan bentuk keluaran next/og → pngToJpeg melempar.
    refs.png = encodePng({
      width: 2,
      height: 2,
      data: new Uint16Array(2 * 2 * 4).fill(65535),
      channels: 4,
      depth: 16,
    });
    const res = await panggil();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    // Gambar terdegradasi (bisa > batas WhatsApp) tak boleh tertahan di CDN
    // sesudah perbaikannya dideploy.
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Length")).toBe(
      String((await res.arrayBuffer()).byteLength),
    );
    expect(reportHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      "og.jpeg",
      { slug: "andi-sinta" },
    );
  });

  it("render satori gagal → 500 no-store (tak boleh ter-cache CDN) dan dilaporkan", async () => {
    refs.png = null;
    const res = await panggil();
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(reportHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      "og.render",
      { slug: "andi-sinta" },
    );
  });

  it("undangan tak aktif (tanpa galat) → gambar default statis yang boleh di-cache", async () => {
    refs.inv = { ...(refs.inv as object), status: "draft" };
    const res = await panggil();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/og-default.png");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
  });

  it("slug draft/reserved → gambar default tanpa menyentuh DB", async () => {
    const res = await panggil("draft-a1b2c3");
    expect(res.status).toBe(302);
    expect(refs.queries).toBe(0);
  });

  it.each(["a".repeat(61), "a".repeat(9000), "andi_sinta"])(
    "slug mustahil → gambar default TANPA query & tanpa laporan (dulu 414 gateway → 503 + Sentry per hit)",
    async (slug) => {
      const res = await panggil(slug);
      expect(res.status).toBe(302);
      expect(refs.queries).toBe(0);
      expect(reportHandledError).not.toHaveBeenCalled();
    },
  );

  it("galat membaca undangan → 503 no-store, BUKAN gambar default yang di-cache sehari; dilaporkan", async () => {
    refs.invError = BOOM;
    sementara(await panggil());
    expect(refs.image).toBeNull();
    // Yang dilaporkan: SupabaseReadError berlabel, galat asli di `cause`.
    expect(reportHandledError).toHaveBeenCalledWith(
      expect.objectContaining({ name: "SupabaseReadError", cause: BOOM }),
      "og.load",
      { slug: "andi-sinta" },
    );
  });

  it("galat membaca jadwal → 503 no-store, BUKAN gambar bertanggal salah yang di-cache", async () => {
    refs.eventsError = BOOM;
    sementara(await panggil());
    expect(refs.image).toBeNull();
    expect(reportHandledError).toHaveBeenCalledTimes(1);
  });

  it("jadwal memang tanpa sesi berjam (tanpa galat) → tetap dirender (tanggal dari event_date)", async () => {
    refs.firstEvent = null;
    await panggil();
    expect(refs.image).not.toBeNull();
  });

  it("429 memancarkan no-store (tak boleh jadi jawaban ter-cache bagi semua scraper)", async () => {
    rateLimit.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });
    const res = await panggil();
    expect(res.status).toBe(429);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});

/**
 * Foto sampul (DECISIONS #122). Sejak og:image ter-cache edge, undangan
 * BERSAMPUL yang fotonya tak ikut terender — jaringan, 5xx, tipe salah, batas
 * waktu, atau 404 (sampul lama tanpa varian OG ATAU media salah konfigurasi:
 * `/media` menjawab 404 juga untuk galat volume) — tak boleh tertahan sehari
 * penuh: dulu path tanpa ekstensi tak ter-cache, jadi hit berikutnya merender
 * ulang dengan foto. 404 tak dilaporkan (bukan kerusakan yang bisa ditindak).
 */
describe("GET /api/og/[slug] — foto sampul", () => {
  const SAMPUL =
    "inv/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";
  const PENDEK = "public, max-age=60, s-maxage=300";
  const ambil = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(null, { status: 404 }),
  );

  beforeEach(() => {
    refs.inv = {
      ...(refs.inv as object),
      content: { ...emptyContent("wedding"), coverPhoto: { path: SAMPUL } },
    };
    ambil.mockClear();
    vi.stubGlobal("fetch", ambil);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sampul terbaca → gambar ber-cache panjang; diambil dengan batas 3 detik", async () => {
    const batas = vi.spyOn(AbortSignal, "timeout");
    ambil.mockResolvedValueOnce(
      new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
    const res = await panggil();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
    const [url, init] = ambil.mock.calls[0];
    expect(url).toBe(`https://media.test/${SAMPUL}/og.jpg`);
    // Sampul yang menggantung tak boleh menghabiskan jatah 7 detik WhatsApp.
    expect(batas).toHaveBeenCalledWith(3000);
    expect(init?.signal).toBe(batas.mock.results[0]?.value);
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("jaringan gagal → tetap 200 (tanpa foto) tetapi hanya ditahan edge 5 menit; dilaporkan", async () => {
    ambil.mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await panggil();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=300",
    );
    expect(reportHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      "og.cover",
      { slug: "andi-sinta" },
    );
  });

  it("5xx → TTL pendek yang sama; dilaporkan", async () => {
    ambil.mockResolvedValueOnce(
      new Response("galat", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    );
    const res = await panggil();
    expect(res.headers.get("Cache-Control")).toBe(PENDEK);
    expect(reportHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      "og.cover",
      { slug: "andi-sinta" },
    );
  });

  it("200 tetapi bukan JPEG (satori diam-diam membuang WebP) → TTL pendek; dilaporkan", async () => {
    ambil.mockResolvedValueOnce(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "content-type": "image/webp" },
      }),
    );
    const res = await panggil();
    expect(res.headers.get("Cache-Control")).toBe(PENDEK);
    expect(reportHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      "og.cover",
      { slug: "andi-sinta" },
    );
  });

  it("404 → TTL pendek juga (sampul lama ATAU media salah konfigurasi), tanpa laporan", async () => {
    ambil.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const res = await panggil();
    expect(ambil).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(PENDEK);
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("undangan TANPA sampul → cache panjang, tanpa mengambil apa pun", async () => {
    refs.inv = { ...(refs.inv as object), content: emptyContent("wedding") };
    const res = await panggil();
    expect(ambil).not.toHaveBeenCalled();
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
  });
});
