import { describe, expect, it } from "vitest";

import { isKnownSection } from "@/lib/customizer/section-vocab";
import { MEDIA_SLOT_IDS } from "@/lib/customizer/theme-options";
// Modul `.mjs` polos — sengaja JS supaya `node scripts/new-theme.mjs` bisa
// dijalankan langsung tanpa build step.
import {
  KATEGORI,
  TIER,
  camel,
  namaTampil,
  pascal,
  prefixBawaan,
  prefixSah,
  sisipkanBaris,
  sisipkanImpor,
  slugSah,
  tOptions,
} from "@/../scripts/theme-scaffold.mjs";

/**
 * Scaffold tema (`pnpm theme:new`, THEME-CONTRACT §4).
 *
 * KENAPA TEST INI ADA: scaffold hanya berguna selama keluarannya MASIH
 * memenuhi kontrak. Begitu kosakata section bertambah atau slot media berubah
 * dan templatenya tertinggal, setiap tema baru lahir dalam keadaan melanggar —
 * dan yang menemukannya adalah orang yang sedang mengerjakan art direction,
 * jauh dari penyebabnya.
 *
 * Test konformansi menjaga tema yang SUDAH ada; ini menjaga tema yang BELUM
 * ada.
 */

const OPSI = tOptions({ slug: "contoh-tema", prefix: "ct" }) as string;

function idSection(src: string): string[] {
  const blok = src.slice(src.indexOf("sections: ["), src.indexOf("styles:"));
  return [...blok.matchAll(/id: "([^"]+)"/g)].map((m) => m[1] as string);
}

describe("template options memenuhi kontrak sejak lahir", () => {
  it("hero wajib tampil & tak bisa diurut ulang", () => {
    expect(OPSI).toContain('{ id: "hero", reorder: false, toggle: false }');
  });

  it("rsvp tak bisa disembunyikan", () => {
    expect(OPSI).toContain('{ id: "rsvp", reorder: true, toggle: false }');
  });

  it("semua id section ada di kosakata kanonik", () => {
    const ids = idSection(OPSI);
    expect(ids.length).toBeGreaterThan(2);
    for (const id of ids) {
      expect(isKnownSection(id), `id '${id}' di luar kosakata`).toBe(true);
    }
  });

  it("tak memakai sinonim yang sudah dibuang", () => {
    for (const lama of ["intro", "opening", "principals", "rundown", "event"]) {
      expect(OPSI).not.toContain(`id: "${lama}"`);
    }
  });

  it("mendeklarasikan slot media dengan id yang dikenal", () => {
    const blok = OPSI.slice(OPSI.indexOf("media: {"), OPSI.indexOf("preview:"));
    const ids = [...blok.matchAll(/id: "([^"]+)"/g)].map((m) => m[1] as string);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect((MEDIA_SLOT_IDS as readonly string[]).includes(id)).toBe(true);
    }
  });

  it("prefix dipakai konsisten di var pratinjau", () => {
    expect(OPSI).toContain('root: "ct"');
    expect(OPSI).toContain('{ name: "--ct-acc", token: "accent" }');
  });
});

describe("slug & prefix", () => {
  it.each(["senja", "eternal-rose", "kembang-api", "tema2"])(
    "menerima %j",
    (s) => expect(slugSah(s)).toBe(true),
  );

  it.each([
    ["kosong", ""],
    ["huruf besar", "Senja"],
    ["spasi", "kembang api"],
    ["garis bawah", "kembang_api"],
    ["mulai angka", "2senja"],
    ["hubung ganda", "a--b"],
    ["hubung di ujung", "senja-"],
    ["traversal", "../rahasia"],
  ])("menolak %s", (_n, s) => expect(slugSah(s)).toBe(false));

  it("menolak slug yang terlalu panjang", () => {
    expect(slugSah("a".repeat(33))).toBe(false);
  });

  it.each([
    ["ct", true],
    ["mrd", true],
    ["c", false],
    ["terlalupanjang", false],
    ["CT", false],
    ["", false],
  ])("prefix %j → %s", (p, sah) => expect(prefixSah(p as string)).toBe(sah));
});

describe("penamaan diturunkan dari slug", () => {
  it("camel & pascal", () => {
    expect(camel("eternal-rose")).toBe("eternalRose");
    expect(pascal("eternal-rose")).toBe("EternalRose");
    expect(camel("senja")).toBe("senja");
    expect(pascal("senja")).toBe("Senja");
  });

  it("nama tampil untuk katalog", () => {
    expect(namaTampil("kembang-api")).toBe("Kembang Api");
  });

  it("prefix bawaan: inisial tiap kata, atau 3 huruf bila satu kata", () => {
    expect(prefixBawaan("eternal-rose")).toBe("er");
    expect(prefixBawaan("senja")).toBe("sen");
  });
});

describe("penyisipan registry", () => {
  const sumber = "const r = {\n  a: 1,\n};\n";

  it("menyisipkan tepat sebelum penutup", () => {
    const hasil = sisipkanBaris(sumber, {
      penanda: '"baru":',
      baris: '  "baru": 2,\n',
      penutup: "};",
    });
    expect(hasil).toBe('const r = {\n  a: 1,\n  "baru": 2,\n};\n');
  });

  it("IDEMPOTEN — menjalankan ulang tak menggandakan baris", () => {
    // Scaffold boleh dijalankan ulang setelah gagal di tengah jalan; registry
    // yang punya dua baris untuk satu tema gagal build dengan pesan yang tak
    // menunjuk penyebabnya.
    const sekali = sisipkanBaris(sumber, {
      penanda: '"baru":',
      baris: '  "baru": 2,\n',
      penutup: "};",
    });
    const dua = sisipkanBaris(sekali, {
      penanda: '"baru":',
      baris: '  "baru": 2,\n',
      penutup: "};",
    });
    expect(dua).toBe(sekali);
  });

  it("melempar bila jangkar tak ada — lebih baik berhenti daripada merusak", () => {
    expect(() =>
      sisipkanBaris("tanpa penutup", {
        penanda: "x",
        baris: "x\n",
        penutup: "};",
      }),
    ).toThrow();
  });

  it("menyisipkan impor setelah baris jangkar", () => {
    const hasil = sisipkanImpor('import { a } from "./a";\n\nconst x = 1;\n', {
      penanda: './b"',
      baris: 'import { b } from "./b";\n',
      setelah: 'from "./a";',
    });
    expect(hasil).toBe(
      'import { a } from "./a";\nimport { b } from "./b";\n\nconst x = 1;\n',
    );
  });
});

describe("pilihan yang sah", () => {
  it("kategori & tier sejalan dengan enum DB", () => {
    expect([...KATEGORI]).toEqual(["wedding", "corporate", "family"]);
    expect([...TIER]).toEqual(["standard", "premium", "signature"]);
  });
});
