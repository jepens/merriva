import { describe, expect, it } from "vitest";

import { getFilmPreset } from "./film-presets";
import { applyFilmToPixels, boxBlur1, luma, mulberry32 } from "./film-render";

/** Buffer uniform RGBA. */
function uniform(w: number, h: number, r: number, g: number, b: number) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  return d;
}

const avgChannel = (d: Uint8ClampedArray, c: 0 | 1 | 2) => {
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += d[i + c]!;
  return s / (d.length / 4);
};

describe("luma & mulberry32", () => {
  it("luma memenuhi bobot Rec.601", () => {
    expect(luma(255, 255, 255)).toBeCloseTo(255, 5);
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 0, 0)).toBeCloseTo(76.245, 2);
  });

  it("mulberry32 deterministik per seed dan berada di [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(7);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    const seqC = [c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("boxBlur1", () => {
  it("field konstan tidak berubah", () => {
    const src = new Float32Array(16 * 16).fill(0.5);
    const out = boxBlur1(src, 16, 16, 2);
    for (const v of out) expect(v).toBeCloseTo(0.5, 6);
  });

  it("impuls menyebar dengan jumlah ~terjaga (jauh dari tepi)", () => {
    const w = 21;
    const src = new Float32Array(w * w);
    src[10 * w + 10] = 1;
    const out = boxBlur1(src, w, w, 2);
    const sum = out.reduce((a, v) => a + v, 0);
    expect(sum).toBeCloseTo(1, 3);
    expect(out[10 * w + 10]!).toBeLessThan(1);
    expect(out[10 * w + 8]!).toBeGreaterThan(0);
  });

  it("radius 0 mengembalikan salinan identik", () => {
    const src = Float32Array.from([0.1, 0.9, 0.4, 0.2]);
    const out = boxBlur1(src, 2, 2, 0);
    expect(Array.from(out)).toEqual(Array.from(src));
    expect(out).not.toBe(src);
  });
});

describe("applyFilmToPixels", () => {
  it("menolak buffer dengan ukuran salah", () => {
    expect(() =>
      applyFilmToPixels(
        new Uint8ClampedArray(12),
        2,
        2,
        getFilmPreset("polos").params,
      ),
    ).toThrow();
  });

  it("preset polos = identitas byte-per-byte", () => {
    const d = uniform(8, 8, 13, 200, 77);
    d[5] = 111; // variasi
    const before = Uint8ClampedArray.from(d);
    applyFilmToPixels(d, 8, 8, getFilmPreset("polos").params);
    expect(Array.from(d)).toEqual(Array.from(before));
  });

  it("mono menghasilkan R=G=B di semua piksel", () => {
    const d = uniform(6, 6, 210, 40, 90);
    applyFilmToPixels(d, 6, 6, getFilmPreset("mono").params, { seed: 3 });
    for (let i = 0; i < d.length; i += 4) {
      expect(d[i]).toBe(d[i + 1]);
      expect(d[i + 1]).toBe(d[i + 2]);
    }
  });

  it("temp hangat menaikkan merah & menurunkan biru (abu-abu uniform)", () => {
    const base = getFilmPreset("polos").params;
    const d = uniform(10, 10, 128, 128, 128);
    applyFilmToPixels(d, 10, 10, { ...base, temp: 0.5 });
    expect(avgChannel(d, 0)).toBeGreaterThan(128);
    expect(avgChannel(d, 2)).toBeLessThan(128);
  });

  it("fade mengangkat hitam pekat", () => {
    const base = getFilmPreset("polos").params;
    const d = uniform(4, 4, 0, 0, 0);
    applyFilmToPixels(d, 4, 4, { ...base, fade: 0.5 });
    expect(d[0]!).toBeGreaterThan(0);
  });

  it("vignette: sudut lebih gelap daripada pusat", () => {
    const base = getFilmPreset("polos").params;
    const w = 31;
    const d = uniform(w, w, 180, 180, 180);
    applyFilmToPixels(d, w, w, { ...base, vignette: 0.6 });
    const center = d[(15 * w + 15) * 4]!;
    const corner = d[0]!;
    expect(corner).toBeLessThan(center);
  });

  it("grain deterministik: seed sama ⇒ hasil identik, seed beda ⇒ beda", () => {
    const p = getFilmPreset("pesta").params;
    const mk = () => uniform(12, 12, 120, 120, 120);
    const a = applyFilmToPixels(mk(), 12, 12, p, { seed: 9 });
    const b = applyFilmToPixels(mk(), 12, 12, p, { seed: 9 });
    const c = applyFilmToPixels(mk(), 12, 12, p, { seed: 10 });
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  it("halation memendarkan warna hangat ke piksel gelap di sekitar titik terang", () => {
    const base = getFilmPreset("polos").params;
    const w = 41;
    const d = uniform(w, w, 10, 10, 10);
    // titik lampu 3×3 di tengah
    for (let y = 19; y <= 21; y++) {
      for (let x = 19; x <= 21; x++) {
        const j = (y * w + x) * 4;
        d[j] = 255;
        d[j + 1] = 250;
        d[j + 2] = 245;
      }
    }
    applyFilmToPixels(d, w, w, { ...base, halation: 1 });
    const j = (20 * w + 24) * 4; // 4px di kanan lampu (aslinya gelap)
    expect(d[j]!).toBeGreaterThan(10); // ikut memendar
    expect(d[j]!).toBeGreaterThan(d[j + 2]!); // pendar dominan merah
  });

  it("nilai selalu ter-clamp 0..255 pada parameter ekstrem", () => {
    const base = getFilmPreset("polos").params;
    const d = uniform(8, 8, 250, 5, 250);
    applyFilmToPixels(d, 8, 8, {
      ...base,
      bright: 1.5,
      contrast: 1.6,
      temp: 1,
      fade: 1,
      grain: 1,
      vignette: 1,
    });
    for (let i = 0; i < d.length; i++) {
      expect(d[i]!).toBeGreaterThanOrEqual(0);
      expect(d[i]!).toBeLessThanOrEqual(255);
    }
  });

  it("alpha tidak pernah disentuh", () => {
    const d = uniform(5, 5, 100, 100, 100);
    d[3] = 42;
    applyFilmToPixels(d, 5, 5, getFilmPreset("senja").params, { seed: 2 });
    expect(d[3]).toBe(42);
  });
});
