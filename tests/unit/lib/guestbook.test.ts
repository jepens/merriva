import { describe, expect, it } from "vitest";

import { rsvpSchema } from "@/lib/validation/guestbook";

const base = {
  slug: "andi-sinta",
  guestName: "Budi",
  attendance: "yes" as const,
  pax: 2,
};

describe("rsvpSchema", () => {
  it("menerima input valid", () => {
    expect(rsvpSchema.safeParse(base).success).toBe(true);
  });

  it("menolak nama kosong / hanya spasi", () => {
    expect(rsvpSchema.safeParse({ ...base, guestName: "   " }).success).toBe(
      false,
    );
  });

  it("attendance harus yes/no", () => {
    expect(rsvpSchema.safeParse({ ...base, attendance: "maybe" }).success).toBe(
      false,
    );
  });

  it("message: kosong → undefined, dan di-trim", () => {
    const r = rsvpSchema.safeParse({ ...base, message: "   " });
    expect(r.success && r.data.message).toBeUndefined();
    const r2 = rsvpSchema.safeParse({ ...base, message: "  halo  " });
    expect(r2.success && r2.data.message).toBe("halo");
  });

  it("message terlalu panjang ditolak", () => {
    expect(
      rsvpSchema.safeParse({ ...base, message: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("pax dikoersi dari string", () => {
    const r = rsvpSchema.safeParse({ ...base, pax: "3" });
    expect(r.success && r.data.pax).toBe(3);
  });

  it("honeypot (website) lolos skema — dicek di action, bukan sebagai error", () => {
    const r = rsvpSchema.safeParse({ ...base, website: "http://spam" });
    expect(r.success && r.data.website).toBe("http://spam");
  });
});
