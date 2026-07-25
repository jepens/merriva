import { describe, expect, it } from "vitest";

import {
  BASIC_LIMITS,
  guestQuotaAvailable,
  photoQuotaAvailable,
  resolveLimits,
} from "@/lib/limits";

// Bentuk JSONB persis seperti yang di-seed migrasi (init_schema §7).
const BASIC_JSON = {
  max_photos: 8,
  max_guests: 150,
  youtube: false,
  all_themes: false,
  watermark: true,
};
const PREMIUM_JSON = {
  max_photos: 20,
  max_guests: null,
  youtube: true,
  all_themes: true,
  watermark: false,
};

describe("resolveLimits", () => {
  it("null/undefined/non-objek → lantai Basic", () => {
    expect(resolveLimits(null)).toEqual(BASIC_LIMITS);
    expect(resolveLimits(undefined)).toEqual(BASIC_LIMITS);
    expect(resolveLimits("nope")).toEqual(BASIC_LIMITS);
    expect(resolveLimits(42)).toEqual(BASIC_LIMITS);
  });

  it("JSONB Basic → nilai Basic", () => {
    expect(resolveLimits(BASIC_JSON)).toEqual({
      maxPhotos: 8,
      maxGuests: 150,
      youtube: false,
      allThemes: false,
      watermark: true,
    });
  });

  it("JSONB Premium → max_guests null = tanpa batas", () => {
    expect(resolveLimits(PREMIUM_JSON)).toEqual({
      maxPhotos: 20,
      maxGuests: null,
      youtube: true,
      allThemes: true,
      watermark: false,
    });
  });

  it("kunci hilang → lantai Basic per-kunci", () => {
    expect(resolveLimits({})).toEqual(BASIC_LIMITS);
    expect(resolveLimits({ max_photos: 30 })).toEqual({
      ...BASIC_LIMITS,
      maxPhotos: 30,
    });
  });

  it("max_guests malformed (0/negatif/tipe lain) → lantai Basic, BUKAN unlimited", () => {
    expect(resolveLimits({ max_guests: 0 }).maxGuests).toBe(150);
    expect(resolveLimits({ max_guests: -5 }).maxGuests).toBe(150);
    expect(resolveLimits({ max_guests: "banyak" }).maxGuests).toBe(150);
  });

  it("max_guests null eksplisit tetap tanpa batas (Premium)", () => {
    expect(resolveLimits({ max_guests: null }).maxGuests).toBeNull();
  });

  it("max_photos malformed → lantai Basic 8", () => {
    expect(resolveLimits({ max_photos: 0 }).maxPhotos).toBe(8);
    expect(resolveLimits({ max_photos: null }).maxPhotos).toBe(8);
    expect(resolveLimits({ max_photos: -1 }).maxPhotos).toBe(8);
  });

  it("flag non-boolean → default Basic", () => {
    expect(resolveLimits({ watermark: "yes" }).watermark).toBe(true);
    expect(resolveLimits({ youtube: 1 }).youtube).toBe(false);
  });
});

describe("guestQuotaAvailable", () => {
  it("ada batas: tersedia selama jumlah < batas", () => {
    const l = resolveLimits(BASIC_JSON); // 150
    expect(guestQuotaAvailable(l, 149)).toBe(true);
    expect(guestQuotaAvailable(l, 150)).toBe(false);
    expect(guestQuotaAvailable(l, 200)).toBe(false);
  });

  it("tanpa batas (Premium) → selalu tersedia", () => {
    const l = resolveLimits(PREMIUM_JSON); // null
    expect(guestQuotaAvailable(l, 100000)).toBe(true);
  });
});

describe("photoQuotaAvailable", () => {
  it("tersedia selama jumlah < batas", () => {
    const l = resolveLimits(BASIC_JSON); // 8
    expect(photoQuotaAvailable(l, 7)).toBe(true);
    expect(photoQuotaAvailable(l, 8)).toBe(false);
  });
});
