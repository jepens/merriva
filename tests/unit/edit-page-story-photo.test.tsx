import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman edit merakit `StoryPhotoSlot` (DECISIONS #127): bidang foto per entri
 * cerita HANYA bila tema aktif mendeklarasikan `media.story` (THEME-CONTRACT
 * §2), dan URL foto tersimpan HANYA untuk path milik undangan itu — path di
 * `content` ditulis klien. Memakai options tema ASLI (`getThemeOptions`), jadi
 * deklarasi Warta yang sebenarnya ikut teruji.
 */

type Res = { data: unknown; error: unknown };

const { refs } = vi.hoisted(() => ({
  refs: {
    inv: null as unknown,
    temaSlug: "warta",
    storyPhoto: undefined as unknown,
    photoSlots: undefined as unknown,
    settings: null as unknown,
    themePhotos: undefined as unknown,
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
    from: (table: string) =>
      chainOf(() => {
        if (table === "invitations") return { data: refs.inv, error: null };
        if (table === "packages")
          return { data: { limits: { watermark: false } }, error: null };
        if (table === "themes")
          return { data: { slug: refs.temaSlug }, error: null };
        return { data: [], error: null };
      }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => chainOf(() => ({ data: [], error: null })),
  }),
}));
// Yang diuji adalah props yang dirakit halaman, bukan editornya.
vi.mock("@/components/dashboard/editor/wedding-editor", () => ({
  WeddingEditor: (props: { storyPhoto?: unknown; photoSlots?: unknown }) => {
    refs.storyPhoto = props.storyPhoto;
    refs.photoSlots = props.photoSlots;
    return null;
  },
}));
vi.mock("@/components/dashboard/editor/corporate-editor", () => ({
  CorporateEditor: (props: { storyPhoto?: unknown }) => {
    refs.storyPhoto = props.storyPhoto ?? "tak-dikirim";
    return null;
  },
}));

import EditInvitationPage from "@/app/(dashboard)/dashboard/undangan/[id]/edit/page";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";
import { wartaOptions } from "@/themes/warta/options";

const ID = "9a500f03-f12d-4d66-85fc-af8ebcedd350";
const LAIN = "11111111-2222-4333-8444-555555555555";
const SENDIRI = `inv/${ID}/foto/12121212-3434-4565-8787-909090909090`;
const ASING = `inv/${LAIN}/foto/12121212-3434-4565-8787-909090909090`;

async function buka(category: "wedding" | "corporate" = "wedding") {
  refs.inv = {
    id: ID,
    slug: "draft-abc",
    category,
    status: "active",
    content:
      category === "wedding"
        ? {
            ...emptyContent("wedding"),
            story: [
              { title: "A", narrative: "a", photo: { path: SENDIRI } },
              { title: "B", narrative: "b", photo: ASING },
              { title: "C", narrative: "c" },
            ],
            ...(refs.themePhotos ? { themePhotos: refs.themePhotos } : {}),
          }
        : emptyContent("corporate"),
    settings: refs.settings ?? DEFAULT_SETTINGS,
    event_date: null,
    package_id: "pkg-basic",
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
  return refs.storyPhoto;
}

beforeEach(() => {
  refs.temaSlug = "warta";
  refs.storyPhoto = undefined;
  refs.photoSlots = undefined;
  refs.settings = null;
  refs.themePhotos = undefined;
});
afterEach(cleanup);

describe("halaman edit — slot foto cerita", () => {
  it("Warta: rasio bergiliran dari options tema + URL HANYA untuk foto milik undangan ini", async () => {
    expect(await buka()).toEqual({
      aspect: [4 / 3, 3 / 4],
      galleryFallback: true,
      urls: { [SENDIRI]: `/media/${SENDIRI}/1600.webp` },
    });
  });

  it("tema tanpa media.story → null (bidang unggah tak tampil)", async () => {
    refs.temaSlug = "eternal-rose";
    expect(await buka()).toBeNull();
  });

  it("kategori tanpa love story → tak ada slot", async () => {
    expect(await buka("corporate")).toBe("tak-dikirim");
  });
});

describe("halaman edit — Warta Edisi Indonesia & foto berita (#130, #131)", () => {
  const custom = (variant: string) => ({
    v: 1,
    variant,
    accent: null,
    fontPair: wartaOptions.fontPairs[0]!.id,
    sections: wartaOptions.sections.map((s) => ({ id: s.id, visible: true })),
    styles: {},
    motion: "full",
    grain: true,
  });

  it("varian tersimpan Edisi Indonesia → bingkai foto cerita ±8:9 lalu ±5:7", async () => {
    refs.settings = { ...DEFAULT_SETTINGS, custom: custom("indonesia") };
    expect(await buka()).toMatchObject({ aspect: [8 / 9, 5 / 7] });
  });

  it("varian lain / id tak dikenal → bingkai bawaan Warta", async () => {
    refs.settings = { ...DEFAULT_SETTINGS, custom: custom("sepia") };
    expect(await buka()).toMatchObject({ aspect: [4 / 3, 3 / 4] });
    refs.settings = { ...DEFAULT_SETTINGS, custom: custom("tak-ada") };
    expect(await buka()).toMatchObject({ aspect: [4 / 3, 3 / 4] });
  });

  it("slot x-berita: label dari tema; URL hanya untuk foto milik undangan ini", async () => {
    refs.themePhotos = { "x-berita": { path: SENDIRI } };
    await buka();
    expect((refs.photoSlots as Record<string, unknown>)["x-berita"]).toEqual({
      aspect: 3 / 2,
      url: `/media/${SENDIRI}/1600.webp`,
      inTheme: true,
      label: "Foto berita utama",
    });

    refs.themePhotos = { "x-berita": ASING };
    await buka();
    expect(
      (refs.photoSlots as Record<string, { url: unknown }>)["x-berita"]?.url,
    ).toBeNull();
  });
});
