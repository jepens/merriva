import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Foto khas tema (`content.themePhotos`, DECISIONS #131) — mis. "Foto berita
 * utama" Warta: bentuk data, penyaringan server, dan bidangnya di langkah
 * Galeri editor ASLI.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
const { saveInvitationDraftAction } = vi.hoisted(() => ({
  saveInvitationDraftAction: vi.fn(async (_id: string, _patch: unknown) => ({
    status: "success" as const,
  })),
}));
vi.mock("@/server/actions/invitation", () => ({
  saveInvitationDraftAction,
  checkSlugAvailabilityAction: vi.fn(),
  updateInvitationSlugAction: vi.fn(),
}));
vi.mock("@/server/actions/media", () => ({
  deleteGalleryPhotoAction: vi.fn(),
  uploadGalleryPhotoAction: vi.fn(),
}));
const { uploadNamedPhotoAction } = vi.hoisted(() => ({
  uploadNamedPhotoAction: vi.fn(
    async (_inv: string, _fd: FormData): Promise<unknown> => ({
      status: "error",
    }),
  ),
}));
vi.mock("@/server/actions/named-photo", () => ({
  uploadNamedPhotoAction,
  deleteNamedPhotoAction: vi.fn(async (_inv: string, _p: string) => ({
    status: "success",
  })),
}));
vi.mock("@/lib/image/compress", () => ({
  isSupportedImage: (f: File) => f.type.startsWith("image/"),
  compressToWebpVariants: vi.fn(async () => ({
    display: new File([new Uint8Array(10)], "d", { type: "image/webp" }),
    thumb: new File([new Uint8Array(5)], "t", { type: "image/webp" }),
    width: 1600,
    height: 1067,
  })),
  compressCoverVariants: vi.fn(),
}));

import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { copy } from "@/lib/copy";
import { parseContentForRender } from "@/lib/invitation-content";
import { OG_ASPECT } from "@/lib/media";
import {
  DEFAULT_SETTINGS,
  draftContentSchema,
  emptyContent,
  weddingContentSchema,
} from "@/lib/validation/content";
import { buildInvitationData } from "@/server/invitation-data";

const INV = "9a500f03-f12d-4d66-85fc-af8ebcedd350";
const LAIN = "11111111-2222-4333-8444-555555555555";
const foto = (n: number, inv = INV) =>
  `inv/${inv}/foto/${String(n).repeat(8)}-1111-4111-8111-111111111111`;
const WEDDING = {
  ...emptyContent("wedding"),
  groom: { name: "Andi" },
  bride: { name: "Sinta" },
};

afterEach(cleanup);

describe("skema themePhotos", () => {
  it("objek & string lama diterima; kunci di luar pola dan foto rusak gugur SENDIRI", () => {
    const raw = JSON.parse(
      JSON.stringify({
        ...WEDDING,
        themePhotos: {
          "x-berita": { path: foto(1), x: 0.2, y: 0.3, zoom: 2 },
          "x-lain": foto(2),
          cover: foto(3),
          "x-rusak": "https://vendor.test/a.webp",
        },
      }).replace('"cover"', '"__proto__"'),
    );
    const r = weddingContentSchema.safeParse(raw);
    expect(r.success).toBe(true);
    expect(r.data?.themePhotos).toEqual({
      "x-berita": { path: foto(1), x: 0.2, y: 0.3, zoom: 2 },
      "x-lain": { path: foto(2), x: 0.5, y: 0.5, zoom: 1 },
    });
    expect(Object.getPrototypeOf(r.data?.themePhotos)).toBe(Object.prototype);
  });

  it("bukan objek / kosong → undefined, tak menjatuhkan konten", () => {
    for (const v of [[], "x", 42, {}, { "x-a": null }]) {
      const r = weddingContentSchema.safeParse({ ...WEDDING, themePhotos: v });
      expect(r.success).toBe(true);
      expect(r.data?.themePhotos).toBeUndefined();
    }
  });

  it("ikut ke pratinjau draft yang belum lolos skema ketat", () => {
    const c = parseContentForRender(
      {
        ...emptyContent("wedding"),
        themePhotos: { "x-berita": foto(1) },
      },
      "wedding",
    );
    expect(c.themePhotos?.["x-berita"]?.path).toBe(foto(1));
  });
});

describe("buildInvitationData — themePhotos", () => {
  function dengan(themePhotos: unknown) {
    return buildInvitationData({
      invitationId: INV,
      slug: "andi-sinta",
      category: "wedding",
      content: { ...WEDDING, themePhotos },
      settings: DEFAULT_SETTINGS,
      eventDate: null,
      eventRows: [],
      mediaRows: [],
      watermark: false,
      videoAllowed: true,
      maxPhotos: 20,
      themeOptions: null,
      music: null,
      musicLocked: false,
      liveMusicPaths: [],
    });
  }

  it("varian DISPLAY + titik fokus; path milik undangan LAIN tak di-resolve", () => {
    const d = dengan({
      "x-berita": { path: foto(1), x: 0.3, y: 0.6, zoom: 1.5 },
      "x-asing": foto(2, LAIN),
    });
    expect(Object.keys(d.themePhotos ?? {})).toEqual(["x-berita"]);
    expect(d.themePhotos?.["x-berita"]?.url).toMatch(
      new RegExp(`/${foto(1)}/1600\\.webp$`),
    );
    expect(d.themePhotos?.["x-berita"]).toMatchObject({
      x: 0.3,
      y: 0.6,
      zoom: 1.5,
    });
  });

  it("tanpa foto (atau semuanya asing) → tak ada kunci themePhotos", () => {
    expect(dengan(undefined)).not.toHaveProperty("themePhotos");
    expect(dengan({ "x-asing": foto(2, LAIN) })).not.toHaveProperty(
      "themePhotos",
    );
  });
});

describe("editor — langkah Galeri", () => {
  function props(
    photoSlots: ComponentProps<typeof WeddingEditor>["photoSlots"],
  ): ComponentProps<typeof WeddingEditor> {
    return {
      invitationId: INV,
      slug: "draft-abc",
      defaultValues: {
        eventDate: "",
        content: draftContentSchema.parse(emptyContent("wedding")),
        settings: DEFAULT_SETTINGS,
        events: [],
      },
      initialMedia: [],
      maxPhotos: 8,
      songs: [],
      photoSlots,
      music: { allowed: false, lockedAt: null, path: null, url: null },
      video: { allowed: false, url: null, posterUrl: null },
      initialStep: "gallery",
    };
  }
  const SAMPUL = { aspect: OG_ASPECT, url: null };

  it("tema dengan slot `x-` → bidang berlabel dari tema, di bawah sampul", () => {
    render(
      <WeddingEditor
        {...props({
          cover: SAMPUL,
          "x-berita": {
            aspect: 3 / 2,
            url: null,
            inTheme: true,
            label: "Foto berita utama",
          },
        })}
      />,
    );
    expect(screen.getByText("Foto berita utama")).toBeInTheDocument();
    expect(screen.getByText(copy.editor.photo.themeHint)).toBeInTheDocument();
  });

  it("tema tanpa slot `x-` → tak ada bidang foto khas tema", () => {
    render(<WeddingEditor {...props({ cover: SAMPUL })} />);
    expect(screen.queryByText(copy.editor.photo.themeHint)).toBeNull();
  });

  it("unggah → `{ path, x, y, zoom }` tersimpan di content.themePhotos[id]", async () => {
    uploadNamedPhotoAction.mockResolvedValue({
      status: "success",
      path: foto(7),
      url: `/media/${foto(7)}/1600.webp`,
    });
    render(
      <WeddingEditor
        {...props({
          cover: SAMPUL,
          "x-berita": {
            aspect: 3 / 2,
            url: null,
            inTheme: true,
            label: "Foto berita utama",
          },
        })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Foto berita utama"), {
      target: {
        files: [new File([new Uint8Array(9)], "f.jpg", { type: "image/jpeg" })],
      },
    });
    await waitFor(
      () => {
        const terakhir = saveInvitationDraftAction.mock.calls.at(-1)?.[1] as
          | { content?: { themePhotos?: Record<string, { path: string }> } }
          | undefined;
        expect(terakhir?.content?.themePhotos?.["x-berita"]).toEqual({
          path: foto(7),
          x: 0.5,
          y: 0.5,
          zoom: 1,
        });
      },
      { timeout: 4000 },
    );
  });
});
