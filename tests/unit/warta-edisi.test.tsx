import { render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { storyAspectForVariant } from "@/lib/customizer/theme-options";
import { DEKOR, type Dekor, dwi, edisiDari } from "@/themes/warta/labels";
import {
  SLOT_FOTO_BERITA,
  VARIAN_EDISI_INDONESIA,
  wartaOptions,
} from "@/themes/warta/options";
import type { PhotoView } from "@/types/invitation";

/**
 * Warta "Edisi Indonesia" (DECISIONS #130) & foto berita utama (#131).
 *
 * Judul dekoratif dirender DUA edisi dan disaring CSS `data-variant`, karena
 * pratinjau langsung editor Tampilan tak merender ulang iframe. Kegagalannya
 * senyap: judul yang lupa diterjemahkan tetap tampil — dalam bahasa Inggris —
 * di halaman berjudul Indonesia, dan tak ada galat apa pun.
 */

// `Reveal` memakai IntersectionObserver; jsdom tak punya.
beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
});

/** Argumen contoh untuk entri kamus berupa fungsi, per jalur kunci. */
const CONTOH: Record<string, unknown[][]> = {
  "cover.headline": [["Dimas", "Sekar"]],
  "cover.continued": [[2]],
  "hero.reported": [["Yogyakarta"], [null]],
  "countdown.stamp": [["15 · 05 · 2027"]],
  "schedule.announcements": [
    [1, true],
    [2, true],
    [2, false],
    [7, false],
  ],
  "footer.printed": [["Yogyakarta"], [null]],
};

/** Ratakan kamus jadi `jalur → daftar string` (fungsi dipanggil dgn CONTOH). */
function ratakan(d: Dekor): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const jalan = (v: unknown, jalur: string) => {
    if (typeof v === "string") out.set(jalur, [v]);
    else if (typeof v === "function") {
      const contoh = CONTOH[jalur];
      if (!contoh) throw new Error(`Tambahkan argumen contoh untuk '${jalur}'`);
      out.set(
        jalur,
        contoh.map((args) =>
          String((v as (...a: unknown[]) => unknown)(...args)),
        ),
      );
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v))
        jalan(x, jalur ? `${jalur}.${k}` : k);
    } else out.set(jalur, [String(v)]);
  };
  jalan(d, "");
  return out;
}

describe("kamus judul dekoratif dua edisi", () => {
  const en = ratakan(DEKOR.en);
  const id = ratakan(DEKOR.id);

  it("setiap judul Inggris punya padanan Indonesia, tak ada yang kosong", () => {
    expect([...id.keys()].sort()).toEqual([...en.keys()].sort());
    expect(en.size).toBeGreaterThanOrEqual(30);
    for (const [jalur, nilai] of id) {
      for (const s of nilai) expect(s.trim(), `id:${jalur}`).not.toBe("");
    }
    for (const [jalur, nilai] of en) {
      for (const s of nilai) expect(s.trim(), `en:${jalur}`).not.toBe("");
    }
  });

  it("padanan Indonesia benar-benar diterjemahkan (bukan salinan Inggris)", () => {
    for (const [jalur, nilai] of id) {
      expect(nilai, `'${jalur}' masih sama dengan edisi Inggris`).not.toEqual(
        en.get(jalur),
      );
    }
  });

  it("teks halaman acuan pemilik dipakai persis (huruf besar dari CSS)", () => {
    expect(DEKOR.id.hero.kicker.toUpperCase()).toBe("BERITA UTAMA !");
    expect(DEKOR.id.hero.headline.toUpperCase()).toBe(
      "PASANGAN BAHAGIA MENGUNDANG ANDA",
    );
    expect(DEKOR.id.hero.reported("Jakarta").toUpperCase()).toBe(
      "LAPORAN DARI JAKARTA . BY THE FAMILY",
    );
    expect(DEKOR.id.story.heading.toUpperCase()).toBe("KISAH CINTA KAMI");
    expect(DEKOR.id.story.eyebrow.toUpperCase()).toBe(
      "SUMBER DARI KEDUA MEMPELAI",
    );
    expect(DEKOR.id.folioRight.toUpperCase()).toBe("UNDANGAN PERNIKAHAN");
    expect(DEKOR.id.folioSep).toBe(" . ");
    expect(DEKOR.id.folio.hero.toUpperCase()).toBe("BERITA");
    expect(DEKOR.id.folio.story.toUpperCase()).toBe("FITUR");
  });

  it("edisi mengikuti id varian terselesaikan; tanpa kustomisasi = Inggris", () => {
    expect(edisiDari(VARIAN_EDISI_INDONESIA)).toBe("id");
    expect(edisiDari("koran")).toBe("en");
    expect(edisiDari("sepia")).toBe("en");
    expect(edisiDari(null)).toBe("en");
    expect(edisiDari(undefined)).toBe("en");
  });

  it("teks di CSS ikut punya padanan (counter folio, dinding ucapan)", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/themes/warta/warta.css", "utf8");
    const ID = '.wt[data-variant="indonesia"]';
    expect(css).toContain('content: "Page " counter(wt-page)');
    expect(css).toContain(
      `${ID} .wt-folio__n::before {\n  content: "Halaman " counter(wt-page);`,
    );
    expect(css).toContain('content: "Letters to the editor"');
    expect(css).toMatch(
      /\.wt\[data-variant="indonesia"\] \.gb-wall__title::before \{\s*content: "Surat Pembaca"/,
    );
  });
});

describe("options.ts Edisi Indonesia & slot foto berita", () => {
  it("varian keempat berkertas abu-abu acuan", () => {
    const v = wartaOptions.variants.find(
      (x) => x.id === VARIAN_EDISI_INDONESIA,
    );
    expect(wartaOptions.variants.map((x) => x.id)).toEqual([
      "koran",
      "sepia",
      "merah",
      VARIAN_EDISI_INDONESIA,
    ]);
    expect(v?.name).toBe("Edisi Indonesia");
    expect(v?.paper.toLowerCase()).toBe("#c6c6c6");
  });

  it("slot x-berita 3:2 berlabel; bingkai cerita per edisi", () => {
    const slot = wartaOptions.media?.slots.find(
      (s) => s.id === SLOT_FOTO_BERITA,
    );
    expect(slot).toMatchObject({ label: "Foto berita utama", aspect: 3 / 2 });
    const story = wartaOptions.media!.story!;
    expect(storyAspectForVariant(story, VARIAN_EDISI_INDONESIA)).toEqual([
      8 / 9,
      5 / 7,
    ]);
    expect(storyAspectForVariant(story, "koran")).toEqual([4 / 3, 3 / 4]);
  });
});

const FOTO: PhotoView = {
  url: "https://cdn.test/berita/1600.webp",
  x: 0.3,
  y: 0.7,
  zoom: 1.5,
};

describe("Hero — foto berita utama", () => {
  it("ada foto → satu foto lebar penuh dengan titik fokus & perbesaran pemilik", async () => {
    const { Hero } = await import("@/themes/warta/sections");
    const { container } = render(
      <Hero rubric={dwi((d) => d.folio.hero)} city="Jakarta" photo={FOTO} />,
    );
    const wadah = container.querySelectorAll(".wt-photo--news");
    expect(wadah).toHaveLength(1);
    // Di LUAR kolom isi (`.wt-inner`) → selebar halaman.
    expect(wadah[0]!.closest(".wt-inner")).toBeNull();
    const img = wadah[0]!.querySelector("img");
    expect(img?.getAttribute("src")).toBe(FOTO.url);
    expect(img?.style.objectPosition).toBe("30% 70%");
    expect(img?.style.transform).toBe("scale(1.5)");
    // Layar pertama sebelum hidrasi → kandidat LCP: tak boleh `lazy`.
    expect(img?.getAttribute("loading")).toBe("eager");
    // Sesudah teks pembuka, bukan sebelum.
    const cols = container.querySelector(".wt-cols")!;
    expect(
      cols.compareDocumentPosition(wadah[0]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("tanpa foto → tak ada wadah, monogram, maupun gambar", async () => {
    const { Hero } = await import("@/themes/warta/sections");
    for (const photo of [undefined, null]) {
      const { container, unmount } = render(
        <Hero rubric={dwi((d) => d.folio.hero)} city={null} photo={photo} />,
      );
      expect(container.querySelector(".wt-photo")).toBeNull();
      expect(container.querySelector("img")).toBeNull();
      unmount();
    }
  });
});

describe("judul section dua edisi (span lang en/id)", () => {
  /** Pasangan span `.wt-bi` langsung di bawah `el`: [en, id]. */
  const pasangan = (el: Element | null) =>
    [...(el?.querySelectorAll(":scope > .wt-bi") ?? [])].map((s) => [
      s.getAttribute("lang"),
      s.textContent,
    ]);

  it("Hero: kicker, judul, eyebrow & folio merender KEDUA edisi", async () => {
    const { Hero } = await import("@/themes/warta/sections");
    const { container } = render(
      <Hero rubric={dwi((d) => d.folio.hero)} city="Jakarta" />,
    );
    expect(pasangan(container.querySelector(".wt-kicker"))).toEqual([
      ["en", "Hot News!"],
      ["id", "Berita Utama !"],
    ]);
    // Satu heading per section — dua edisi di DALAM heading yang sama.
    const h2 = container.querySelectorAll("h2");
    expect(h2).toHaveLength(1);
    expect(pasangan(h2[0]!)).toEqual([
      ["en", "The Happy Couple Invites You"],
      ["id", "Pasangan Bahagia Mengundang Anda"],
    ]);
    expect(pasangan(container.querySelector(".wt-eyebrow"))).toEqual([
      ["en", "Reported from Jakarta · by the family"],
      ["id", "Laporan dari Jakarta . by the family"],
    ]);
    expect(pasangan(container.querySelector(".wt-folio__n"))).toEqual([
      ["en", " · News"],
      ["id", " . Berita"],
    ]);
    expect(
      pasangan(container.querySelector(".wt-folio > span:last-child")),
    ).toEqual([
      ["en", "The Wedding Post"],
      ["id", "Undangan Pernikahan"],
    ]);
    expect(container.querySelector(".wt-folio")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("Story: judul & eyebrow dua edisi; judul entri dibungkus untuk skew", async () => {
    const { Story } = await import("@/themes/warta/sections");
    const { container } = render(
      <Story
        rubric={dwi((d) => d.folio.story)}
        items={[
          { title: "Awal Mula", date: "", narrative: "a" },
          { title: "Lamaran", date: "", narrative: "b" },
        ]}
        photos={[null, null]}
      />,
    );
    expect(container.querySelector("section")).toHaveClass("wt-feature");
    expect(pasangan(container.querySelector("h2"))).toEqual([
      ["en", "Our Love Story"],
      ["id", "Kisah Cinta Kami"],
    ]);
    expect(pasangan(container.querySelector(".wt-eyebrow"))).toEqual([
      ["en", "As told by the happy couple"],
      ["id", "Sumber dari kedua mempelai"],
    ]);
    expect(
      [...container.querySelectorAll(".wt-h3 > .wt-h3__t")].map(
        (s) => s.textContent,
      ),
    ).toEqual(["Awal Mula", "Lamaran"]);
  });

  it("rubrik string tunggal tetap didukung (sama di kedua edisi)", async () => {
    const { Story } = await import("@/themes/warta/sections");
    const { container } = render(
      <Story rubric="Feature" items={[]} photos={[]} />,
    );
    expect(pasangan(container.querySelector(".wt-folio__n"))).toEqual([
      ["en", " · Feature"],
      ["id", " . Feature"],
    ]);
  });
});
