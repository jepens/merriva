import { describe, expect, it } from "vitest";

import {
  fillTemplate,
  personalLink,
  waDigits,
  waMeUrl,
} from "@/lib/share-message";

describe("fillTemplate", () => {
  it("mengganti semua variabel (termasuk kemunculan berulang)", () => {
    const out = fillTemplate("Halo {nama}, {nama}! Buka {link} untuk {acara}", {
      nama: "Budi",
      link: "https://x/y?g=t",
      acara: "pernikahan A & B",
    });
    expect(out).toBe(
      "Halo Budi, Budi! Buka https://x/y?g=t untuk pernikahan A & B",
    );
  });

  it("membiarkan placeholder tak dikenal apa adanya", () => {
    expect(
      fillTemplate("{nama} {lain}", {
        nama: "Budi",
        link: "l",
        acara: "a",
      }),
    ).toBe("Budi {lain}");
  });
});

describe("personalLink", () => {
  it("merakit link personal ?g=token", () => {
    expect(personalLink("https://merriva.id", "andi-sinta", "abc123")).toBe(
      "https://merriva.id/andi-sinta?g=abc123",
    );
  });
});

describe("waDigits", () => {
  it("membuang + dan non-digit", () => {
    expect(waDigits("+62 812-3456-7890")).toBe("6281234567890");
  });
  it("null bila kosong / terlalu pendek", () => {
    expect(waDigits(null)).toBeNull();
    expect(waDigits("")).toBeNull();
    expect(waDigits("123")).toBeNull();
  });
});

describe("waMeUrl", () => {
  it("merakit tautan wa.me dengan teks ter-encode", () => {
    const url = waMeUrl("+6281234567890", "Halo, ini tes & uji");
    expect(url).toBe(
      "https://wa.me/6281234567890?text=Halo%2C%20ini%20tes%20%26%20uji",
    );
  });
  it("null bila nomor tak valid", () => {
    expect(waMeUrl(null, "x")).toBeNull();
    expect(waMeUrl("12", "x")).toBeNull();
  });
});
