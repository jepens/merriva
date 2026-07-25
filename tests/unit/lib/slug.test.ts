import { describe, expect, it } from "vitest";

import { isReservedSlug, slugify, slugSchema } from "@/lib/slug";

function ok(input: string): boolean {
  return slugSchema.safeParse(input).success;
}

function firstError(input: string): string | undefined {
  const r = slugSchema.safeParse(input);
  return r.success ? undefined : r.error.issues[0]?.message;
}

describe("slugSchema", () => {
  it("menerima slug valid & menormalkan (trim + lowercase)", () => {
    expect(slugSchema.parse("rina-dan-bima")).toBe("rina-dan-bima");
    expect(slugSchema.parse("  Rina-Dan-Bima  ")).toBe("rina-dan-bima");
    expect(ok("abc")).toBe(true);
    expect(ok("a1b2c3")).toBe(true);
  });

  it("menolak terlalu pendek / terlalu panjang", () => {
    expect(ok("ab")).toBe(false);
    expect(ok("a".repeat(61))).toBe(false);
    expect(ok("a".repeat(60))).toBe(true);
  });

  it("menolak karakter di luar [a-z0-9-]", () => {
    expect(ok("rina bima")).toBe(false); // spasi
    expect(ok("rina_bima")).toBe(false); // garis bawah
    expect(ok("rina.bima")).toBe(false); // titik
    expect(ok("riná")).toBe(false); // diakritik
  });

  it("menolak hubung di tepi & berurutan", () => {
    expect(ok("-rina")).toBe(false);
    expect(ok("rina-")).toBe(false);
    expect(ok("rina--bima")).toBe(false);
  });

  it("menolak awalan sistem draft- dan kata terpesan", () => {
    expect(ok("draft-abc")).toBe(false);
    expect(ok("dashboard")).toBe(false);
    expect(ok("api")).toBe(false);
    expect(ok("admin")).toBe(false);
  });

  it("memberi pesan Indonesia yang bermakna", () => {
    expect(firstError("ab")).toMatch(/Minimal/);
    expect(firstError("rina bima")).toMatch(/huruf kecil/i);
    expect(firstError("dashboard")).toMatch(/tidak tersedia/i);
  });
});

describe("isReservedSlug", () => {
  it("tak peka huruf besar/kecil", () => {
    expect(isReservedSlug("DASHBOARD")).toBe(true);
    expect(isReservedSlug("Api")).toBe(true);
    expect(isReservedSlug("rina-dan-bima")).toBe(false);
  });
});

describe("slugify", () => {
  it("mengubah teks bebas → kandidat slug", () => {
    expect(slugify("Rina & Bima")).toBe("rina-bima");
    expect(slugify("  Halo  Dunia  ")).toBe("halo-dunia");
    expect(slugify("Café---Del/Mar")).toBe("caf-del-mar");
  });

  it("merapatkan & memangkas tanda hubung", () => {
    expect(slugify("--a--b--")).toBe("a-b");
    expect(slugify("!!!")).toBe("");
  });

  it("memotong pada batas maksimum tanpa hubung menggantung", () => {
    const long = "a".repeat(58) + " bcd";
    const out = slugify(long);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("-")).toBe(false);
  });
});
