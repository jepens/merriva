import { describe, expect, it } from "vitest";

import {
  isSectionVisible,
  settingsSchema,
} from "@/lib/validation/content/settings";

describe("settingsSchema", () => {
  it("mengisi default (timezone WIB, sections kosong, moderasi off)", () => {
    const r = settingsSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.timezone).toBe("Asia/Jakarta");
      expect(r.data.moderateGuestbook).toBe(false);
      expect(r.data.sections).toEqual({});
    }
  });

  it("menolak timezone di luar Indonesia & uuid lagu tidak valid", () => {
    expect(settingsSchema.safeParse({ timezone: "Asia/Tokyo" }).success).toBe(
      false,
    );
    expect(settingsSchema.safeParse({ songId: "bukan-uuid" }).success).toBe(
      false,
    );
  });
});

describe("isSectionVisible", () => {
  it("section tampil kecuali di-set false eksplisit", () => {
    const settings = settingsSchema.parse({ sections: { gallery: false } });
    expect(isSectionVisible(settings, "gallery")).toBe(false);
    expect(isSectionVisible(settings, "hero")).toBe(true);
  });
});
