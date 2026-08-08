import { describe, expect, it } from "vitest";

import { isUserBanned } from "@/lib/admin/display";

describe("isUserBanned", () => {
  it("kosong / null / undefined → tidak ter-ban", () => {
    expect(isUserBanned(null)).toBe(false);
    expect(isUserBanned(undefined)).toBe(false);
    expect(isUserBanned("")).toBe(false);
  });

  it("banned_until di masa lalu / zero-time → tidak ter-ban", () => {
    expect(isUserBanned("2000-01-01T00:00:00Z")).toBe(false);
    expect(isUserBanned("0001-01-01T00:00:00Z")).toBe(false);
  });

  it("banned_until di masa depan → ter-ban", () => {
    expect(isUserBanned("2125-01-01T00:00:00Z")).toBe(true);
  });

  it("string tidak valid → tidak ter-ban (fail-safe)", () => {
    expect(isUserBanned("bukan-tanggal")).toBe(false);
  });
});
