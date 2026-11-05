import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Aksi kustomisasi tampilan saat DB berkedip (DECISIONS #45):
 *  - `getEffectiveLimits` kini MELEMPAR galat DB alih-alih pura-pura Basic →
 *    aksi membalas galat biasa: tak menolak kustomisasi Premium milik pemilik
 *    Premium, tak melempar ke klien (editor tampilan tak punya penangkapnya);
 *  - galat membaca tema bukan "tema belum mendukung kustomisasi" (pesan
 *    permanen yang keliru);
 *  - keduanya tak menulis apa pun dan DILAPORKAN ke Sentry (galat yang
 *    ditangani tak sampai `onRequestError`).
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ID = "9a500f03-f12d-4d66-85fc-af8ebcedd350";

const { refs, limits, reportHandledError } = vi.hoisted(() => ({
  refs: {
    updates: 0,
    themeError: null as unknown,
    settings: {} as unknown,
    lastUpdate: null as unknown,
    themeSlug: "aria",
  },
  limits: vi.fn(),
  reportHandledError: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("@/server/limits", () => ({ getEffectiveLimits: limits }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.update = (payload: unknown) => {
        refs.updates += 1;
        refs.lastUpdate = payload;
        return chain;
      };
      chain.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(ok);
      chain.maybeSingle = () =>
        Promise.resolve(
          table === "invitations"
            ? {
                data: {
                  id: ID,
                  slug: "andi-sinta",
                  settings: refs.settings,
                  theme_id: "t-1",
                  package_id: "pkg-premium",
                },
                error: null,
              }
            : refs.themeError
              ? { data: null, error: refs.themeError }
              : { data: { slug: refs.themeSlug }, error: null },
        );
      return chain;
    },
  }),
}));

import { copy } from "@/lib/copy";
import { defaultCustomSettings } from "@/lib/customizer/theme-options";
import { updateInvitationAppearanceAction } from "@/server/actions/appearance";
import { eternalRoseOptions as opts } from "@/themes/eternal-rose/options";

const GAGAL = { message: "TypeError: fetch failed", code: "" };

beforeEach(() => {
  refs.updates = 0;
  refs.themeError = null;
  refs.settings = {};
  refs.lastUpdate = null;
  refs.themeSlug = "aria";
  limits.mockReset();
  reportHandledError.mockClear();
});

describe("updateInvitationAppearanceAction — galat DB", () => {
  it("galat membaca paket → galat biasa, TANPA menulis dan TANPA melempar; dilaporkan", async () => {
    const boom = new Error("packages: koneksi DB terputus");
    limits.mockRejectedValue(boom);
    const res = await updateInvitationAppearanceAction(ID, {});
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(refs.updates).toBe(0);
    // Benar-benar sampai ke pembacaan paket (bukan tertolak lebih awal).
    // Pemilik diteruskan agar draft admin/Pro memakai paket teratas (#115).
    expect(limits).toHaveBeenCalledWith(
      expect.anything(),
      "pkg-premium",
      "u-1",
    );
    expect(reportHandledError).toHaveBeenCalledWith(boom, "appearance.limits", {
      id: ID,
    });
  });

  it("galat membaca tema → galat biasa (BUKAN 'tema belum mendukung kustomisasi'); dilaporkan", async () => {
    refs.themeError = GAGAL;
    const res = await updateInvitationAppearanceAction(ID, {});
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(res).not.toEqual(
      expect.objectContaining({ message: copy.appearance.unsupported }),
    );
    expect(refs.updates).toBe(0);
    expect(limits).not.toHaveBeenCalled();
    expect(reportHandledError).toHaveBeenCalledWith(GAGAL, "appearance.theme", {
      id: ID,
    });
  });
});

describe("updateInvitationAppearanceAction — simpanan non-Premium (DECISIONS #116)", () => {
  // Pilihan Premium yang tersimpan (mis. sebelum alih kepemilikan ke pelanggan
  // Basic). Editor non-Premium hanya bisa mengirim nilai bawaan untuknya.
  // Eternal Rose: punya gaya galeri & mendukung aksen kustom.
  beforeEach(() => {
    refs.themeSlug = "eternal-rose";
  });
  const tersimpan = () => {
    const c = defaultCustomSettings(opts);
    c.fontPair = opts.fontPairs.at(-1)!.id;
    c.accent = "#aa3355";
    c.styles = Object.fromEntries(
      Object.entries(opts.styles).map(([k, v]) => [k, v.at(-1)!]),
    );
    return c;
  };
  // Kiriman Basic: font/gaya/aksen bawaan (hanya itu yang lolos gerbang), tetapi
  // urutan/visibilitas, motion & grain DIUBAH — kiriman yang harus menang.
  const kiriman = () => {
    const c = defaultCustomSettings(opts);
    c.sections = c.sections.map((x) =>
      x.id === "gallery" ? { ...x, visible: false } : x,
    );
    c.motion = "calm";
    c.grain = false;
    return c;
  };
  const customTertulis = () =>
    (refs.lastUpdate as { settings: { custom: Record<string, unknown> } })
      .settings.custom;

  it("Basic: font/gaya/aksen tersimpan TIDAK ditimpa bawaan; sisanya dari kiriman", async () => {
    limits.mockResolvedValue({ watermark: true });
    refs.settings = { custom: tersimpan() };

    const res = await updateInvitationAppearanceAction(ID, kiriman());

    expect(res.status).toBe("success");
    expect(customTertulis()).toEqual({
      ...kiriman(),
      fontPair: tersimpan().fontPair,
      accent: "#aa3355",
      styles: tersimpan().styles,
    });
  });

  it("Basic ganti varian: aksen lama dilepas (melekat pada variannya), font & gaya tetap", async () => {
    limits.mockResolvedValue({ watermark: true });
    refs.settings = { custom: tersimpan() };
    const c = kiriman();
    c.variant = opts.variants.at(-1)!.id;
    expect(c.variant).not.toBe(tersimpan().variant);

    await updateInvitationAppearanceAction(ID, c);

    expect(customTertulis()).toEqual({
      ...c,
      fontPair: tersimpan().fontPair,
      accent: null,
      styles: tersimpan().styles,
    });
  });

  it("Basic tanpa kustomisasi tersimpan: kiriman disimpan apa adanya", async () => {
    limits.mockResolvedValue({ watermark: true });

    await updateInvitationAppearanceAction(ID, kiriman());

    expect(customTertulis()).toEqual(kiriman());
  });

  it("Premium: kiriman pemilik disimpan apa adanya", async () => {
    limits.mockResolvedValue({ watermark: false });
    refs.settings = { custom: tersimpan() };

    await updateInvitationAppearanceAction(ID, kiriman());

    expect(customTertulis()).toEqual(kiriman());
  });
});
