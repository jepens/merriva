import { describe, expect, it } from "vitest";

import {
  draftContentSchema,
  weddingDraftSchema,
} from "@/lib/validation/content";

describe("weddingDraftSchema (longgar untuk autosave)", () => {
  it("menerima wedding belum lengkap (nama & judul kosong)", () => {
    const r = weddingDraftSchema.safeParse({
      category: "wedding",
      groom: {},
      bride: {},
    });
    expect(r.success).toBe(true);
  });

  it("menerima URL / quote setengah jadi (format tak divalidasi saat draft)", () => {
    const r = weddingDraftSchema.safeParse({
      category: "wedding",
      groom: {},
      bride: {},
      youtubeUrl: "http",
      quote: { source: "x" },
    });
    expect(r.success).toBe(true);
  });

  it("TETAP menolak foto berupa URL vendor (keamanan storage)", () => {
    const r = weddingDraftSchema.safeParse({
      category: "wedding",
      groom: { photo: "https://vendor.example/x.webp" },
      bride: {},
    });
    expect(r.success).toBe(false);
  });

  it("TETAP membatasi jumlah entri cerita (max 20)", () => {
    const story = Array.from({ length: 21 }, () => ({ title: "a" }));
    const r = weddingDraftSchema.safeParse({
      category: "wedding",
      groom: {},
      bride: {},
      story,
    });
    expect(r.success).toBe(false);
  });
});

describe("draftContentSchema (union)", () => {
  it("memilih family & menerima eventName kosong", () => {
    expect(draftContentSchema.safeParse({ category: "family" }).success).toBe(
      true,
    );
  });
});
