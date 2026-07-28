import { describe, expect, it } from "vitest";

import { formatIdr } from "@/lib/format";

describe("formatIdr", () => {
  it("memformat ribuan gaya Indonesia dengan prefiks Rp", () => {
    expect(formatIdr(99000)).toBe("Rp99.000");
    expect(formatIdr(199000)).toBe("Rp199.000");
    expect(formatIdr(0)).toBe("Rp0");
    expect(formatIdr(1500000)).toBe("Rp1.500.000");
  });

  it("membulatkan ke bawah (integer IDR) & aman untuk nilai tak wajar", () => {
    expect(formatIdr(99000.9)).toBe("Rp99.000");
    expect(formatIdr(Number.NaN)).toBe("Rp0");
    expect(formatIdr(Number.POSITIVE_INFINITY)).toBe("Rp0");
  });
});
