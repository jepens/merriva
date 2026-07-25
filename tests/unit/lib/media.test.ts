import { describe, expect, it } from "vitest";

import {
  BASIC_MAX_PHOTOS,
  displayPath,
  mediaObjectPaths,
  mediaPrefix,
  photoLimitFromPackage,
  thumbPath,
  toMediaView,
} from "@/lib/media";

const INV = "11111111-1111-1111-1111-111111111111";
const MID = "22222222-2222-2222-2222-222222222222";

describe("path helpers", () => {
  it("prefix & varian path konsisten", () => {
    const prefix = mediaPrefix(INV, MID);
    expect(prefix).toBe(`inv/${INV}/${MID}`);
    expect(displayPath(prefix)).toBe(`inv/${INV}/${MID}/1600.webp`);
    expect(thumbPath(prefix)).toBe(`inv/${INV}/${MID}/400.webp`);
  });

  it("mediaObjectPaths mengembalikan kedua varian", () => {
    const prefix = mediaPrefix(INV, MID);
    expect(mediaObjectPaths(prefix)).toEqual([
      `inv/${INV}/${MID}/1600.webp`,
      `inv/${INV}/${MID}/400.webp`,
    ]);
  });
});

describe("toMediaView", () => {
  it("membangun URL via getUrl (domain sendiri), bukan URL vendor", () => {
    const prefix = mediaPrefix(INV, MID);
    const getUrl = (p: string) => `https://cdn.merriva.id/${p}`;
    const view = toMediaView(
      { id: MID, storage_path: prefix, width: 1600, height: 1067 },
      getUrl,
    );
    expect(view).toEqual({
      id: MID,
      url: `https://cdn.merriva.id/inv/${INV}/${MID}/1600.webp`,
      thumbUrl: `https://cdn.merriva.id/inv/${INV}/${MID}/400.webp`,
      width: 1600,
      height: 1067,
    });
  });
});

describe("photoLimitFromPackage", () => {
  it("Basic saat tanpa paket / limit tak valid", () => {
    expect(photoLimitFromPackage(null)).toBe(BASIC_MAX_PHOTOS);
    expect(photoLimitFromPackage(undefined)).toBe(BASIC_MAX_PHOTOS);
    expect(photoLimitFromPackage({})).toBe(BASIC_MAX_PHOTOS);
    expect(photoLimitFromPackage({ max_photos: null })).toBe(BASIC_MAX_PHOTOS);
    expect(photoLimitFromPackage({ max_photos: 0 })).toBe(BASIC_MAX_PHOTOS);
  });

  it("memakai limit paket bila valid", () => {
    expect(photoLimitFromPackage({ max_photos: 20 })).toBe(20);
    expect(photoLimitFromPackage({ max_photos: 8 })).toBe(8);
  });
});
