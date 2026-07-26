import { describe, expect, it } from "vitest";

import { guestSchema } from "@/lib/validation/guest";

describe("guestSchema", () => {
  it("menerima input minimal (nama saja) + pax default 2", () => {
    const r = guestSchema.safeParse({ name: "Budi" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.paxAllocated).toBe(2);
      expect(r.data.phone).toBeUndefined();
      expect(r.data.groupLabel).toBeUndefined();
    }
  });

  it("menolak nama kosong / hanya spasi", () => {
    expect(guestSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("nomor 08xxx dinormalkan ke E.164 (+62…)", () => {
    const r = guestSchema.safeParse({ name: "Budi", phone: "0812-3456-7890" });
    expect(r.success && r.data.phone).toBe("+6281234567890");
  });

  it("nomor 62xxx & +62xxx juga dinormalkan", () => {
    const a = guestSchema.safeParse({ name: "A", phone: "6281234567890" });
    const b = guestSchema.safeParse({ name: "B", phone: "+62 812 3456 7890" });
    expect(a.success && a.data.phone).toBe("+6281234567890");
    expect(b.success && b.data.phone).toBe("+6281234567890");
  });

  it("nomor tidak valid ditolak (bukan seluler Indonesia)", () => {
    expect(
      guestSchema.safeParse({ name: "Budi", phone: "12345" }).success,
    ).toBe(false);
  });

  it("nomor kosong → undefined (opsional)", () => {
    const r = guestSchema.safeParse({ name: "Budi", phone: "   " });
    expect(r.success).toBe(true);
    expect(r.success && r.data.phone).toBeUndefined();
  });

  it("pax dikoersi dari string; batas 1–20 ditegakkan", () => {
    const r = guestSchema.safeParse({ name: "A", paxAllocated: "3" });
    expect(r.success && r.data.paxAllocated).toBe(3);
    expect(guestSchema.safeParse({ name: "A", paxAllocated: 0 }).success).toBe(
      false,
    );
    expect(guestSchema.safeParse({ name: "A", paxAllocated: 21 }).success).toBe(
      false,
    );
  });

  it("label & catatan: kosong → undefined, dan di-trim", () => {
    const r = guestSchema.safeParse({
      name: "Budi",
      groupLabel: "  Keluarga  ",
      notes: "   ",
    });
    expect(r.success && r.data.groupLabel).toBe("Keluarga");
    expect(r.success && r.data.notes).toBeUndefined();
  });

  it("label & catatan terlalu panjang ditolak", () => {
    expect(
      guestSchema.safeParse({ name: "A", groupLabel: "x".repeat(41) }).success,
    ).toBe(false);
    expect(
      guestSchema.safeParse({ name: "A", notes: "x".repeat(301) }).success,
    ).toBe(false);
  });
});
