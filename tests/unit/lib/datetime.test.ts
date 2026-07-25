import { describe, expect, it } from "vitest";

import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
  utcToLocal,
} from "@/lib/datetime";

describe("localToUtc", () => {
  it("WIB 10:00 → 03:00 UTC", () => {
    expect(localToUtc("2026-08-15T10:00", "Asia/Jakarta")).toBe(
      "2026-08-15T03:00:00.000Z",
    );
  });

  it("WITA 10:00 → 02:00 UTC; WIT 10:00 → 01:00 UTC", () => {
    expect(localToUtc("2026-08-15T10:00", "Asia/Makassar")).toBe(
      "2026-08-15T02:00:00.000Z",
    );
    expect(localToUtc("2026-08-15T10:00", "Asia/Jayapura")).toBe(
      "2026-08-15T01:00:00.000Z",
    );
  });

  it("kosong / tak valid → null", () => {
    expect(localToUtc("", "Asia/Jakarta")).toBeNull();
    expect(localToUtc("bukan-tanggal", "Asia/Jakarta")).toBeNull();
  });
});

describe("utcToLocal", () => {
  it("kebalikan localToUtc (round-trip WIB)", () => {
    const utc = localToUtc("2026-08-15T10:00", "Asia/Jakarta")!;
    expect(utcToLocal(utc, "Asia/Jakarta")).toBe("2026-08-15T10:00");
  });

  it("03:00 UTC → 12:00 WIT", () => {
    expect(utcToLocal("2026-08-15T03:00:00.000Z", "Asia/Jayapura")).toBe(
      "2026-08-15T12:00",
    );
  });

  it("tak valid → ''", () => {
    expect(utcToLocal("nope", "Asia/Jakarta")).toBe("");
  });
});

describe("formatEventDateTime", () => {
  it("UTC → tampilan Indonesia per zona", () => {
    const wib = formatEventDateTime("2026-11-08T02:00:00.000Z", "Asia/Jakarta");
    expect(wib).toEqual({
      weekday: "Minggu",
      date: "8 November 2026",
      time: "09.00",
      tzLabel: "WIB",
      full: "Minggu, 8 November 2026 · 09.00 WIB",
    });
    expect(
      formatEventDateTime("2026-11-08T02:00:00.000Z", "Asia/Makassar")?.time,
    ).toBe("10.00");
    expect(
      formatEventDateTime("2026-11-08T02:00:00.000Z", "Asia/Jayapura")?.time,
    ).toBe("11.00");
  });

  it("tak valid → null", () => {
    expect(formatEventDateTime("nope", "Asia/Jakarta")).toBeNull();
  });
});

describe("formatDateOnly", () => {
  it("tanggal → weekday + tanggal Indonesia", () => {
    expect(formatDateOnly("2026-11-08")).toEqual({
      weekday: "Minggu",
      date: "8 November 2026",
    });
  });

  it("tanggal tak valid → null", () => {
    expect(formatDateOnly("bukan")).toBeNull();
    expect(formatDateOnly("2026-02-30")).toBeNull();
    expect(formatDateOnly("2026-13-01")).toBeNull();
  });
});
