import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { runBakeRequest } from "./film-bake-protocol";
import { FILM_PRESETS } from "./film-presets";
import { applyFilmToPixels } from "./film-render";

/**
 * GOLDEN HASH output bake filter (AUDIT-2026-09-04 PER-6).
 *
 * Direkam dari implementasi SEBELUM optimasi memori halation (lima buffer →
 * tiga) dan sebelum bake dipindah ke Web Worker. Test ini menjamin keduanya
 * TIDAK mengubah satu byte pun foto tamu — baik di jalur main thread maupun
 * jalur worker (`runBakeRequest`).
 *
 * Bila sebuah preset SENGAJA diubah tampilannya, hash-nya wajib direkam ulang
 * dan perubahannya disebut eksplisit di commit. Preset BARU akan menggagalkan
 * test cakupan di bawah sampai golden-nya ditambahkan.
 */
const GOLDEN: Record<string, string> = {
  "polos@301x199":
    "f040ab6eebbb5c8996abb7ce94c4793a67f1ce4e28ca446973c4700b5227f248",
  "hangat@301x199":
    "d9b03ef2a05cec3448f37e678e3cba241921d4720a50d92355e5c72a01f9e98f",
  "vivid@301x199":
    "c041e9c0f0c45988f5683416417ccf9519db4d27937f9019d24e1876ac16e893",
  "pesta@301x199":
    "bacefbf04812045cd1630ab452f9f0e72872d894c3cb68c4a5bfeb5d02ac66cd",
  "mono@301x199":
    "e6262a35554eafa2ffe3dfd1c1025942641664d69836e572aaa6785365dd24e7",
  "senja@301x199":
    "e4713da153441fadd513cd506dc1661a366e56c8e8aa22ee58c6c6f3999de5a3",
  "polos@64x64":
    "dacf944a65175c87ca183c05ef24ab910935a35cf1fcffe0fd237ffe6b962585",
  "hangat@64x64":
    "650266a605af28007a3eba3ccac4b1c82ba204eaaa723ccf9a500af5967a8ec9",
  "vivid@64x64":
    "033a7536ca1a5258b4bd21cffaca2f652c1fcdca6f6c6ad7f6b48a743ea94b91",
  "pesta@64x64":
    "79a7c73e65417dac56e01adc3ab3d7d3031f76e194ac23714ca60662fa5fe331",
  "mono@64x64":
    "26074e668062e0a0d885532a12b6b7b6c7269c971d8084903c446b4ca79915a7",
  "senja@64x64":
    "d8599f28606905864f820e356690e55f44fc81ed0dcb48662002aa87696ad0d6",
};

const SEED = 12345;
const SIZES = [
  [301, 199],
  [64, 64],
] as const;

/** Pola deterministik + titik sangat terang agar halation benar-benar aktif. */
function pattern(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 4;
      d[j] = (x * 7 + y * 3) % 256;
      d[j + 1] = (x * 2 + y * 11) % 256;
      d[j + 2] = (x * 13 + y * 5) % 256;
      d[j + 3] = 255;
      const spot = x % 37 < 4 && y % 23 < 4;
      const center =
        x > w / 2 - 6 && x < w / 2 + 6 && y > h / 2 - 6 && y < h / 2 + 6;
      if (spot || center) {
        d[j] = 255;
        d[j + 1] = 252;
        d[j + 2] = 248;
      }
    }
  }
  return d;
}

const sha = (d: Uint8ClampedArray) =>
  createHash("sha256").update(d).digest("hex");

describe("film-render — golden byte-identik (PER-6)", () => {
  it("golden mencakup SETIAP preset × setiap ukuran, dan semuanya berbeda", () => {
    expect(Object.keys(GOLDEN)).toHaveLength(
      FILM_PRESETS.length * SIZES.length,
    );
    expect(new Set(Object.values(GOLDEN)).size).toBe(
      FILM_PRESETS.length * SIZES.length,
    );
  });

  for (const [w, h] of SIZES) {
    for (const preset of FILM_PRESETS) {
      const key = `${preset.id}@${w}x${h}`;

      it(`main thread: ${key}`, () => {
        const d = pattern(w, h);
        applyFilmToPixels(d, w, h, preset.params, { seed: SEED });
        expect(sha(d)).toBe(GOLDEN[key]);
      });

      it(`jalur worker (runBakeRequest): ${key}`, () => {
        const px = pattern(w, h);
        const res = runBakeRequest({
          id: 1,
          buffer: px.buffer as ArrayBuffer,
          width: w,
          height: h,
          filterId: preset.id,
          seed: SEED,
        });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(sha(new Uint8ClampedArray(res.buffer))).toBe(GOLDEN[key]);
      });
    }
  }
});
