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

  it("menormalkan songId kosong ('' dari picker 'Tanpa musik') → undefined", () => {
    // Autosave mengirim settings apa adanya dari form; "" tak boleh menggagalkan
    // parse UUID (kalau tidak, seluruh draft gagal tersimpan saat tanpa musik).
    const r = settingsSchema.safeParse({ songId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.songId).toBeUndefined();

    const valid = "11111111-1111-4111-8111-111111111111";
    const ok = settingsSchema.safeParse({ songId: valid });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.songId).toBe(valid);
  });
});

describe("isSectionVisible", () => {
  it("section tampil kecuali di-set false eksplisit", () => {
    const settings = settingsSchema.parse({ sections: { gallery: false } });
    expect(isSectionVisible(settings, "gallery")).toBe(false);
    expect(isSectionVisible(settings, "hero")).toBe(true);
  });
});
