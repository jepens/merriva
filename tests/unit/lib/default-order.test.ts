import { describe, expect, it } from "vitest";

import { defaultSectionOrder } from "@/lib/customizer/default-order";
import type { ThemeOptions } from "@/lib/customizer/theme-options";
import { DEFAULT_SETTINGS } from "@/lib/validation/content";
import type { InvitationSettings } from "@/lib/validation/content";

/**
 * Urutan section untuk undangan yang BELUM punya `settings.custom` (jalur lama).
 *
 * Logika ini dulu disalin di sepuluh `index.tsx`, dan salinan itu menyimpan
 * sebuah jebakan: ia hanya menanyakan `isSectionVisible`, padahal `hero` dan
 * `rsvp` ada di `SECTION_KEYS`. Jadi begitu sebuah tema memakai id kanonik
 * `hero` (bukan `intro`/`opening`), `settings.sections.hero = false` bisa
 * menyembunyikan layar pembukanya — melanggar kontraknya sendiri, tanpa satu
 * pun test memerah. Rename ke kosakata kanonik justru yang akan MEMBUKA
 * jebakan itu kalau helper ini tidak ada.
 */

function opsi(
  sections: Array<{ id: string; reorder: boolean; toggle: boolean }>,
): ThemeOptions {
  return {
    variants: [{ id: "a", name: "A", acc: "#000", paper: "#fff", ink: "#000" }],
    fontPairs: [
      { id: "a", name: "A", dispVar: "var(--d)", bodyVar: "var(--b)" },
    ],
    sections,
    styles: {},
    supports: { customAccent: false, motion: false, grain: false },
    preview: { root: "t", vars: [{ name: "--a", token: "accent" }] },
  } as ThemeOptions;
}

function settings(over: Partial<InvitationSettings["sections"]>) {
  return { ...DEFAULT_SETTINGS, sections: over } as InvitationSettings;
}

describe("section wajib tampil (`toggle: false`)", () => {
  it("hero TETAP tampil walau toggle lama mematikannya", () => {
    const order = defaultSectionOrder(
      opsi([{ id: "hero", reorder: false, toggle: false }]),
      settings({ hero: false }),
    );
    expect(order).toEqual([{ id: "hero", visible: true }]);
  });

  it("rsvp TETAP tampil walau toggle lama mematikannya", () => {
    const order = defaultSectionOrder(
      opsi([{ id: "rsvp", reorder: true, toggle: false }]),
      settings({ rsvp: false }),
    );
    expect(order[0]?.visible).toBe(true);
  });
});

describe("section yang boleh disembunyikan (`toggle: true`)", () => {
  it("mengikuti toggle lama bila id-nya memang dikenal toggle lama", () => {
    const o = opsi([
      { id: "gallery", reorder: true, toggle: true },
      { id: "story", reorder: true, toggle: true },
    ]);
    const order = defaultSectionOrder(o, settings({ gallery: false }));
    expect(order).toEqual([
      { id: "gallery", visible: false },
      { id: "story", visible: true },
    ]);
  });

  it("tampil bila id-nya DI LUAR toggle lama", () => {
    // `quote` tak pernah punya toggle lama; tanpa cabang ini ia akan dianggap
    // tersembunyi dan hilang dari undangan yang sudah terbit.
    const order = defaultSectionOrder(
      opsi([{ id: "quote", reorder: true, toggle: true }]),
      settings({}),
    );
    expect(order[0]?.visible).toBe(true);
  });

  it("section khas tema (`x-`) tampil, tak terpengaruh toggle lama", () => {
    const order = defaultSectionOrder(
      opsi([{ id: "x-seating", reorder: true, toggle: true }]),
      settings({}),
    );
    expect(order[0]?.visible).toBe(true);
  });

  it("tak di-set = tampil (undangan lama tetap lengkap)", () => {
    const order = defaultSectionOrder(
      opsi([{ id: "envelope", reorder: true, toggle: true }]),
      settings({}),
    );
    expect(order[0]?.visible).toBe(true);
  });
});

describe("urutan", () => {
  it("persis mengikuti urutan bawaan tema", () => {
    const ids = ["hero", "couple", "gallery", "rsvp"];
    const order = defaultSectionOrder(
      opsi(
        ids.map((id) => ({
          id,
          reorder: true,
          toggle: id !== "hero" && id !== "rsvp",
        })),
      ),
      settings({}),
    );
    expect(order.map((o) => o.id)).toEqual(ids);
  });

  it("section tersembunyi TETAP ada di daftar (dengan visible:false)", () => {
    // Pemanggil yang menyaring sendiri; membuangnya di sini akan membuat
    // penomoran section di tema melompat.
    const order = defaultSectionOrder(
      opsi([
        { id: "hero", reorder: false, toggle: false },
        { id: "gallery", reorder: true, toggle: true },
      ]),
      settings({ gallery: false }),
    );
    expect(order).toHaveLength(2);
  });
});
