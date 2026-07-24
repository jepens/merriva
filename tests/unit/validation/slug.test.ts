import { describe, expect, it } from "vitest";

import {
  isReservedSlug,
  normalizeSlug,
  slugSchema,
} from "@/lib/validation/slug";

describe("normalizeSlug", () => {
  it("mengubah teks bebas menjadi slug bersih", () => {
    expect(normalizeSlug("Rina & Bima!!")).toBe("rina-bima");
    expect(normalizeSlug("  --Hello__World--  ")).toBe("hello-world");
    expect(normalizeSlug("Acara   Keluarga 2026")).toBe("acara-keluarga-2026");
  });
});

describe("slugSchema", () => {
  it("menerima slug valid & menormalkan ke lowercase", () => {
    const r = slugSchema.safeParse("Rina-Dan-Bima");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("rina-dan-bima");
  });

  it("menolak terlalu pendek, spasi, dan karakter ilegal", () => {
    expect(slugSchema.safeParse("ab").success).toBe(false);
    expect(slugSchema.safeParse("rina bima").success).toBe(false);
    expect(slugSchema.safeParse("rina_bima").success).toBe(false);
  });

  it("menolak rute sistem & kata terlarang", () => {
    expect(slugSchema.safeParse("admin").success).toBe(false);
    expect(slugSchema.safeParse("dashboard").success).toBe(false);
    expect(slugSchema.safeParse("undangan-anjing").success).toBe(false);
  });
});

describe("isReservedSlug", () => {
  it("mengenali reserved & aman", () => {
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("rina-dan-bima")).toBe(false);
  });
});
