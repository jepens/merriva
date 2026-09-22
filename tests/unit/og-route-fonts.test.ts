import { describe, expect, it, vi } from "vitest";

/**
 * Route OG saat font gagal dimuat (DECISIONS #45): 500 dengan `no-store`, bukan
 * respons tanpa `Cache-Control`. Berkas terpisah karena font dimuat SEKALI saat
 * modul diimpor — `readFile` harus sudah menolak sebelum route diimpor.
 */

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const readFile = vi.fn(async () => {
    throw new Error("ENOENT: font tak ditemukan");
  });
  return { ...actual, readFile, default: { ...actual, readFile } };
});
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit: vi.fn(async () => ({
    ok: true,
    remaining: 1,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError: vi.fn() }));
vi.mock("next/og", () => ({ ImageResponse: class {} }));
vi.mock("@/lib/supabase/admin", async () => {
  const { DEFAULT_SETTINGS, emptyContent } =
    await import("@/lib/validation/content");
  return {
    createSupabaseAdminClient: () => ({
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const op of ["select", "eq", "not", "order", "limit"]) {
          chain[op] = () => chain;
        }
        chain.maybeSingle = () =>
          Promise.resolve(
            table === "invitations"
              ? {
                  data: {
                    id: "inv-1",
                    category: "wedding",
                    content: emptyContent("wedding"),
                    settings: DEFAULT_SETTINGS,
                    event_date: null,
                    status: "active",
                  },
                  error: null,
                }
              : { data: null, error: null },
          );
        return chain;
      },
    }),
  };
});

import { GET } from "@/app/api/og/[slug]/route";

describe("GET /api/og/[slug] — font gagal dimuat", () => {
  it("→ 500 dengan no-store (jawaban galat tak boleh ter-cache)", async () => {
    const res = (await GET(new Request("http://localhost/api/og/andi-sinta"), {
      params: Promise.resolve({ slug: "andi-sinta" }),
    })) as Response;
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
