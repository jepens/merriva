import { describe, expect, it } from "vitest";

import { PHOTO_MAX_ZOOM, photoSchema } from "@/lib/validation/content";

/**
 * Skema foto bernama (THEME-CONTRACT §3).
 *
 * Janji terpentingnya adalah KOMPATIBILITAS: sebelum model non-destruktif,
 * `content` menyimpan path sebagai string telanjang. Dua foto sudah terlanjur
 * tersimpan begitu di produksi. Bila skema ini berhenti menerimanya, parse
 * `content` gagal → `editableContent` jatuh ke kerangka kosong → seluruh isi
 * undangan tampak hilang dari editor, bukan hanya fotonya.
 */

const PATH = "inv/44444444-4444-4444-8444-444444444444/foto/abc";

describe("menerima bentuk lama", () => {
  it("string telanjang dinormalkan ke titik tengah tanpa perbesaran", () => {
    expect(photoSchema.parse(PATH)).toEqual({
      path: PATH,
      x: 0.5,
      y: 0.5,
      zoom: 1,
    });
  });

  it("objek tanpa penyesuaian memakai nilai bawaan yang sama", () => {
    expect(photoSchema.parse({ path: PATH })).toEqual({
      path: PATH,
      x: 0.5,
      y: 0.5,
      zoom: 1,
    });
  });
});

describe("menyimpan penyesuaian", () => {
  it("meneruskan titik fokus & perbesaran apa adanya", () => {
    expect(photoSchema.parse({ path: PATH, x: 0.2, y: 0.9, zoom: 2.5 })).toEqual(
      { path: PATH, x: 0.2, y: 0.9, zoom: 2.5 },
    );
  });
});

describe("angka rusak tak menjatuhkan seluruh draft", () => {
  it.each([
    ["di luar rentang", { x: 9, y: -3, zoom: 99 }],
    ["bukan angka", { x: "kiri", y: null, zoom: "besar" }],
    ["NaN", { x: Number.NaN, y: Number.NaN, zoom: Number.NaN }],
  ])("%s jatuh ke nilai bawaan, bukan melempar", (_n, over) => {
    // `content` adalah satu kolom JSONB: satu angka rusak tak boleh membuat
    // nama mempelai dan jadwal ikut hilang dari editor.
    const hasil = photoSchema.parse({ path: PATH, ...over });
    expect(hasil).toEqual({ path: PATH, x: 0.5, y: 0.5, zoom: 1 });
  });

  it("batas zoom dipatuhi", () => {
    expect(photoSchema.parse({ path: PATH, zoom: PHOTO_MAX_ZOOM })).toMatchObject(
      { zoom: PHOTO_MAX_ZOOM },
    );
    // Di atas batas = data karangan; dikembalikan ke 1 daripada merender foto
    // yang pecah di depan tamu.
    expect(
      photoSchema.parse({ path: PATH, zoom: PHOTO_MAX_ZOOM + 1 }),
    ).toMatchObject({ zoom: 1 });
  });
});

describe("path tetap dijaga", () => {
  it.each([
    ["kosong", ""],
    ["traversal", "inv/../../.env"],
    ["URL vendor", "https://xyz.supabase.co/object/foto.webp"],
  ])("menolak path %s", (_n, path) => {
    expect(() => photoSchema.parse({ path })).toThrow();
  });

  it("menolak objek tanpa path", () => {
    expect(() => photoSchema.parse({ x: 0.5 })).toThrow();
  });
});
