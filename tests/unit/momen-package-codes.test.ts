import { describe, expect, it } from "vitest";

import {
  MOMEN_ADDON_CODES,
  MOMEN_FREE_CODE,
  MOMEN_PAID_CODES,
  isMomenFreeCode,
  momenAddonCodeSchema,
  momenPaidCodeSchema,
} from "@/lib/momen/package-codes";

describe("momen package codes", () => {
  it("tier gratis terpisah dari tier berbayar", () => {
    expect(MOMEN_FREE_CODE).toBe("momen_5");
    expect(MOMEN_PAID_CODES).not.toContain(MOMEN_FREE_CODE);
    expect(MOMEN_ADDON_CODES).toContain(MOMEN_FREE_CODE);
    for (const c of MOMEN_PAID_CODES) expect(MOMEN_ADDON_CODES).toContain(c);
  });

  it("skema BERBAYAR menolak kode gratis dan kode undangan", () => {
    expect(momenPaidCodeSchema.safeParse("momen_50").success).toBe(true);
    expect(momenPaidCodeSchema.safeParse("momen_unlimited").success).toBe(true);
    // Gratis tak boleh lewat jalur bayar (amount 0 → link Pakasir invalid).
    expect(momenPaidCodeSchema.safeParse("momen_5").success).toBe(false);
    // Kode paket undangan bukan add-on.
    expect(momenPaidCodeSchema.safeParse("basic").success).toBe(false);
    expect(momenPaidCodeSchema.safeParse("premium").success).toBe(false);
  });

  it("skema add-on menerima gratis maupun berbayar, menolak lainnya", () => {
    expect(momenAddonCodeSchema.safeParse("momen_5").success).toBe(true);
    expect(momenAddonCodeSchema.safeParse("momen_200").success).toBe(true);
    expect(momenAddonCodeSchema.safeParse("basic").success).toBe(false);
    expect(momenAddonCodeSchema.safeParse("").success).toBe(false);
  });

  it("isMomenFreeCode hanya true untuk momen_5", () => {
    expect(isMomenFreeCode("momen_5")).toBe(true);
    expect(isMomenFreeCode("momen_50")).toBe(false);
    expect(isMomenFreeCode("premium")).toBe(false);
  });
});
