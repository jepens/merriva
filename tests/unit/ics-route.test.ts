import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route `/api/ics/[slug]` — berkas kalender tamu hanya memuat sesi BERJAM
 * (DECISIONS #42). Klien palsu sengaja MENGABAIKAN `.not(...)` supaya yang
 * teruji adalah saringan aplikasi, bukan kebetulan query.
 */

vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit: vi.fn(async () => ({ ok: true })),
}));

const { refs, reportHandledError } = vi.hoisted(() => ({
  refs: {
    events: [] as Record<string, unknown>[],
    invError: null as unknown,
    eventsError: null as unknown,
    eventsQueried: 0,
  },
  reportHandledError: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({ reportHandledError }));

vi.mock("@/lib/supabase/admin", async () => {
  const { emptyContent } = await import("@/lib/validation/content");
  return {
    createSupabaseAdminClient: () => ({
      from: (table: string) => {
        const filters: Record<string, unknown> = {};
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        };
        chain.not = () => chain;
        chain.order = () => chain;
        chain.maybeSingle = () =>
          Promise.resolve({
            data: {
              id: "inv-1",
              slug: "andi-sinta",
              category: "wedding",
              content: emptyContent("wedding"),
              status: "active",
            },
            error: refs.invError,
          });
        chain.then = (
          ok: (v: unknown) => unknown,
          fail: (e: unknown) => unknown,
        ) => {
          if (table === "invitation_events") refs.eventsQueried += 1;
          return Promise.resolve({
            data:
              table === "invitation_events"
                ? refs.events.filter((e) => !filters.id || e.id === filters.id)
                : null,
            error: table === "invitation_events" ? refs.eventsError : null,
          }).then(ok, fail);
        };
        return chain;
      },
    }),
  };
});

import { GET } from "@/app/api/ics/[slug]/route";
import { checkClientRateLimit } from "@/lib/request-ip";

const DRAFT_ID = "11111111-1111-4111-8111-111111111111";
const AKAD_ID = "22222222-2222-4222-8222-222222222222";

function panggil(query = "") {
  return GET(new Request(`http://localhost/api/ics/andi-sinta${query}`), {
    params: Promise.resolve({ slug: "andi-sinta" }),
  });
}

beforeEach(() => {
  refs.invError = null;
  refs.eventsError = null;
  refs.eventsQueried = 0;
  reportHandledError.mockClear();
  refs.events = [
    {
      id: DRAFT_ID,
      name: "Resepsi",
      start_at: null,
      end_at: null,
      venue_name: "Gedung Mawar",
      address: null,
    },
    {
      id: AKAD_ID,
      name: "Akad",
      start_at: "2026-08-15T01:00:00Z",
      end_at: null,
      venue_name: null,
      address: null,
    },
  ];
});

describe("GET /api/ics/[slug]", () => {
  it("hanya sesi berjam yang masuk kalender", async () => {
    const res = await panggil();
    expect(res.status).toBe(200);
    const ics = await res.text();
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain(AKAD_ID);
    expect(ics).not.toContain(DRAFT_ID);
    expect(ics).not.toContain("Resepsi");
  });

  it("tautan ?e= ke sesi yang belum berjam → 404, bukan berkas rusak", async () => {
    const res = await panggil(`?e=${DRAFT_ID}`);
    expect(res.status).toBe(404);
  });

  it("nama sesi kosong memakai label cadangan", async () => {
    refs.events = [{ ...refs.events[1], name: "" }];
    const ics = await (await panggil()).text();
    expect(ics).toMatch(/SUMMARY:Acara/);
  });

  it("cache PENDEK: URL ?e= stabil lintas suntingan, jam lama tak boleh tersaji lama (DECISIONS #43)", async () => {
    const cc = (await panggil(`?e=${AKAD_ID}`)).headers.get("Cache-Control");
    const detik = (nama: string) =>
      Number(new RegExp(`(?:^|[ ,])${nama}=(\\d+)`).exec(cc ?? "")?.[1]);
    expect(detik("max-age")).toBeLessThanOrEqual(300);
    expect(detik("s-maxage")).toBeLessThanOrEqual(300);
  });

  it("404 memancarkan no-store: tanpa header, CDN/peramban memakai TTL bawaan (Cloudflare 4 jam)", async () => {
    const res = await panggil(`?e=${DRAFT_ID}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("429 juga no-store (dan tetap membawa Retry-After)", async () => {
    vi.mocked(checkClientRateLimit).mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });
    const res = await panggil();
    expect(res.status).toBe(429);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("?e= kosong → seluruh kalender, seperti sebelumnya (bukan 404)", async () => {
    const res = await panggil("?e=");
    expect(res.status).toBe(200);
    expect((await res.text()).match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  describe("galat DB (DECISIONS #45)", () => {
    const BOOM = Object.assign(new Error("koneksi DB terputus"), {
      code: "08006",
    });

    const sementara = (res: Response) => {
      expect(res.status).toBe(503);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(res.headers.get("Retry-After")).toBe("30");
    };

    it("membaca undangan gagal → 503 + Retry-After, BUKAN 404 'tak ada'; dilaporkan", async () => {
      refs.invError = BOOM;
      sementara(await panggil());
      expect(reportHandledError).toHaveBeenCalledWith(BOOM, "ics.invitation", {
        slug: "andi-sinta",
      });
    });

    it("membaca jadwal gagal → 503 + Retry-After, BUKAN 404 'tak ada sesi'; dilaporkan", async () => {
      refs.eventsError = BOOM;
      sementara(await panggil(`?e=${AKAD_ID}`));
      expect(reportHandledError).toHaveBeenCalledWith(BOOM, "ics.events", {
        slug: "andi-sinta",
      });
    });

    it.each(["a".repeat(61), "a".repeat(9000), "andi_sinta"])(
      "slug mustahil → 404 TANPA query & tanpa laporan (dulu 414 gateway → 503 + Sentry per hit)",
      async (slug) => {
        const res = await GET(new Request(`http://localhost/api/ics/${slug}`), {
          params: Promise.resolve({ slug }),
        });
        expect(res.status).toBe(404);
        expect(refs.eventsQueried).toBe(0);
        expect(reportHandledError).not.toHaveBeenCalled();
      },
    );

    it.each(["bukan-uuid", "' or 1=1 --"])(
      "?e=%j tak berbentuk UUID → 404 SEBELUM query (bukan 503 dari galat cast Postgres)",
      async (e) => {
        const res = await panggil(`?e=${encodeURIComponent(e)}`);
        expect(res.status).toBe(404);
        expect(refs.eventsQueried).toBe(0);
        expect(reportHandledError).not.toHaveBeenCalled();
      },
    );
  });
});
