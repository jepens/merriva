import { describe, expect, it } from "vitest";

import {
  emptyContent,
  invitationContentSchema,
  storagePathSchema,
  youtubeUrlSchema,
} from "@/lib/validation/content";

describe("invitationContentSchema (wedding)", () => {
  const base = {
    category: "wedding" as const,
    groom: { name: "Bima" },
    bride: { name: "Rina" },
  };

  it("menerima konten minimal & mengisi default (story, envelope)", () => {
    const r = invitationContentSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success && r.data.category === "wedding") {
      expect(r.data.story).toEqual([]);
      expect(r.data.envelope).toEqual({
        enabled: false,
        banks: [],
        ewallets: [],
      });
    }
  });

  it("menolak nama mempelai kosong", () => {
    const r = invitationContentSchema.safeParse({
      ...base,
      groom: { name: "" },
    });
    expect(r.success).toBe(false);
  });

  it("menolak foto berupa URL vendor (harus path relatif)", () => {
    const r = invitationContentSchema.safeParse({
      ...base,
      groom: { name: "Bima", photo: "https://vendor.example/x.webp" },
    });
    expect(r.success).toBe(false);
  });

  it("default envelope memberi array segar tiap parse (anti-aliasing)", () => {
    const a = invitationContentSchema.parse(base);
    const b = invitationContentSchema.parse(base);
    if (a.category === "wedding" && b.category === "wedding") {
      expect(a.envelope.banks).not.toBe(b.envelope.banks);
      a.envelope.banks.push({ bank: "BCA", number: "1", holder: "X" });
      expect(b.envelope.banks).toHaveLength(0);
    }
  });
});

describe("invitationContentSchema (discriminated union)", () => {
  it("memilih skema keluarga & mengisi default wishes", () => {
    const r = invitationContentSchema.safeParse({
      category: "family",
      eventName: "Khitanan Fulan",
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.category === "family") {
      expect(r.data.wishes).toEqual([]);
    }
  });

  it("menolak corporate tanpa eventName", () => {
    expect(
      invitationContentSchema.safeParse({ category: "corporate" }).success,
    ).toBe(false);
  });

  it("menolak kategori tak dikenal", () => {
    expect(
      invitationContentSchema.safeParse({ category: "birthday" }).success,
    ).toBe(false);
  });
});

describe("storagePathSchema & youtubeUrlSchema", () => {
  it("path relatif diterima; URL / protocol-relative / traversal ditolak", () => {
    expect(storagePathSchema.safeParse("inv/abc/1600.webp").success).toBe(true);
    expect(storagePathSchema.safeParse("https://x/y.webp").success).toBe(false);
    // Temuan review M1.2: schemeless vendor host & traversal harus ditolak.
    expect(storagePathSchema.safeParse("//vendor.example/x.webp").success).toBe(
      false,
    );
    expect(storagePathSchema.safeParse("../../songs/secret.webp").success).toBe(
      false,
    );
    expect(storagePathSchema.safeParse("inv/a\\b.webp").success).toBe(false);
  });

  it("hanya menerima tautan YouTube", () => {
    expect(youtubeUrlSchema.safeParse("https://youtu.be/abc123").success).toBe(
      true,
    );
    expect(youtubeUrlSchema.safeParse("https://vimeo.com/1").success).toBe(
      false,
    );
  });
});

describe("emptyContent", () => {
  it("menghasilkan draft valid-secara-bentuk per kategori dengan array segar", () => {
    const a = emptyContent("wedding");
    const b = emptyContent("wedding");
    expect(a.category).toBe("wedding");
    // Referensi array harus terpisah antar panggilan (anti mutasi bersama).
    if (a.category === "wedding" && b.category === "wedding") {
      expect(a.story).not.toBe(b.story);
      expect(a.envelope.banks).not.toBe(b.envelope.banks);
    }
    expect(emptyContent("corporate").category).toBe("corporate");
    expect(emptyContent("family").category).toBe("family");
  });
});
