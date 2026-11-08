import { describe, expect, it } from "vitest";

import {
  fillTemplate,
  generalLink,
  personalLink,
  waDigits,
  waShareUrl,
} from "@/lib/share-message";

const VARS = {
  nama: "Budi",
  link: "https://x/y?g=t",
  acara: "pernikahan A & B",
  tanggal: "Minggu, 6 Desember 2026",
};

describe("fillTemplate", () => {
  it("mengganti semua variabel (termasuk kemunculan berulang)", () => {
    const out = fillTemplate(
      "Halo {nama}, {nama}! Buka {link} untuk {acara} pada {tanggal}",
      VARS,
    );
    expect(out).toBe(
      "Halo Budi, Budi! Buka https://x/y?g=t untuk pernikahan A & B pada Minggu, 6 Desember 2026",
    );
  });

  it("membiarkan placeholder tak dikenal apa adanya", () => {
    expect(fillTemplate("{nama} {lain}", VARS)).toBe("Budi {lain}");
  });
});

describe("personalLink", () => {
  it("merakit link personal ?g=token", () => {
    expect(personalLink("https://merriva.id", "andi-sinta", "abc123")).toBe(
      "https://merriva.id/andi-sinta?g=abc123",
    );
  });
});

describe("generalLink (pesan umum tanpa token)", () => {
  it("tanpa nama → link polos, TANPA token", () => {
    expect(generalLink("https://merriva.id", "rani-wanda")).toBe(
      "https://merriva.id/rani-wanda",
    );
    expect(generalLink("https://merriva.id", "rani-wanda", "   ")).toBe(
      "https://merriva.id/rani-wanda",
    );
  });

  it("dengan nama → ?to= ter-encode", () => {
    expect(
      generalLink("https://merriva.id", "rani-wanda", "Bu Siti & Kel"),
    ).toBe("https://merriva.id/rani-wanda?to=Bu+Siti+%26+Kel");
  });

  it("nama dibersihkan dari < > dan dipotong 60 karakter (sejalan halaman publik)", () => {
    const url = new URL(
      generalLink("https://merriva.id", "s", `<b>${"x".repeat(80)}`),
    );
    const to = url.searchParams.get("to") ?? "";
    expect(to).not.toMatch(/[<>]/);
    expect(to.length).toBe(60);
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

describe("waShareUrl", () => {
  it("bernomor → wa.me/{nomor} dengan teks ter-encode", () => {
    expect(waShareUrl("+6281234567890", "Halo, ini tes & uji")).toBe(
      "https://wa.me/6281234567890?text=Halo%2C%20ini%20tes%20%26%20uji",
    );
  });

  it("TANPA nomor → wa.me/?text= (pemilih kontak WhatsApp), bukan null", () => {
    // DECISIONS #120: 222/222 tamu klien nyata tanpa nomor → dulu tak ada tombol kirim.
    expect(waShareUrl(null, "Halo")).toBe("https://wa.me/?text=Halo");
    expect(waShareUrl("12", "Halo")).toBe("https://wa.me/?text=Halo");
  });

  it("baris baru & emoji ter-encode utuh", () => {
    const url = waShareUrl(null, "A\n\nB 🙏");
    expect(decodeURIComponent(url.split("text=")[1])).toBe("A\n\nB 🙏");
  });
});
