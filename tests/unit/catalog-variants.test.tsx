import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Varian = kartu katalog (THEME-WAVE3 §4, keputusan owner 1 Okt 2026).
 *
 * Dua janji yang dijaga di sini. (1) `/tema` merender satu kartu per (tema ×
 * varian) yang dibaca dari `options.ts` — urut tema lalu varian, kategori/tier
 * diwarisi induk agar saringan tetap bekerja. (2) `?variant=` di pratinjau
 * hanyalah PILIHAN dari whitelist options tema itu: isian lain jatuh ke bawaan
 * dan tak pernah dipantulkan. Palet varian sengaja dibaca dari registry, bukan
 * ditulis ulang di sini — warnanya boleh dikurasi ulang tanpa test ini ikut
 * berbohong.
 */

// Thumbnail ADA untuk semua tema: kartu varian non-bawaan tetap wajib poster.
vi.mock("@/server/theme-thumbs", () => ({ hasThemeThumb: () => true }));
vi.mock("@/components/theme-mockup", () => ({
  ThemeMockup: ({ slug }: { slug: string }) => (
    <div data-testid="mockup">{slug}</div>
  ),
}));

import {
  posterNameColor,
  ThemeCard,
} from "@/components/marketing/theme-poster";
import { copy } from "@/lib/copy";
import {
  contrastRatio,
  hexToRgb,
  relativeLuminance,
} from "@/lib/customizer/contrast-guard";
import { resolveAppearance } from "@/lib/customizer/resolve";
import { defaultCustomSettings } from "@/lib/customizer/theme-options";
import { settingsSchema } from "@/lib/validation/content/settings";
import {
  expandThemeVariants,
  pickPreviewVariant,
  themePreviewHref,
  type MarketingTheme,
} from "@/server/marketing/catalog";
import { getThemeCatalogMeta } from "@/themes/catalog-meta";
import { getThemeDemoLoader } from "@/themes/demo-data-registry";
import { getThemeLoader, themeRegistry } from "@/themes/registry";
import {
  getThemeOptions,
  themeOptionsRegistry,
} from "@/themes/theme-options-registry";

afterEach(cleanup);

function tema(
  slug: string,
  over: Partial<MarketingTheme> = {},
): MarketingTheme {
  return {
    slug,
    name: slug,
    categories: ["wedding"],
    tier: "standard",
    hasDemo: true,
    meta: getThemeCatalogMeta(slug),
    ...over,
  };
}

function opsi(slug: string) {
  const o = getThemeOptions(slug);
  if (!o) throw new Error(`options hilang untuk ${slug}`);
  return o;
}

function kartu(slug: string, variantId: string): MarketingTheme {
  const k = expandThemeVariants([tema(slug)]).find(
    (c) => c.variant?.id === variantId,
  );
  if (!k) throw new Error(`kartu ${slug}:${variantId} tak ada`);
  return k;
}

const SEMUA_TEMA = Object.keys(themeRegistry);

describe("expandThemeVariants — satu kartu per (tema × varian)", () => {
  it("semua tema terdaftar: tiap varian options jadi kartu, urut tema lalu varian", () => {
    const cards = expandThemeVariants(SEMUA_TEMA.map((s) => tema(s)));
    const harapan = SEMUA_TEMA.flatMap((s) =>
      opsi(s).variants.map((v) => `${s}:${v.id}`),
    );
    expect(cards.map((c) => `${c.slug}:${c.variant?.id}`)).toEqual(harapan);
    // Urutan masukan = `sort_order` DB; ekspansi tak boleh mengacaknya.
    const urutanTema = [...new Set(cards.map((c) => c.slug))];
    expect(urutanTema).toEqual(SEMUA_TEMA);
  });

  it("kategori & tier diwarisi tema induk → saringan kategori tetap bekerja", () => {
    const cards = expandThemeVariants([
      tema("festa", { categories: ["family"], tier: "standard" }),
      tema("meridian", { categories: ["corporate"], tier: "premium" }),
      tema("lumina", { categories: ["family", "wedding"], tier: "standard" }),
    ]);
    const korporat = cards.filter((c) => c.categories.includes("corporate"));
    expect(korporat).toHaveLength(opsi("meridian").variants.length);
    expect(korporat.every((c) => c.tier === "premium")).toBe(true);

    const keluarga = cards.filter((c) => c.categories.includes("family"));
    expect(keluarga.map((c) => c.slug)).toEqual([
      ...opsi("festa").variants.map(() => "festa"),
      ...opsi("lumina").variants.map(() => "lumina"),
    ]);
  });

  it("tema tanpa options → tetap satu kartu persis seperti sebelumnya", () => {
    const t = tema("tema-tanpa-options");
    expect(expandThemeVariants([t])).toEqual([t]);
  });

  it("tema tanpa demo → satu kartu (kartu varian ada untuk dibuka pratinjaunya)", () => {
    const t = tema("meihua", { hasDemo: false });
    expect(expandThemeVariants([t])).toEqual([t]);
  });

  it("kartu bawaan memakai meta kurasi tema; varian lain memakai palet variannya", () => {
    for (const slug of SEMUA_TEMA) {
      const [bawaan, ...lain] = expandThemeVariants([tema(slug)]);
      const variants = opsi(slug).variants;
      expect(bawaan?.variant).toEqual({
        id: variants[0]?.id,
        name: variants[0]?.name,
        isDefault: true,
      });
      expect(bawaan?.meta).toBe(getThemeCatalogMeta(slug));

      lain.forEach((c, i) => {
        const v = variants[i + 1]!;
        const label = `${slug}:${v.id}`;
        expect(c.variant?.isDefault, label).toBe(false);
        expect(c.meta, label).toMatchObject({
          bg: v.paper,
          ink: v.ink,
          accent: v.acc,
          ornament: getThemeCatalogMeta(slug).ornament,
        });
        // Teks poster = tinta di atas kertas → wajib AA (aturan catalog-meta).
        expect(
          contrastRatio(c.meta.ink, c.meta.bg),
          label,
        ).toBeGreaterThanOrEqual(4.5);
        // Poster gelap ⇔ teksnya lebih terang dari kertasnya.
        expect(c.meta.dark, label).toBe(
          relativeLuminance(c.meta.ink) > relativeLuminance(c.meta.bg),
        );
      });
    }
  });

  it("flag dark mengikuti kertas varian, bukan tema induk", () => {
    // Meihua bawaan gelap (merah lacquer) tetapi Champagne berkertas ivory.
    expect(kartu("meihua", "champagne").meta.dark).toBe(false);
    expect(kartu("meihua", "burgundy").meta.dark).toBe(true);
    expect(kartu("noir", "silver").meta.dark).toBe(true);
    expect(kartu("eternal-rose", "sage").meta.dark).toBe(false);
  });
});

describe("poster kartu varian — nama berwarna aksen", () => {
  const SEMUA_KARTU = expandThemeVariants(SEMUA_TEMA.map((s) => tema(s)));

  it("warna nama lolos AA di atas kertas poster", () => {
    for (const c of SEMUA_KARTU) {
      const warna = posterNameColor(c.meta) ?? c.meta.ink;
      expect(
        contrastRatio(warna, c.meta.bg),
        `${c.slug}:${c.variant?.id}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("varian berkertas sama tetap terbedakan lewat warna nama", () => {
    // Sepuluh tema lama hanya mengganti aksen; nama bertinta sama membuat
    // kartu-kartu varian satu tema tampil kembar.
    for (const slug of SEMUA_TEMA) {
      const kunci = SEMUA_KARTU.filter(
        (c) => c.slug === slug && !c.variant?.isDefault,
      ).map((c) => `${c.meta.bg}|${posterNameColor(c.meta) ?? c.meta.ink}`);
      expect(new Set(kunci).size, slug).toBe(kunci.length);
    }
  });

  it("aksen yang kurang kontras di kertas terang digelapkan, bukan dipakai mentah", () => {
    const meta = {
      ...getThemeCatalogMeta("festa"),
      bg: "#fff7e8",
      accent: "#f5b93f",
    };
    const warna = posterNameColor(meta);
    expect(warna).not.toBe("#f5b93f");
    expect(contrastRatio(warna!, meta.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("kertas gelap dgn aksen kurang kontras → tinta (menggelapkan tak menolong)", () => {
    const meta = {
      ...getThemeCatalogMeta("noir"),
      accent: "#1a1a1a",
    };
    expect(posterNameColor(meta)).toBeUndefined();
  });
});

describe("pickPreviewVariant — whitelist `?variant=` pratinjau", () => {
  it("varian non-bawaan → settings.custom LENGKAP yang lolos skema & ter-resolve", () => {
    const o = opsi("meihua");
    const champagne = o.variants.find((v) => v.id === "champagne")!;
    const v = pickPreviewVariant("meihua", "champagne");
    expect(v).toMatchObject({ id: "champagne", name: champagne.name });
    expect(v?.custom).toEqual({
      ...defaultCustomSettings(o),
      variant: "champagne",
    });
    // Jalur baca undangan mem-parse `settings`; objek parsial gagal di sana.
    const parsed = settingsSchema.parse({
      timezone: "Asia/Jakarta",
      sections: {},
      moderateGuestbook: false,
      custom: v?.custom,
    });
    expect(parsed.custom).toEqual(v?.custom);
    expect(resolveAppearance(o, v!.custom).variantId).toBe("champagne");
  });

  it("semua varian non-bawaan semua tema menghasilkan custom yang sah", () => {
    for (const [slug, o] of Object.entries(themeOptionsRegistry)) {
      for (const varian of o.variants.slice(1)) {
        const v = pickPreviewVariant(slug, varian.id);
        const label = `${slug}:${varian.id}`;
        expect(v?.custom, label).not.toBeNull();
        expect(
          settingsSchema.safeParse({ custom: v?.custom }).success,
          label,
        ).toBe(true);
        expect(resolveAppearance(o, v!.custom).variantId, label).toBe(
          varian.id,
        );
      }
    }
  });

  it("varian bawaan → dikenali (judul) tetapi tanpa custom: render legacy", () => {
    const bawaan = opsi("meihua").variants[0]!;
    expect(pickPreviewVariant("meihua", bawaan.id)).toEqual({
      id: bawaan.id,
      name: bawaan.name,
      custom: null,
    });
  });

  it.each([
    ["tag skrip", "<script>alert(1)</script>"],
    ["tag skrip pendek", "<script>"],
    ["ter-encode", "%3Cscript%3E"],
    ["kosong", ""],
    ["spasi depan", " champagne"],
    ["spasi belakang", "champagne "],
    ["huruf besar", "Champagne"],
    ["kunci prototipe", "__proto__"],
    ["constructor", "constructor"],
    ["toString", "toString"],
    ["array", ["champagne"]],
    ["undefined", undefined],
    ["null", null],
    ["angka", 1],
  ])("`%s` → null (varian bawaan)", (_n, nilai) => {
    expect(pickPreviewVariant("meihua", nilai)).toBeNull();
  });

  // Slug pratinjau datang dari URL. Kunci warisan objek biasa dulu lolos
  // `registry[slug] ?? null` sebagai fungsi bawaan yang truthy → crash 500
  // di /preview/tema/constructor, bukan 404.
  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "slug `%s` (kunci warisan objek) → null di semua registry, tak melempar",
    (slug) => {
      expect(pickPreviewVariant(slug, "champagne")).toBeNull();
      expect(getThemeOptions(slug)).toBeNull();
      expect(getThemeLoader(slug)).toBeNull();
      expect(getThemeDemoLoader(slug)).toBeNull();
    },
  );

  it("id varian milik tema LAIN ditolak — whitelist per tema", () => {
    const idMeihua = new Set(opsi("meihua").variants.map((v) => v.id));
    const idAsing = Object.entries(themeOptionsRegistry)
      .filter(([slug]) => slug !== "meihua")
      .flatMap(([, o]) => o.variants.map((v) => v.id))
      .filter((id) => !idMeihua.has(id));
    expect(idAsing.length).toBeGreaterThan(0);
    for (const id of idAsing) {
      expect(pickPreviewVariant("meihua", id), id).toBeNull();
    }
  });

  it("id sama di dua tema dibaca menurut options tema masing-masing", () => {
    // "champagne" = varian BAWAAN noir, tetapi varian ketiga meihua.
    expect(pickPreviewVariant("noir", "champagne")?.custom).toBeNull();
    expect(pickPreviewVariant("meihua", "champagne")?.custom).not.toBeNull();
  });

  it("slug tanpa options → null", () => {
    expect(pickPreviewVariant("tidak-ada", "champagne")).toBeNull();
  });
});

describe("themePreviewHref", () => {
  it("tanpa varian → URL lama tak berubah", () => {
    expect(themePreviewHref("meihua")).toBe("/preview/tema/meihua");
    expect(themePreviewHref("meihua", { variant: null })).toBe(
      "/preview/tema/meihua",
    );
    expect(themePreviewHref("meihua", { embed: true })).toBe(
      "/preview/tema/meihua?embed=1",
    );
  });

  it("varian ikut ke kartu & iframe", () => {
    expect(themePreviewHref("meihua", { variant: "champagne" })).toBe(
      "/preview/tema/meihua?variant=champagne",
    );
    expect(
      themePreviewHref("meihua", { embed: true, variant: "champagne" }),
    ).toBe("/preview/tema/meihua?embed=1&variant=champagne");
  });
});

describe("ThemeCard varian", () => {
  const demoLink = () =>
    screen
      .getAllByRole("link")
      .find((a) => a.textContent?.includes(copy.marketing.themes.preview))!;

  it("varian non-bawaan: judul '{Tema} — {Varian}', tautan varian, poster berpalet varian", () => {
    const champagne = opsi("meihua").variants.find(
      (v) => v.id === "champagne",
    )!;
    const k = { ...kartu("meihua", "champagne"), name: "Meihua" };
    const judul = copy.marketing.themes.variantTitle("Meihua", champagne.name);
    const { container } = render(<ThemeCard theme={k} />);

    expect(screen.getByText(judul)).toBeTruthy();
    expect(demoLink().getAttribute("href")).toBe(
      "/preview/tema/meihua?variant=champagne",
    );
    expect(demoLink().getAttribute("aria-label")).toBe(
      copy.marketing.themes.demoOf(judul),
    );
    // Thumbnail memotret varian bawaan → varian lain tak boleh memakainya.
    expect(screen.queryByTestId("mockup")).toBeNull();
    const poster = container.querySelector<HTMLElement>(".mrv-poster");
    expect(poster?.style.getPropertyValue("--mrv-poster-bg")).toBe(
      champagne.paper,
    );
    const { r, g, b } = hexToRgb(posterNameColor(k.meta)!);
    expect(
      container.querySelector<HTMLElement>(".mrv-poster__name")?.style.color,
    ).toBe(`rgb(${r}, ${g}, ${b})`);
  });

  it("varian bawaan tetap memakai mockup thumbnail", () => {
    const bawaan = opsi("meihua").variants[0]!;
    render(<ThemeCard theme={kartu("meihua", bawaan.id)} />);
    expect(screen.getByTestId("mockup")).toBeTruthy();
    expect(demoLink().getAttribute("href")).toBe(
      `/preview/tema/meihua?variant=${bawaan.id}`,
    );
  });

  it("kartu tanpa varian (landing) tak berubah", () => {
    render(<ThemeCard theme={tema("meihua", { name: "Meihua" })} />);
    expect(screen.getByText("Meihua")).toBeTruthy();
    expect(demoLink().getAttribute("href")).toBe("/preview/tema/meihua");
  });

  it("poster kartu tanpa varian tetap bernama tinta (tanpa warna aksen)", () => {
    const { container } = render(
      <ThemeCard theme={tema("meihua", { name: "Meihua", hasDemo: false })} />,
    );
    expect(
      container.querySelector<HTMLElement>(".mrv-poster__name")?.style.color,
    ).toBe("");
  });
});
