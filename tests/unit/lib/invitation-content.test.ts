import { describe, expect, it } from "vitest";

import { parseContentForRender } from "@/lib/invitation-content";

describe("parseContentForRender", () => {
  it("konten lengkap → strict apa adanya", () => {
    const raw = {
      category: "wedding",
      groom: { name: "Bima" },
      bride: { name: "Rina" },
      story: [],
      envelope: { enabled: false, banks: [], ewallets: [] },
    };
    const out = parseContentForRender(raw, "wedding");
    expect(out.category).toBe("wedding");
    if (out.category === "wedding") {
      expect(out.groom.name).toBe("Bima");
      expect(out.bride.name).toBe("Rina");
    }
  });

  it("draft belum lengkap → coerce (nama kosong, story tak lengkap dibuang)", () => {
    const raw = {
      category: "wedding",
      groom: { nickname: "Bima" }, // tanpa name
      bride: {},
      story: [
        { title: "Bertemu", narrative: "..." },
        { title: "Tanpa narasi" }, // dibuang
      ],
      quote: { text: "" }, // kosong → undefined
      envelope: {
        enabled: true,
        banks: [{ bank: "BCA", number: "123", holder: "Rina" }],
      },
    };
    const out = parseContentForRender(raw, "wedding");
    if (out.category !== "wedding") throw new Error("expected wedding");
    expect(out.groom.name).toBe("Bima"); // fallback ke nickname
    expect(out.bride.name).toBe("");
    expect(out.story).toHaveLength(1); // entri tanpa narasi dibuang
    expect(out.quote).toBeUndefined();
    expect(out.envelope.enabled).toBe(true);
    expect(out.envelope.banks).toHaveLength(1);
    expect(out.envelope.banks[0]).toEqual({
      bank: "BCA",
      number: "123",
      holder: "Rina",
    });
  });

  it("konten sampah → kerangka kosong sesuai kategori", () => {
    const out = parseContentForRender(null, "wedding");
    expect(out.category).toBe("wedding");
    if (out.category === "wedding") {
      expect(out.groom.name).toBe("");
      expect(out.story).toEqual([]);
      expect(out.envelope.enabled).toBe(false);
    }
  });
});
