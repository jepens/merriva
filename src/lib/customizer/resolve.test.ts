import { describe, expect, it } from "vitest";

import { eternalRoseOptions } from "@/themes/eternal-rose/options";

import { contrastRatio } from "./contrast-guard";
import { resolveAppearance } from "./resolve";
import { defaultCustomSettings, type CustomSettings } from "./theme-options";

const opts = eternalRoseOptions;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const base = (): CustomSettings => clone(defaultCustomSettings(opts));

describe("resolveAppearance — bawaan (backward compat)", () => {
  it("custom absen → varian pertama, urutan asli semua tampil, motion full, grain on", () => {
    const r = resolveAppearance(opts, null);
    expect(r.variantId).toBe("rose");
    expect(r.accent).toBe("#B76E79");
    expect(r.paper).toBe("#F6EFE7");
    expect(r.ink).toBe("#241A1E");
    expect(r.dispVar).toBe("var(--er-disp-a)");
    expect(r.bodyVar).toBe("var(--er-body-a)");
    expect(r.sections.map((s) => s.id)).toEqual(opts.sections.map((s) => s.id));
    expect(r.sections.every((s) => s.visible)).toBe(true);
    expect(r.styles).toEqual({ gallery: "strip" });
    expect(r.motion).toBe("full");
    expect(r.grain).toBe(true);
  });

  it("accentText selalu lolos AA di atas kertas (kontras di server)", () => {
    const r = resolveAppearance(opts, null);
    expect(contrastRatio(r.accentText, r.paper)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("resolveAppearance — varian & accent", () => {
  it("varian sage memakai paper/ink/aksen sage", () => {
    const c = base();
    c.variant = "sage";
    const r = resolveAppearance(opts, c);
    expect(r.accent).toBe("#75855F");
    expect(r.paper).toBe("#F6F3E9");
    expect(r.ink).toBe("#26291E");
  });

  it("custom accent yang kurang kontras di-snap; onAccent tetap kontras", () => {
    const c = base();
    c.accent = "#e8b7c0"; // pink pucat (kasus prototipe)
    const r = resolveAppearance(opts, c);
    expect(r.accent).toBe("#e8b7c0"); // dekoratif = mentah
    expect(r.accentSnapped).toBe(true);
    expect(contrastRatio(r.accentText, r.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(r.onAccent, r.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("fontPair b memakai var disp/body b", () => {
    const c = base();
    c.fontPair = "b";
    const r = resolveAppearance(opts, c);
    expect(r.dispVar).toBe("var(--er-disp-b)");
    expect(r.bodyVar).toBe("var(--er-body-b)");
  });
});

describe("resolveAppearance — sections (defensif)", () => {
  it("reorder sah dipertahankan; toggle:false dipaksa tampil", () => {
    const c = base();
    // tukar quote <-> gallery (keduanya reorder:true)
    const ids = c.sections.map((s) => s.id);
    const qi = ids.indexOf("quote");
    const gi = ids.indexOf("gallery");
    [c.sections[qi], c.sections[gi]] = [c.sections[gi]!, c.sections[qi]!];
    // coba sembunyikan couple (toggle:false) — harus dipaksa tampil
    const couple = c.sections.find((s) => s.id === "couple")!;
    couple.visible = false;
    const r = resolveAppearance(opts, c);
    expect(r.sections.map((s) => s.id).indexOf("gallery")).toBe(qi);
    expect(r.sections.find((s) => s.id === "couple")!.visible).toBe(true);
  });

  it("menyembunyikan section opsional (gallery) dihormati", () => {
    const c = base();
    c.sections.find((s) => s.id === "gallery")!.visible = false;
    const r = resolveAppearance(opts, c);
    expect(r.sections.find((s) => s.id === "gallery")!.visible).toBe(false);
  });

  it("memindah hero (reorder:false) → fallback ke urutan bawaan", () => {
    const c = base();
    const [hero, ...rest] = c.sections;
    c.sections = [rest[0]!, hero!, ...rest.slice(1)];
    const r = resolveAppearance(opts, c);
    expect(r.sections.map((s) => s.id)).toEqual(opts.sections.map((s) => s.id));
  });

  it("permutasi tak lengkap (section hilang) → fallback ke urutan bawaan", () => {
    const c = base();
    c.sections = c.sections.filter((s) => s.id !== "gallery");
    const r = resolveAppearance(opts, c);
    expect(r.sections.map((s) => s.id)).toEqual(opts.sections.map((s) => s.id));
  });

  it("id section asing → fallback ke urutan bawaan", () => {
    const c = base();
    c.sections[3]!.id = "iklan";
    const r = resolveAppearance(opts, c);
    expect(r.sections.map((s) => s.id)).toEqual(opts.sections.map((s) => s.id));
  });
});

describe("resolveAppearance — styles & motion/grain", () => {
  it("gaya galeri valid dipakai; invalid → bawaan", () => {
    const c = base();
    c.styles.gallery = "polaroid";
    expect(resolveAppearance(opts, c).styles.gallery).toBe("polaroid");
    c.styles.gallery = "carousel"; // tak dikenal
    expect(resolveAppearance(opts, c).styles.gallery).toBe("strip");
  });

  it("motion calm & grain off dihormati", () => {
    const c = base();
    c.motion = "calm";
    c.grain = false;
    const r = resolveAppearance(opts, c);
    expect(r.motion).toBe("calm");
    expect(r.grain).toBe(false);
  });
});
