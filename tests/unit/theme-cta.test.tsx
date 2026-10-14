import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * "Gunakan tema ini" harus MEMBAWA temanya (DECISIONS #79).
 *
 * Kedua tombol — kartu katalog `/tema` dan showcase `/preview/tema/{slug}` —
 * dulu menunjuk `/daftar` begitu saja. Akibatnya pengguna yang sudah login
 * dipantulkan `/daftar` → `/dashboard` dan mendarat di dasbor kosong, setelah
 * menyatakan dengan jelas tema apa yang ia mau. Tak ada galat; produknya hanya
 * terasa mengabaikan pilihan pengguna.
 *
 * Yang dijaga di sini adalah RANTAI-nya, karena tiap mata rantai membuang
 * temanya dengan cara yang sama diamnya: tautan tak membawa `?tema=`, halaman
 * tak membacanya, atau `requireUser` membuang tujuan saat meminta login.
 */

vi.mock("@/server/theme-thumbs", () => ({ hasThemeThumb: () => false }));
vi.mock("@/server/actions/invitation", () => ({
  createInvitationAction: vi.fn(async () => ({ status: "idle" })),
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: null } })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));

import { CreateInvitationForm } from "@/components/dashboard/create-invitation-form";
import { ThemeCard } from "@/components/marketing/theme-poster";
import { ThemeShowcase } from "@/components/preview/theme-showcase";
import { copy } from "@/lib/copy";
import {
  CREATE_PATH,
  THEME_PARAM,
  preselectFromCatalog,
  themeFromParam,
  themeCtaHref,
} from "@/lib/theme-cta";
import { requireUser } from "@/server/guards/auth";
import { FALLBACK_CATALOG_META } from "@/themes/catalog-meta";

afterEach(cleanup);

describe("tautan `?tema=`", () => {
  it("menunjuk halaman buat-undangan, bukan `/daftar`", () => {
    expect(themeCtaHref("eternal-rose")).toBe(
      `${CREATE_PATH}?${THEME_PARAM}=eternal-rose`,
    );
    expect(themeCtaHref("eternal-rose")).not.toContain("/daftar");
  });

  it("slug di-encode — ia ikut dirangkai kembali ke dalam `?next=`", () => {
    expect(themeCtaHref("a&b=c")).toBe(
      `${CREATE_PATH}?${THEME_PARAM}=a%26b%3Dc`,
    );
  });

  it.each([
    ["kosong", ""],
    ["huruf besar", "Eternal-Rose"],
    ["path traversal", "../admin"],
    ["URL absolut", "https://jahat.example"],
    ["protocol-relative", "//jahat.example"],
    ["spasi", "eternal rose"],
    ["terlalu panjang", "a".repeat(65)],
    ["bukan string", undefined],
  ])("`%s` ditolak saringan bentuk", (_n, nilai) => {
    expect(themeFromParam(nilai)).toBe(null);
  });

  it("slug wajar diterima", () => {
    expect(themeFromParam("eternal-rose")).toBe("eternal-rose");
  });
});

describe("pencocokan dengan katalog aktif", () => {
  const KATALOG = [
    { slug: "eternal-rose", categories: ["wedding" as const] },
    { slug: "festa", categories: ["family" as const] },
    { slug: "lumina", categories: ["family" as const, "wedding" as const] },
  ];

  it("tema aktif → terpilih beserta kategorinya", () => {
    expect(preselectFromCatalog(KATALOG, "festa")).toEqual({
      themeSlug: "festa",
      category: "family",
    });
  });

  it("tema multi-kategori mendahulukan `wedding`", () => {
    // Kasus terbanyak; tanpa ini pengguna mendarat di tab "Keluarga" tanpa
    // pernah memintanya.
    expect(preselectFromCatalog(KATALOG, "lumina")?.category).toBe("wedding");
  });

  it("tema di luar katalog → null, bukan pilihan hantu", () => {
    // Saringan bentuk meloloskan slug yang rapi tetapi sudah DINONAKTIFKAN.
    // Meneruskannya akan menyetel `themeSlug` ke tema yang tak ada di daftar:
    // tombol Lanjut gagal validasi tanpa satu pun kartu tampak terpilih.
    expect(preselectFromCatalog(KATALOG, "tema-pensiun")).toBe(null);
  });

  it("tanpa slug → null", () => {
    expect(preselectFromCatalog(KATALOG, null)).toBe(null);
  });

  it("tema tanpa kategori → null, bukan kategori `undefined`", () => {
    expect(
      preselectFromCatalog([{ slug: "aneh", categories: [] }], "aneh"),
    ).toBe(null);
  });
});

describe("tombol di permukaan marketing", () => {
  const tautanCta = (nama: string) =>
    screen
      .getAllByRole("link")
      .find((a) => a.textContent?.includes(nama))!
      .getAttribute("href");

  it("showcase tema membawa slug yang sedang dilihat", () => {
    render(
      <ThemeShowcase
        slug="eternal-rose"
        name="Eternal Rose"
        category="Pernikahan"
        tier="Standar"
        embedSrc="/preview/tema/eternal-rose?embed=1"
        credit={null}
        prev={null}
        next={null}
      />,
    );
    expect(tautanCta(copy.preview.useThisTheme)).toBe(
      themeCtaHref("eternal-rose"),
    );
  });

  it("kartu katalog membawa slug kartunya sendiri", () => {
    render(
      <ThemeCard
        theme={{
          slug: "kirana",
          name: "Kirana",
          categories: ["wedding"],
          tier: "premium",
          hasDemo: true,
          meta: FALLBACK_CATALOG_META,
        }}
      />,
    );
    expect(tautanCta(copy.marketing.themes.useTheme)).toBe(
      themeCtaHref("kirana"),
    );
  });
});

describe("form buat-undangan menerima pilihan itu", () => {
  const TEMA = [
    {
      slug: "eternal-rose",
      name: "Eternal Rose",
      categories: ["wedding" as const],
      tier: "standard",
      hasThumb: false,
    },
    {
      slug: "festa",
      name: "Festa",
      categories: ["family" as const],
      tier: "standard",
      hasThumb: false,
    },
  ];

  it("tema terpilih sejak render pertama", () => {
    render(
      <CreateInvitationForm
        themes={TEMA}
        preselect={{ themeSlug: "eternal-rose", category: "wedding" }}
      />,
    );
    expect(
      screen
        .getByLabelText(copy.create.selectThemeAria("Eternal Rose"))
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("kategori ikut disetel — pemilih tema DISARING olehnya", () => {
    // Tanpa ini tema keluarga/korporat yang dipilih akan lenyap dari daftar
    // (kategori bawaan "wedding"), dan form tampak mengabaikan pilihan tadi.
    render(
      <CreateInvitationForm
        themes={TEMA}
        preselect={{ themeSlug: "festa", category: "family" }}
      />,
    );
    const tombolFesta = screen.getByLabelText(
      copy.create.selectThemeAria("Festa"),
    );
    expect(tombolFesta.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.queryByLabelText(copy.create.selectThemeAria("Eternal Rose")),
    ).toBe(null);
  });

  it("tanpa preselect, form tetap seperti semula", () => {
    render(<CreateInvitationForm themes={TEMA} />);
    expect(
      screen
        .getByLabelText(copy.create.selectThemeAria("Eternal Rose"))
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
});

describe("requireUser membawa tujuan ke halaman masuk", () => {
  const tujuan = async (next?: string) => {
    try {
      await requireUser(next);
    } catch (e) {
      return /^NEXT_REDIRECT:(.*)$/.exec((e as Error).message)![1];
    }
    throw new Error("tidak redirect");
  };

  it("`next` ikut, ter-encode", async () => {
    const href = themeCtaHref("eternal-rose");
    expect(await tujuan(href)).toBe(`/masuk?next=${encodeURIComponent(href)}`);
  });

  it("tanpa `next` tetap seperti semula", async () => {
    expect(await tujuan()).toBe("/masuk");
  });
});
