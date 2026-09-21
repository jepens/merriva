import { describe, expect, it } from "vitest";

import { parseContentForRender } from "@/lib/invitation-content";
import {
  DEFAULT_SETTINGS,
  editableContent,
  emptyContent,
  weddingContentSchema,
} from "@/lib/validation/content";
import { saveDraftSchema } from "@/lib/validation/invitation";

/**
 * Regresi amplop digital (DECISIONS #41). Tombol "Tambah rekening" menambah
 * baris KOSONG; skema draft dulu mewarisi `bankAccountSchema` yang mewajibkan
 * ketiga kolom, sehingga autosave menolak SELURUH form sampai baris itu terisi
 * lengkap — perubahan di langkah lain ikut hilang tanpa terasa.
 */

function draftDengan(envelope: unknown) {
  return saveDraftSchema.safeParse({
    content: { ...emptyContent("wedding"), envelope },
    settings: DEFAULT_SETTINGS,
    eventDate: "",
    events: [],
  });
}

describe("amplop pada draft (autosave)", () => {
  it("baris rekening & e-wallet yang baru ditambah (kosong) TIDAK menolak autosave", () => {
    const r = draftDengan({
      enabled: true,
      banks: [{ bank: "", number: "", holder: "" }],
      ewallets: [{ provider: "", number: "" }],
    });
    expect(r.success).toBe(true);
  });

  it("baris setengah terisi juga diterima selagi pemilik masih mengetik", () => {
    const r = draftDengan({
      enabled: true,
      banks: [{ bank: "BCA", number: "", holder: "" }],
      ewallets: [{ provider: "GoPay", number: "" }],
    });
    expect(r.success).toBe(true);
  });

  it("batas panjang & jumlah baris tetap ditegakkan pada draft", () => {
    const tujuh = Array.from({ length: 7 }, () => ({
      bank: "",
      number: "",
      holder: "",
    }));
    expect(
      draftDengan({ enabled: true, banks: tujuh, ewallets: [] }).success,
    ).toBe(false);
    const terlaluPanjang = draftDengan({
      enabled: true,
      banks: [{ bank: "a".repeat(61), number: "", holder: "" }],
      ewallets: [],
    });
    expect(terlaluPanjang.success).toBe(false);
  });
});

describe("amplop pada skema strict & render tetap ketat", () => {
  it("skema strict masih MENOLAK rekening tanpa nomor (tamu tak boleh melihat baris cacat)", () => {
    const r = weddingContentSchema.safeParse({
      category: "wedding",
      groom: { name: "Bima" },
      bride: { name: "Rina" },
      envelope: {
        enabled: true,
        banks: [{ bank: "BCA", number: "", holder: "Rina" }],
      },
    });
    expect(r.success).toBe(false);
  });

  it("render membuang baris yang belum lengkap, menyimpan yang lengkap", () => {
    const konten = parseContentForRender(
      {
        ...emptyContent("wedding"),
        envelope: {
          enabled: true,
          banks: [
            { bank: "BCA", number: "", holder: "" },
            { bank: "BNI", number: "123", holder: "Rina" },
          ],
          ewallets: [{ provider: "GoPay", number: "" }],
        },
      },
      "wedding",
    );
    expect(konten.envelope.banks).toEqual([
      { bank: "BNI", number: "123", holder: "Rina" },
    ]);
    expect(konten.envelope.ewallets).toEqual([]);
  });
});

describe("konten yang dimuat ke editor (editableContent)", () => {
  it("isi yang melebihi batas TIDAK diganti kosong — autosave pertama akan menimpanya di DB", () => {
    const raw = {
      ...emptyContent("wedding"),
      title: "Rina & Bima",
      story: [{ title: "Awal", narrative: "a".repeat(2001) }],
    };
    const c = editableContent(raw, "wedding");
    expect(c.category).toBe("wedding");
    expect(c.category === "wedding" && c.title).toBe("Rina & Bima");
    expect(c.category === "wedding" && c.story[0]?.narrative).toHaveLength(
      2001,
    );
  });

  it("isi valid diparse normal (default diisi)", () => {
    const c = editableContent(
      { category: "family", eventName: "Aqiqah" },
      "family",
    );
    expect(c.category === "family" && c.wishes).toEqual([]);
  });

  it("baris rusak (bukan objek / kategori lain) jatuh ke konten kosong kategori itu", () => {
    expect(editableContent(null, "corporate").category).toBe("corporate");
    expect(editableContent({ category: "wedding" }, "family").category).toBe(
      "family",
    );
  });
});
