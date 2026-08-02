import { describe, expect, it } from "vitest";

import { eternalRoseOptions } from "@/themes/eternal-rose/options";

import { parseAppearanceInput } from "./parse-appearance";
import { defaultCustomSettings } from "./theme-options";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const valid = () => clone(defaultCustomSettings(eternalRoseOptions));

describe("parseAppearanceInput", () => {
  it("default valid diterima (eternal-rose)", () => {
    const r = parseAppearanceInput("eternal-rose", false, valid());
    expect(r.ok).toBe(true);
  });

  it("tema tanpa options → unsupported", () => {
    const r = parseAppearanceInput("tema-tak-ada", true, valid());
    expect(r).toEqual({ ok: false, reason: "unsupported" });
  });

  it("injeksi CSS lewat accent → invalid", () => {
    const d = valid();
    d.accent = "#ff0000;}body{display:none";
    const r = parseAppearanceInput("eternal-rose", true, d);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid");
      expect(r.fieldErrors?.accent).toBeDefined();
    }
  });

  it("gating: accent custom di Basic → invalid; di Premium → ok", () => {
    const d = valid();
    d.accent = "#1a2b3c";
    expect(parseAppearanceInput("eternal-rose", false, d).ok).toBe(false);
    expect(parseAppearanceInput("eternal-rose", true, d).ok).toBe(true);
  });

  it("gating: fontPair non-default di Basic → invalid; di Premium → ok", () => {
    const d = valid();
    d.fontPair = "b";
    expect(parseAppearanceInput("eternal-rose", false, d).ok).toBe(false);
    expect(parseAppearanceInput("eternal-rose", true, d).ok).toBe(true);
  });

  it("sections permutasi salah (hero dipindah) → invalid", () => {
    const d = valid();
    const [hero, ...rest] = d.sections;
    d.sections = [rest[0]!, hero!, ...rest.slice(1)];
    const r = parseAppearanceInput("eternal-rose", true, d);
    expect(r.ok).toBe(false);
  });

  it("field asing (injeksi css langsung) → invalid (strict)", () => {
    const d = valid() as unknown as Record<string, unknown>;
    d.customCss = "body{display:none}";
    expect(parseAppearanceInput("eternal-rose", true, d).ok).toBe(false);
  });
});
