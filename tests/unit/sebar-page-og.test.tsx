import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman Sebar memanaskan gambar pratinjau tautan (DECISIONS #122). URL yang
 * diberikan ke komponen HARUS identik dengan og:image halaman undangan —
 * pemanasan URL lain mengisi entri cache yang tak pernah diminta WhatsApp —
 * dan HANYA untuk undangan aktif: hanya undangan aktif yang memancarkan
 * og:image.
 */

type Res = { data: unknown; error: unknown };

const { refs } = vi.hoisted(() => ({
  refs: { inv: null as unknown, ogImage: undefined as unknown },
}));

function chainOf(res: () => Res) {
  const chain: Record<string, unknown> = {};
  for (const op of ["select", "eq", "not", "order", "limit"]) {
    chain[op] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve(res());
  chain.then = (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) =>
    Promise.resolve(res()).then(ok, fail);
  return chain;
}

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/server/guards/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1" })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) =>
      chainOf(() =>
        table === "invitations"
          ? { data: refs.inv, error: null }
          : table === "invitation_events"
            ? { data: null, error: null }
            : { data: [], error: null },
      ),
  }),
}));
// Yang diuji adalah props yang dirakit halaman, bukan komponennya.
vi.mock("@/components/dashboard/sebar-undangan", () => ({
  SebarUndangan: (props: { ogImage: unknown }) => {
    refs.ogImage = props.ogImage;
    return null;
  },
}));

import SebarPage from "@/app/(dashboard)/dashboard/undangan/[id]/sebar/page";
import { ogImageUrl } from "@/lib/og/image-url";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";

const ID = "9a500f03-f12d-4d66-85fc-af8ebcedd350";
const DIUBAH = "2026-11-08T10:20:30.456789+00:00";

async function buka(status: string) {
  refs.inv = {
    id: ID,
    slug: "rani-wanda",
    status,
    updated_at: DIUBAH,
    category: "wedding",
    content: emptyContent("wedding"),
    settings: DEFAULT_SETTINGS,
    event_date: null,
    share_template: null,
    share_template_general: null,
  };
  render(await SebarPage({ params: Promise.resolve({ id: ID }) }));
  return refs.ogImage;
}

beforeEach(() => {
  refs.ogImage = undefined;
});
afterEach(cleanup);

describe("halaman Sebar — pemanasan gambar pratinjau tautan", () => {
  it("aktif → URL og:image persis seperti metadata halaman undangan", async () => {
    const url = await buka("active");
    expect(url).toBe(ogImageUrl("rani-wanda", DIUBAH));
    expect(url).toMatch(/^\/api\/og\/rani-wanda\.jpg\?v=\d+$/);
  });

  it.each(["draft", "pending_payment", "expired", "suspended"])(
    "%s → tak dipanaskan",
    async (status) => {
      expect(await buka(status)).toBeNull();
    },
  );
});
