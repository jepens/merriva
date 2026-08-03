/**
 * Kontrak lintas-tema untuk kustomisasi (Fase G). Berjalan atas SELURUH tema di
 * registry → menangkap tema baru yang lupa mendeklarasikan `preview`, peta var
 * yang menyimpang dari yang dirender, ATAU id section/nilai gaya tanpa label
 * Indonesia (regresi tab "Bagian"/"Gaya"). Data murni (registry + copy) → tanpa
 * mock. Ini jaring pengaman kelas bug yang ditemukan audit customizer.
 */
import { describe, expect, it } from "vitest";

import { copy } from "@/lib/copy";
import { themeOptionsRegistry } from "@/themes/theme-options-registry";

import { appearanceStyle } from "./appearance-style";
import { resolveAppearance } from "./resolve";
import type { PreviewVarToken } from "./theme-options";

const TOKENS: readonly PreviewVarToken[] = [
  "accent",
  "accentText",
  "onAccent",
  "paper",
  "ink",
  "disp",
  "body",
];

const themes = Object.entries(themeOptionsRegistry);
const sectionLabels = copy.appearance.sectionLabels as Record<string, string>;
const styleLabels = copy.appearance.styleLabels as Record<string, string>;

describe.each(themes)("kontrak tema '%s'", (_slug, opt) => {
  it("mendeklarasikan preview map yang valid", () => {
    expect(opt.preview).toBeDefined();
    expect(opt.preview.root).toMatch(/^[a-z][a-z-]*$/);
    expect(opt.preview.vars.length).toBeGreaterThan(0);
  });

  it("preview.vars: nama '--x' unik, token dikenal, memuat accent", () => {
    const names = opt.preview.vars.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
    for (const v of opt.preview.vars) {
      expect(v.name.startsWith("--")).toBe(true);
      expect(TOKENS).toContain(v.token);
    }
    expect(opt.preview.vars.some((v) => v.token === "accent")).toBe(true);
  });

  it("appearanceStyle menghasilkan TEPAT var yang dideklarasikan (non-kosong)", () => {
    const style = appearanceStyle(
      opt.preview.vars,
      resolveAppearance(opt, null),
    );
    const keys = Object.keys(style);
    expect(keys.slice().sort()).toEqual(
      opt.preview.vars
        .map((v) => v.name)
        .slice()
        .sort(),
    );
    for (const [, value] of Object.entries(style)) {
      expect(String(value).length).toBeGreaterThan(0);
    }
  });

  it("setiap id section punya label Indonesia (tab Bagian)", () => {
    for (const s of opt.sections) {
      expect(
        sectionLabels[s.id],
        `label section '${s.id}' hilang`,
      ).toBeTruthy();
    }
  });

  it("setiap nilai gaya punya label (tab Gaya)", () => {
    for (const values of Object.values(opt.styles)) {
      for (const val of values) {
        expect(styleLabels[val], `label gaya '${val}' hilang`).toBeTruthy();
      }
    }
  });
});
