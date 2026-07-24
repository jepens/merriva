import { describe, expect, it } from "vitest";

import { eventInputSchema } from "@/lib/validation/content/event";

describe("eventInputSchema", () => {
  it("menerima sesi valid", () => {
    const r = eventInputSchema.safeParse({
      name: "Akad Nikah",
      startAt: "2026-08-15T09:00",
    });
    expect(r.success).toBe(true);
  });

  it("menolak nama kosong & waktu tidak valid", () => {
    expect(
      eventInputSchema.safeParse({ name: "", startAt: "2026-08-15T09:00" })
        .success,
    ).toBe(false);
    expect(
      eventInputSchema.safeParse({ name: "Akad", startAt: "bukan-tanggal" })
        .success,
    ).toBe(false);
  });

  it("menolak waktu selesai sebelum mulai (error pada endAt)", () => {
    const r = eventInputSchema.safeParse({
      name: "Resepsi",
      startAt: "2026-08-15T18:00",
      endAt: "2026-08-15T17:00",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.endAt).toBeDefined();
    }
  });

  it("mapsUrl kosong → undefined, URL tak valid ditolak", () => {
    const ok = eventInputSchema.safeParse({
      name: "Akad",
      startAt: "2026-08-15T09:00",
      mapsUrl: "",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.mapsUrl).toBeUndefined();

    expect(
      eventInputSchema.safeParse({
        name: "Akad",
        startAt: "2026-08-15T09:00",
        mapsUrl: "bukan-url",
      }).success,
    ).toBe(false);
  });
});
