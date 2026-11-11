import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { defaultCustomSettings } from "@/lib/customizer/theme-options";
import type { Edisi } from "@/themes/warta/labels";
import type { PhotoView } from "@/types/invitation";

/**
 * Akar tema Warta: `data-variant` = id varian TERSELESAIKAN (DECISIONS #130) —
 * kunci yang menyaring judul dua edisi di CSS — dan foto berita utama
 * (`data.themePhotos["x-berita"]`) sampai ke halaman Berita. Section & sampul
 * diganti tiruan pencatat props: yang diuji di sini hanyalah perakitan di
 * `index.tsx`; isi section diuji di warta-edisi.test.tsx.
 */

const { heroProps, coverProps } = vi.hoisted(() => ({
  heroProps: [] as { photo?: PhotoView | null }[],
  coverProps: [] as { edisi: Edisi; tickerLine: string[] }[],
}));

// next/font hanya hidup di kompiler Next — di test cukup nama variabelnya.
vi.mock("next/font/local", () => ({
  default: (o: { variable: string }) => ({
    variable: `font-${o.variable.slice(2)}`,
    className: "",
    style: { fontFamily: "" },
  }),
}));
vi.mock("@/themes/warta/sections", () => {
  const Kosong = () => null;
  return {
    Hero: (p: { photo?: PhotoView | null }) => {
      heroProps.push(p);
      return <section data-testid="hero" />;
    },
    QuoteBox: Kosong,
    Couple: Kosong,
    Story: Kosong,
    CountdownBlock: Kosong,
    Schedule: Kosong,
    VideoSection: Kosong,
    Rsvp: Kosong,
    Gallery: Kosong,
    Envelope: Kosong,
    Footer: Kosong,
  };
});
vi.mock("@/themes/warta/cover", () => ({
  WartaCover: (p: { edisi: Edisi; tickerLine: string[] }) => {
    coverProps.push(p);
    return null;
  },
}));
vi.mock("@/themes/warta/fx", () => ({ WartaFx: () => null }));
vi.mock("@/themes/_shared/lightbox", () => ({
  Lightbox: ({ children }: { children: ReactNode }) => children,
}));

import WartaTheme from "@/themes/warta";
import { demoInvitationData } from "@/themes/warta/demo-data";
import { wartaOptions } from "@/themes/warta/options";

beforeAll(() => {
  // `useMotionTier` membaca matchMedia; jsdom tak punya.
  vi.stubGlobal(
    "matchMedia",
    (q: string): MediaQueryList =>
      ({
        matches: false,
        media: q,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const FOTO: PhotoView = {
  url: "https://cdn.test/berita.webp",
  x: 0.4,
  y: 0.2,
  zoom: 1,
};

function renderVarian(variant: string | null, themePhotos?: InvitationPhotos) {
  heroProps.length = 0;
  coverProps.length = 0;
  const data = {
    ...demoInvitationData,
    themePhotos,
    settings: {
      ...demoInvitationData.settings,
      custom: variant
        ? { ...defaultCustomSettings(wartaOptions), variant }
        : undefined,
    },
  };
  return render(<WartaTheme data={data} />);
}
type InvitationPhotos = Readonly<Record<string, PhotoView>> | undefined;

describe("akar Warta — data-variant & foto berita", () => {
  it("Edisi Indonesia: data-variant di akar, sampul & ticker berbahasa Indonesia", () => {
    const { container } = renderVarian("indonesia");
    const akar = container.querySelector(".wt");
    expect(akar).toHaveAttribute("data-variant", "indonesia");
    // Font Dhaksinarga diekspos di akar seperti font Warta lain.
    expect(akar?.className).toContain("font-wt-jawa");
    expect(coverProps.at(-1)?.edisi).toBe("id");
    expect(coverProps.at(-1)?.tickerLine[0]).toBe("Catat Tanggalnya");
  });

  it("varian lain: data-variant = id terselesaikan, sampul Inggris", () => {
    for (const v of ["koran", "sepia", "merah"]) {
      const { container, unmount } = renderVarian(v);
      expect(container.querySelector(".wt")).toHaveAttribute("data-variant", v);
      expect(coverProps.at(-1)?.edisi).toBe("en");
      expect(coverProps.at(-1)?.tickerLine[0]).toBe("Save the Date");
      unmount();
    }
  });

  it("id varian liar diselesaikan ke bawaan, bukan dipantulkan", () => {
    const { container } = renderVarian("ungu-palsu");
    expect(container.querySelector(".wt")).toHaveAttribute(
      "data-variant",
      "koran",
    );
    expect(coverProps.at(-1)?.edisi).toBe("en");
  });

  it("tanpa kustomisasi (cabang legacy): tanpa data-variant → edisi Inggris", () => {
    const { container } = renderVarian(null);
    expect(container.querySelector(".wt")).not.toHaveAttribute("data-variant");
    expect(coverProps.at(-1)?.edisi).toBe("en");
  });

  it("foto berita x-berita diteruskan ke Hero; tanpa foto → null", () => {
    renderVarian("indonesia", { "x-berita": FOTO, "x-lain": FOTO });
    expect(heroProps.at(-1)?.photo).toBe(FOTO);
    renderVarian("koran", { "x-lain": FOTO });
    expect(heroProps.at(-1)?.photo).toBeNull();
    renderVarian("koran", undefined);
    expect(heroProps.at(-1)?.photo).toBeNull();
  });
});
