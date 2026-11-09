import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman edit merakit `MusicSlotView` (DECISIONS #121): `path` + `url` lagu
 * tersimpan HANYA bila objeknya masih hidup menurut `music_uploads`. Objek yang
 * sudah disapu cron / di-takedown tak boleh diberi pemutar (URL 404), dan
 * `path` memberi tahu editor untuk rujukan mana `url` itu berlaku.
 *
 * `music_uploads` hanya service_role → dibaca lewat admin client, sesudah
 * undangan terbaca lewat client pemilik (RLS), dan hanya bila ada rujukan.
 */

type Res = { data: unknown; error: unknown };

const { refs } = vi.hoisted(() => ({
  refs: {
    inv: null as unknown,
    uploads: { data: [], error: null } as Res,
    reads: [] as string[],
    music: null as unknown,
  },
}));

function chainOf(res: () => Res) {
  const chain: Record<string, unknown> = {};
  for (const op of ["select", "eq", "order", "is", "limit"]) {
    chain[op] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve(res());
  chain.then = (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) =>
    Promise.resolve(res()).then(ok, fail);
  return chain;
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/server/guards/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1" })),
  isPaymentExempt: vi.fn(async () => false),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ getPublicUrl: (p: string) => `/media/${p}` }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      refs.reads.push(`server:${table}`);
      return chainOf(() => {
        if (table === "invitations") return { data: refs.inv, error: null };
        if (table === "packages")
          return { data: { limits: { watermark: false } }, error: null };
        if (table === "themes") return { data: null, error: null };
        return { data: [], error: null };
      });
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      refs.reads.push(`admin:${table}`);
      return chainOf(() => refs.uploads);
    },
  }),
}));
// Yang diuji adalah props yang dirakit halaman, bukan editornya.
vi.mock("@/components/dashboard/editor/wedding-editor", () => ({
  WeddingEditor: (props: { music: unknown }) => {
    refs.music = props.music;
    return null;
  },
}));

import EditInvitationPage from "@/app/(dashboard)/dashboard/undangan/[id]/edit/page";
import { SupabaseReadError } from "@/lib/supabase/result";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";

const ID = "9a500f03-f12d-4d66-85fc-af8ebcedd350";
const LAGU = `audio/${ID}/12121212-3434-4565-8787-909090909090.mp3`;

async function buka(customMusic?: unknown) {
  refs.inv = {
    id: ID,
    slug: "draft-abc",
    category: "wedding",
    status: "active",
    content: {
      ...emptyContent("wedding"),
      ...(customMusic ? { customMusic } : {}),
    },
    settings: DEFAULT_SETTINGS,
    event_date: null,
    package_id: "pkg-premium",
    theme_id: "t-1",
    user_id: "u-1",
    music_locked_at: null,
  };
  render(
    await EditInvitationPage({
      params: Promise.resolve({ id: ID }),
      searchParams: Promise.resolve({}),
    }),
  );
  return refs.music as {
    allowed: boolean;
    path: string | null;
    url: string | null;
  };
}

beforeEach(() => {
  refs.uploads = { data: [], error: null };
  refs.reads = [];
  refs.music = null;
});
afterEach(cleanup);

describe("halaman edit — slot lagu sendiri", () => {
  it("objek masih hidup → path + URL domain sendiri, dibaca lewat admin client sesudah client pemilik", async () => {
    refs.uploads = { data: [{ path: LAGU }], error: null };
    const music = await buka({ path: LAGU, name: "lagu.mp3" });
    expect(music).toMatchObject({ allowed: true, path: LAGU });
    expect(music.url).toBe(`/media/${LAGU}`);
    expect(refs.reads).toContain("admin:music_uploads");
    expect(refs.reads).not.toContain("server:music_uploads");
    expect(refs.reads.indexOf("server:invitations")).toBeLessThan(
      refs.reads.indexOf("admin:music_uploads"),
    );
  });

  it.each([
    ["tak ada baris hidup (disapu cron / takedown)", []],
    [
      "hanya objek lain yang hidup",
      [{ path: `audio/${ID}/99999999-9999-4999-8999-999999999999.mp3` }],
    ],
  ])("%s → path & URL null (tanpa pemutar 404)", async (_label, rows) => {
    refs.uploads = { data: rows, error: null };
    const music = await buka({ path: LAGU, name: "lagu.mp3" });
    expect(music.path).toBeNull();
    expect(music.url).toBeNull();
  });

  it.each([
    ["tanpa lagu sendiri", undefined],
    [
      "path undangan lain",
      {
        path: "audio/11111111-2222-4333-8444-555555555555/12121212-3434-4565-8787-909090909090.mp3",
      },
    ],
  ])("%s → null TANPA membaca music_uploads", async (_label, customMusic) => {
    const music = await buka(customMusic);
    expect(music.path).toBeNull();
    expect(music.url).toBeNull();
    expect(refs.reads).not.toContain("admin:music_uploads");
  });

  it("galat DB membaca music_uploads → DILEMPAR, bukan slot kosong (#45)", async () => {
    refs.uploads = { data: null, error: { message: "fetch failed" } };
    await expect(buka({ path: LAGU })).rejects.toBeInstanceOf(
      SupabaseReadError,
    );
  });
});
