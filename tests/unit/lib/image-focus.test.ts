import { describe, expect, it } from "vitest";

import { geserFokus } from "@/lib/image/focus";

/**
 * Pergeseran titik fokus foto bernama (THEME-CONTRACT §3).
 *
 * Yang dijaga di sini adalah RASA-nya, bukan sekadar angkanya: seretan harus
 * terasa 1:1 dengan jari pada foto apa pun. Memakai lebar bingkai sebagai
 * pembagi membuat foto yang nyaris sebentuk bingkai melompat-lompat, dan foto
 * panorama terasa macet — keduanya terbaca sebagai "penyesuaiannya rusak",
 * bukan sebagai "faktornya kurang pas".
 */

const BINGKAI = { w: 160, h: 200 }; // 4:5, seperti bingkai di editor
const TENGAH = { x: 0.5, y: 0.5, zoom: 1 };

describe("arah", () => {
  it("menyeret ke kanan menggeser fokus ke KIRI", () => {
    const f = geserFokus(TENGAH, 20, 0, BINGKAI, { w: 1600, h: 1000 });
    expect(f.x).toBeLessThan(0.5);
  });

  it("menyeret ke bawah menggeser fokus ke ATAS", () => {
    const f = geserFokus(TENGAH, 0, 20, BINGKAI, { w: 1000, h: 1600 });
    expect(f.y).toBeLessThan(0.5);
  });
});

describe("pembagi mengikuti luapan nyata", () => {
  it("foto panorama bergerak lebih SEDIKIT per piksel seretan", () => {
    // Luapan mendatar panorama jauh lebih besar, jadi satu piksel seretan
    // mewakili pecahan fokus yang lebih kecil.
    const panorama = geserFokus(TENGAH, 20, 0, BINGKAI, { w: 4000, h: 1000 });
    const agakLebar = geserFokus(TENGAH, 20, 0, BINGKAI, { w: 1000, h: 1000 });
    expect(0.5 - panorama.x).toBeLessThan(0.5 - agakLebar.x);
  });

  it("sumbu tanpa luapan TIDAK bergerak di zoom 1", () => {
    // Foto persis sebentuk bingkai: tak ada yang terpotong mendatar, jadi tak
    // ada yang perlu digeser. Menggerakkannya akan memunculkan pita kosong.
    const f = geserFokus(TENGAH, 40, 0, BINGKAI, { w: 160, h: 200 });
    expect(f.x).toBe(0.5);
  });

  it("sumbu tanpa luapan TETAP bisa digeser saat diperbesar", () => {
    // Saat zoom > 1 isinya memang terpotong bingkai, jadi harus bisa digeser —
    // `transform-origin` yang menggerakkannya.
    const f = geserFokus({ x: 0.5, y: 0.5, zoom: 2 }, 40, 0, BINGKAI, {
      w: 160,
      h: 200,
    });
    expect(f.x).toBeLessThan(0.5);
  });

  it("makin diperbesar, seretan yang sama menggeser makin sedikit", () => {
    const alami = { w: 1600, h: 1000 };
    const d1 = 0.5 - geserFokus(TENGAH, 20, 0, BINGKAI, alami).x;
    const d3 =
      0.5 - geserFokus({ ...TENGAH, zoom: 3 }, 20, 0, BINGKAI, alami).x;
    expect(d3).toBeLessThan(d1);
  });
});

describe("batas", () => {
  it("fokus dijepit ke 0..1", () => {
    const alami = { w: 1600, h: 1000 };
    expect(geserFokus(TENGAH, -99999, 0, BINGKAI, alami).x).toBe(1);
    expect(geserFokus(TENGAH, 99999, 0, BINGKAI, alami).x).toBe(0);
  });

  it("bingkai belum terukur (0 px) tak mengubah apa pun", () => {
    // Terjadi pada render pertama sebelum tata letak selesai; menghitung di
    // situ akan membagi dengan nol dan menghasilkan NaN yang tersimpan ke
    // `content`.
    const f = geserFokus(TENGAH, 20, 20, { w: 0, h: 0 }, { w: 1600, h: 1000 });
    expect(f).toEqual({ x: 0.5, y: 0.5 });
  });

  it("gambar belum termuat (naturalWidth 0) memakai ukuran bingkai", () => {
    const f = geserFokus(TENGAH, 20, 0, BINGKAI, { w: 0, h: 0 });
    expect(Number.isFinite(f.x)).toBe(true);
    expect(f.x).toBe(0.5); // sebentuk bingkai -> tak ada luapan
  });

  it("tak pernah menghasilkan NaN", () => {
    for (const alami of [
      { w: 1, h: 1 },
      { w: 4000, h: 10 },
      { w: 10, h: 4000 },
    ]) {
      const f = geserFokus(TENGAH, 13, -7, BINGKAI, alami);
      expect(Number.isNaN(f.x)).toBe(false);
      expect(Number.isNaN(f.y)).toBe(false);
    }
  });
});
