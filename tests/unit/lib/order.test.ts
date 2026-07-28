import { describe, expect, it } from "vitest";

import { generateOrderCode } from "@/lib/order";

describe("generateOrderCode", () => {
  it("berbentuk MRV-XXXXXX dengan alfabet non-ambigu", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateOrderCode();
      // Prefiks + 6 char dari alfabet non-ambigu (tanpa O, 0, I, 1).
      expect(code).toMatch(/^MRV-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("praktis unik antar pemanggilan (tanpa tabrakan pada sampel besar)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) seen.add(generateOrderCode());
    // 32^6 ruang → tabrakan pada 2000 sampel sangat tak mungkin.
    expect(seen.size).toBe(2000);
  });
});
