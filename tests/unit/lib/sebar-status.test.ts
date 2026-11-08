import { describe, expect, it } from "vitest";

import {
  matchesFilter,
  matchesSearch,
  sebarCounts,
  sebarStatus,
  type SebarGuestState,
} from "@/lib/sebar-status";

const g = (s: Partial<SebarGuestState>): SebarGuestState => ({
  sent: false,
  opened: false,
  rsvp: null,
  ...s,
});

describe("sebarStatus — status tertinggi yang tampil", () => {
  it("urutan: belum → terkirim → dibuka → hadir/tidak hadir", () => {
    expect(sebarStatus(g({}))).toBe("unsent");
    expect(sebarStatus(g({ sent: true }))).toBe("sent");
    expect(sebarStatus(g({ sent: true, opened: true }))).toBe("opened");
    expect(sebarStatus(g({ opened: true, rsvp: "yes" }))).toBe("attending");
    expect(sebarStatus(g({ rsvp: "no" }))).toBe("notAttending");
  });

  it("DIBUKA tanpa tanda terkirim tetap 'dibuka' (tamu jelas sudah menerima link)", () => {
    // Mis. pemilik menempel link manual, atau membatalkan tanda — status
    // objektif tak boleh turun karena tanda pemilik.
    expect(sebarStatus(g({ sent: false, opened: true }))).toBe("opened");
  });
});

describe("matchesFilter — kumulatif", () => {
  const belum = g({});
  const kirim = g({ sent: true });
  const buka = g({ opened: true });
  const rsvp = g({ rsvp: "no" });

  it("'Belum dikirim' = antrean kerja: hanya yang belum sampai sama sekali", () => {
    expect(
      [belum, kirim, buka, rsvp].map((x) => matchesFilter(x, "unsent")),
    ).toEqual([true, false, false, false]);
  });

  it("'Terkirim' memuat yang dibuka & sudah RSVP; 'Dibuka' memuat yang RSVP", () => {
    expect(
      [belum, kirim, buka, rsvp].map((x) => matchesFilter(x, "sent")),
    ).toEqual([false, true, true, true]);
    expect(
      [belum, kirim, buka, rsvp].map((x) => matchesFilter(x, "opened")),
    ).toEqual([false, false, true, true]);
    expect(
      [belum, kirim, buka, rsvp].map((x) => matchesFilter(x, "rsvp")),
    ).toEqual([false, false, false, true]);
    expect(
      [belum, kirim, buka, rsvp].every((x) => matchesFilter(x, "all")),
    ).toBe(true);
  });
});

describe("sebarCounts", () => {
  it("menghitung progres untuk header", () => {
    expect(
      sebarCounts([
        g({}),
        g({}),
        g({ sent: true }),
        g({ opened: true }),
        g({ sent: true, opened: true, rsvp: "yes" }),
      ]),
    ).toEqual({ total: 5, unsent: 2, sent: 3, opened: 2, rsvp: 1 });
  });
});

describe("matchesSearch", () => {
  it("nama atau grup, tak peka huruf besar & spasi ganda", () => {
    const tamu = { name: "Ibu  Lina", groupLabel: "ABA BSI" };
    expect(matchesSearch(tamu, "ibu lina")).toBe(true);
    expect(matchesSearch(tamu, "bsi")).toBe(true);
    expect(matchesSearch(tamu, "niken")).toBe(false);
    expect(matchesSearch(tamu, "   ")).toBe(true);
    expect(matchesSearch({ name: "Koto", groupLabel: null }, "koto")).toBe(
      true,
    );
  });
});
