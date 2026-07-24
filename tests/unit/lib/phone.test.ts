import { describe, expect, it } from "vitest";

import { isValidIndonesianPhone, normalizeIndonesianPhone } from "@/lib/phone";

describe("normalizeIndonesianPhone", () => {
  it("menormalkan format 08xx ke E.164", () => {
    expect(normalizeIndonesianPhone("081234567890")).toBe("+6281234567890");
  });

  it("menerima awalan 62 dan +62 dengan pemformatan", () => {
    expect(normalizeIndonesianPhone("6281234567890")).toBe("+6281234567890");
    expect(normalizeIndonesianPhone("+62 812-3456-7890")).toBe(
      "+6281234567890",
    );
  });

  it("menolak nomor non-seluler / terlalu pendek", () => {
    expect(normalizeIndonesianPhone("021234567")).toBeNull(); // landline (bukan 8)
    expect(normalizeIndonesianPhone("0812")).toBeNull(); // terlalu pendek
    expect(normalizeIndonesianPhone("123")).toBeNull();
    expect(normalizeIndonesianPhone("")).toBeNull();
    expect(normalizeIndonesianPhone("abcd")).toBeNull();
  });
});

describe("isValidIndonesianPhone", () => {
  it("true untuk nomor valid, false untuk tidak valid", () => {
    expect(isValidIndonesianPhone("081234567890")).toBe(true);
    expect(isValidIndonesianPhone("+6281234567890")).toBe(true);
    expect(isValidIndonesianPhone("bukan-nomor")).toBe(false);
  });
});
