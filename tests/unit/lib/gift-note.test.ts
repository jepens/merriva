import { describe, expect, it } from "vitest";

import {
  giftNoteSchema,
  rsvpModerationSchema,
} from "@/lib/validation/guestbook";

const base = {
  slug: "andi-sinta",
  guestName: "Budi",
  type: "transfer" as const,
};

describe("giftNoteSchema", () => {
  it("menerima input valid minimal (tanpa nominal/pesan)", () => {
    expect(giftNoteSchema.safeParse(base).success).toBe(true);
  });

  it("menolak nama kosong / hanya spasi", () => {
    expect(giftNoteSchema.safeParse({ ...base, guestName: "  " }).success).toBe(
      false,
    );
  });

  it("type harus transfer/gift", () => {
    expect(giftNoteSchema.safeParse({ ...base, type: "cash" }).success).toBe(
      false,
    );
  });

  it("nominal: buang non-digit ('Rp 100.000' → 100000)", () => {
    const r = giftNoteSchema.safeParse({ ...base, amount: "Rp 100.000" });
    expect(r.success && r.data.amount).toBe(100000);
  });

  it("nominal: string kosong → undefined (opsional)", () => {
    const r = giftNoteSchema.safeParse({ ...base, amount: "" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.amount).toBeUndefined();
  });

  it("nominal: angka pecahan dibulatkan ke bawah (integer IDR)", () => {
    const r = giftNoteSchema.safeParse({ ...base, amount: 150000.9 });
    expect(r.success && r.data.amount).toBe(150000);
  });

  it("nominal di atas 1 miliar ditolak", () => {
    expect(
      giftNoteSchema.safeParse({ ...base, amount: "2000000000" }).success,
    ).toBe(false);
  });

  it("pesan: kosong → undefined, dan di-trim", () => {
    const r = giftNoteSchema.safeParse({ ...base, note: "  terima kasih  " });
    expect(r.success && r.data.note).toBe("terima kasih");
  });

  it("pesan terlalu panjang ditolak", () => {
    expect(
      giftNoteSchema.safeParse({ ...base, note: "x".repeat(301) }).success,
    ).toBe(false);
  });

  it("honeypot (website) lolos skema — dicek di action", () => {
    const r = giftNoteSchema.safeParse({ ...base, website: "http://spam" });
    expect(r.success && r.data.website).toBe("http://spam");
  });
});

describe("rsvpModerationSchema", () => {
  it("menerima patch is_hidden saja", () => {
    const r = rsvpModerationSchema.safeParse({ isHidden: true });
    expect(r.success && r.data.isHidden).toBe(true);
  });

  it("menerima patch is_approved saja", () => {
    expect(rsvpModerationSchema.safeParse({ isApproved: true }).success).toBe(
      true,
    );
  });

  it("menolak patch kosong (tak ada perubahan)", () => {
    expect(rsvpModerationSchema.safeParse({}).success).toBe(false);
  });

  it("mengabaikan field non-moderasi (tak bisa menulis ulang data tamu)", () => {
    const r = rsvpModerationSchema.safeParse({
      isHidden: true,
      guestName: "Peretas",
      pax: 999,
    });
    expect(r.success).toBe(true);
    // Field asing tak ikut ter-parse → tak akan pernah dikirim ke UPDATE.
    expect(r.success && "guestName" in r.data).toBe(false);
  });
});
