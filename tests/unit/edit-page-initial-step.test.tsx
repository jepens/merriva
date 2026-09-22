import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman edit ASLI meneruskan `?langkah=` ke editor (DECISIONS #44). Test
 * komponen (editor-initial-step.test.tsx) membuktikan editor menghormati
 * `initialStep`; berkas ini menutup mata rantai halaman → editor, supaya
 * "Lengkapi jadwal" di halaman aktivasi benar-benar mendarat di langkah Jadwal
 * untuk KETIGA kategori.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("@/server/guards/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1" })),
}));
vi.mock("@/server/actions/invitation", () => ({
  saveInvitationDraftAction: vi.fn(async () => ({ status: "success" })),
  checkSlugAvailabilityAction: vi.fn(),
  updateInvitationSlugAction: vi.fn(),
}));
vi.mock("@/server/actions/media", () => ({
  deleteGalleryPhotoAction: vi.fn(),
  uploadGalleryPhotoAction: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ getPublicUrl: (p: string) => `/media/${p}` }),
}));

const { refs } = vi.hoisted(() => ({ refs: { inv: null as unknown } }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.maybeSingle = () =>
        Promise.resolve({ data: refs.inv, error: null });
      chain.then = (
        ok: (v: unknown) => unknown,
        fail: (e: unknown) => unknown,
      ) => Promise.resolve({ data: [], error: null }).then(ok, fail);
      return chain;
    },
  }),
}));

import EditInvitationPage from "@/app/(dashboard)/dashboard/undangan/[id]/edit/page";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";

const ID = "9a500f03-f12d-4d66-85fc-af8ebcedd350";

async function buka(
  category: "wedding" | "corporate" | "family",
  langkah?: string | string[],
) {
  refs.inv = {
    id: ID,
    slug: "draft-abc",
    category,
    status: "draft",
    content: emptyContent(category),
    settings: DEFAULT_SETTINGS,
    event_date: null,
    package_id: null,
  };
  render(
    await EditInvitationPage({
      params: Promise.resolve({ id: ID }),
      searchParams: Promise.resolve(langkah === undefined ? {} : { langkah }),
    }),
  );
}

const aktif = () =>
  document
    .querySelector('[aria-current="step"]')
    ?.getAttribute("data-step-key");

afterEach(cleanup);

describe.each(["wedding", "corporate", "family"] as const)(
  "halaman edit %s",
  (category) => {
    it("?langkah=jadwal → editor terbuka di langkah Jadwal", async () => {
      await buka(category, "jadwal");
      expect(aktif()).toBe("schedule");
    });

    it.each([undefined, "bogus", ["jadwal", "jadwal"]])(
      "?langkah=%j → langkah pertama",
      async (langkah) => {
        await buka(category, langkah);
        expect(aktif()).toBe("info");
      },
    );
  },
);
