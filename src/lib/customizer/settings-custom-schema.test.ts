import { describe, expect, it } from "vitest";

import { eternalRoseOptions } from "@/themes/eternal-rose/options";

import {
  buildCustomSettingsSchema,
  parseCustomSettings,
} from "./settings-custom-schema";
import { defaultCustomSettings } from "./theme-options";

const opts = eternalRoseOptions;
const premium = { premium: true };
const basic = { premium: false };
/** Klon JSON-safe (CustomSettings memang JSON murni). */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const valid = () => clone(defaultCustomSettings(opts));

describe("defaultCustomSettings", () => {
  it("menurunkan default dari schema tema", () => {
    const d = valid();
    expect(d.variant).toBe("rose");
    expect(d.fontPair).toBe("a");
    expect(d.accent).toBeNull();
    expect(d.sections.map((s) => s.id)).toEqual(opts.sections.map((s) => s.id));
    expect(d.styles).toEqual({ gallery: "strip" });
  });

  it("default SELALU lolos validasi (Basic maupun Premium)", () => {
    expect(() => parseCustomSettings(opts, basic, valid())).not.toThrow();
    expect(() => parseCustomSettings(opts, premium, valid())).not.toThrow();
  });
});

describe("whitelist inti", () => {
  it("varian di luar schema ditolak", () => {
    const d = valid();
    d.variant = "neon";
    expect(() => parseCustomSettings(opts, premium, d)).toThrow();
  });

  it("gaya galeri di luar enum ditolak", () => {
    const d = valid();
    d.styles.gallery = "carousel";
    expect(() => parseCustomSettings(opts, premium, d)).toThrow();
  });

  it("key styles yang tidak dideklarasikan tema ditolak (strict)", () => {
    const d = valid() as unknown as Record<string, unknown>;
    (d.styles as Record<string, string>).background = "video";
    expect(() => parseCustomSettings(opts, premium, d)).toThrow();
  });

  it("field asing di level atas ditolak (strict)", () => {
    const d = valid() as unknown as Record<string, unknown>;
    d.customCss = "body{display:none}";
    expect(() => parseCustomSettings(opts, premium, d)).toThrow();
  });

  it("versi selain 1 ditolak", () => {
    const d = valid() as unknown as { v: number };
    d.v = 2;
    expect(() => parseCustomSettings(opts, premium, d)).toThrow();
  });
});

describe("accent: format ketat + gating", () => {
  it("hex valid diterima di Premium", () => {
    const d = valid();
    d.accent = "#1A2B3C";
    const parsed = parseCustomSettings(opts, premium, d);
    expect(parsed.accent).toBe("#1A2B3C");
  });

  it("percobaan injeksi CSS lewat accent ditolak", () => {
    for (const evil of [
      "#fff", // bukan 6 digit
      "#ff0000;}body{display:none", // injeksi blok
      "red", // keyword
      "url(https://x)", // fungsi
      "#ff000012", // 8 digit
      "#GGGGGG", // bukan hex
    ]) {
      const d = valid();
      d.accent = evil;
      expect(() => parseCustomSettings(opts, premium, d), evil).toThrow();
    }
  });

  it("accent custom pada paket Basic ditolak (gating server-side)", () => {
    const d = valid();
    d.accent = "#1a2b3c";
    expect(() => parseCustomSettings(opts, basic, d)).toThrow(/Premium/);
  });

  it("accent ditolak bila tema tak mendukung customAccent", () => {
    const noAccent = {
      ...opts,
      supports: { ...opts.supports, customAccent: false },
    };
    const d = valid();
    d.accent = "#1a2b3c";
    expect(() => parseCustomSettings(noAccent, premium, d)).toThrow();
  });
});

describe("fontPair & styles: gating Basic", () => {
  it("Basic hanya boleh pasangan font bawaan", () => {
    const d = valid();
    d.fontPair = "b";
    expect(() => parseCustomSettings(opts, basic, d)).toThrow();
    expect(() => parseCustomSettings(opts, premium, d)).not.toThrow();
  });

  it("Basic hanya boleh gaya galeri bawaan", () => {
    const d = valid();
    d.styles.gallery = "polaroid";
    expect(() => parseCustomSettings(opts, basic, d)).toThrow();
    expect(() => parseCustomSettings(opts, premium, d)).not.toThrow();
  });
});

describe("sections: permutasi lengkap + aturan kunci", () => {
  it("kehilangan satu section ditolak", () => {
    const d = valid();
    d.sections = d.sections.filter((s) => s.id !== "gallery");
    expect(() => parseCustomSettings(opts, premium, d)).toThrow();
  });

  it("section duplikat ditolak", () => {
    const d = valid();
    const q = d.sections.find((s) => s.id === "quote");
    if (!q) throw new Error("fixture rusak");
    d.sections.push({ ...q });
    expect(() => parseCustomSettings(opts, premium, d)).toThrow();
  });

  it("section tak dikenal ditolak", () => {
    const d = valid();
    const first = d.sections[0];
    if (!first) throw new Error("fixture rusak");
    first.id = "iklan";
    expect(() => parseCustomSettings(opts, premium, d)).toThrow();
  });

  it("menyembunyikan section wajib (couple/rsvp/hero) ditolak", () => {
    for (const lockedId of ["hero", "couple", "rsvp"]) {
      const d = valid();
      const row = d.sections.find((s) => s.id === lockedId);
      if (!row) throw new Error("fixture rusak");
      row.visible = false;
      expect(() => parseCustomSettings(opts, premium, d), lockedId).toThrow();
    }
  });

  it("memindah hero (reorder:false) ditolak", () => {
    const d = valid();
    const [hero, ...rest] = d.sections;
    if (!hero) throw new Error("fixture rusak");
    d.sections = [...rest.slice(0, 2), hero, ...rest.slice(2)];
    expect(() => parseCustomSettings(opts, premium, d)).toThrow(/dipindah/);
  });

  it("reorder yang sah diterima & urutan dipertahankan", () => {
    const d = valid();
    // tukar quote <-> countdown (keduanya reorder:true)
    const ids = d.sections.map((s) => s.id);
    const qi = ids.indexOf("quote");
    const ci = ids.indexOf("countdown");
    const tmp = d.sections[qi];
    const other = d.sections[ci];
    if (!tmp || !other) throw new Error("fixture rusak");
    d.sections[qi] = other;
    d.sections[ci] = tmp;
    const parsed = parseCustomSettings(opts, premium, d);
    expect(parsed.sections.map((s) => s.id)).toEqual(
      d.sections.map((s) => s.id),
    );
  });

  it("menyembunyikan section opsional (gallery) diterima", () => {
    const d = valid();
    const row = d.sections.find((s) => s.id === "gallery");
    if (!row) throw new Error("fixture rusak");
    row.visible = false;
    expect(() => parseCustomSettings(opts, basic, d)).not.toThrow();
  });
});

describe("schema builder", () => {
  it("safeParse memberi daftar issue (bukan lempar) bila dibutuhkan caller", () => {
    const schema = buildCustomSettingsSchema(opts, basic);
    const d = valid();
    d.accent = "#123456";
    d.fontPair = "c";
    const res = schema.safeParse(d);
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("accent");
      expect(paths).toContain("fontPair");
    }
  });
});
