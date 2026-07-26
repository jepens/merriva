import { describe, expect, it } from "vitest";

import { parseCsv, parseSheetRows } from "@/lib/guest-import";

describe("parseCsv", () => {
  it("mem-parse baris & kolom dasar (koma)", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("menghormati field berkutip dengan koma di dalamnya", () => {
    expect(parseCsv('name,note\nBudi,"halo, dunia"')).toEqual([
      ["name", "note"],
      ["Budi", "halo, dunia"],
    ]);
  });

  it("menangani kutip ganda ter-escape", () => {
    expect(parseCsv('a\n"dia ""bilang"" begitu"')).toEqual([
      ["a"],
      ['dia "bilang" begitu'],
    ]);
  });

  it("menangani CRLF & membuang BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("mendeteksi pemisah titik-koma (ekspor Excel lokal)", () => {
    expect(parseCsv("a;b;c\n1;2;3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseSheetRows", () => {
  it("memetakan header alias & memvalidasi baris", () => {
    const rows = [
      ["Nama", "WA", "Grup", "Pax", "Catatan"],
      ["Budi", "08123456789", "Keluarga", "2", "VIP"],
      ["Rina", "", "", "", ""], // hanya nama → valid (pax default)
      ["", "", "", "", ""], // baris kosong → dilewati
      ["Sinta", "bukan-nomor", "", "", ""], // telepon invalid
      ["Andi", "", "", "99", ""], // pax di luar batas
    ];
    const p = parseSheetRows(rows);
    expect(p.headerError).toBeNull();
    expect(p.valid.map((v) => v.input.name)).toEqual(["Budi", "Rina"]);
    expect(p.invalid.map((iv) => iv.rowNumber)).toEqual([5, 6]);
    expect(p.invalid[0].name).toBe("Sinta");
  });

  it("mengenali header 'Name' / 'No HP' (alias Inggris & umum)", () => {
    const p = parseSheetRows([
      ["Name", "No HP"],
      ["Budi", "081234567890"],
    ]);
    expect(p.headerError).toBeNull();
    expect(p.valid).toHaveLength(1);
  });

  it("menolak berkas tanpa kolom Nama (headerError)", () => {
    const p = parseSheetRows([
      ["Telepon", "Grup"],
      ["08123456789", "Keluarga"],
    ]);
    expect(p.headerError).not.toBeNull();
    expect(p.valid).toHaveLength(0);
  });

  it("berkas kosong → headerError", () => {
    expect(parseSheetRows([]).headerError).not.toBeNull();
  });
});
