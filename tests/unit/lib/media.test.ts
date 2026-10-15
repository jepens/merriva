import { describe, expect, it } from "vitest";

import {
  BASIC_MAX_PHOTOS,
  displayPath,
  isNamedPhotoPath,
  isVariantBlob,
  MEDIA_MAX_BYTES,
  mediaObjectPaths,
  mediaPrefix,
  namedPhotoPrefix,
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

  it("mediaObjectPaths menyebut SELURUH varian, termasuk `og.jpg`", () => {
    // Daftar ini dipakai purge retensi UU PDP. Varian yang tak disebut akan
    // TERTINGGAL di disk setelah seluruh data pribadi pemiliknya dihapus —
    // kegagalan yang tak menimbulkan galat apa pun dan hanya ketahuan dengan
    // menengok disk. Foto galeri tak punya `og.jpg`; menghapus objek yang tak
    // ada tak berbahaya (seluruh pemanggilnya best-effort), sedangkan objek
    // yatim yang tertinggal berbahaya.
    const prefix = mediaPrefix(INV, MID);
    expect(mediaObjectPaths(prefix)).toEqual([
      `inv/${INV}/${MID}/1600.webp`,
      `inv/${INV}/${MID}/400.webp`,
      `inv/${INV}/${MID}/og.jpg`,
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

describe("foto bernama", () => {
  const FID = "3bca4756-1bba-46c3-8208-84baa2b09b45";

  it("prefixnya berbentuk sama dengan galeri — varian di dalamnya", () => {
    // Bentuk inilah yang membuat purge retensi bisa memakai jalur `media_paths`
    // yang sudah ada (migrasi 20261014120000). Prefix berbeda bentuk akan
    // menghapus separuh objek saja.
    const prefix = namedPhotoPrefix(INV, FID);
    expect(prefix).toBe(`inv/${INV}/foto/${FID}`);
    expect(mediaObjectPaths(prefix)).toEqual([
      `${prefix}/1600.webp`,
      `${prefix}/400.webp`,
      `${prefix}/og.jpg`,
    ]);
  });

  it("segmen `foto` membedakannya dari prefix galeri", () => {
    expect(namedPhotoPrefix(INV, FID)).not.toBe(mediaPrefix(INV, FID));
  });

  describe("isNamedPhotoPath — gerbang penghapusan", () => {
    it("menerima prefix milik undangan itu sendiri", () => {
      expect(isNamedPhotoPath(INV, namedPhotoPrefix(INV, FID))).toBe(true);
    });

    it.each([
      ["undangan lain", `inv/33333333-3333-4333-8333-333333333333/foto/${FID}`],
      ["prefix galeri", `inv/${INV}/${FID}`],
      ["lagu", "songs/858954bda1e7a6730b511cab436b86ca"],
      ["ada varian di ujung", `inv/${INV}/foto/${FID}/1600.webp`],
      ["traversal", `inv/${INV}/foto/..`],
      ["awalan saja", `inv/${INV}/foto/`],
      ["id foto bukan UUID", `inv/${INV}/foto/abc`],
      ["kosong", ""],
    ])("menolak %s", (_n, path) => {
      // Path datang dari klien dan storage tak mengenal kepemilikan: tanpa
      // pencocokan bentuk PENUH, pemilik undangan sendiri bisa menghapus foto
      // undangan orang lain.
      expect(isNamedPhotoPath(INV, path)).toBe(false);
    });

    it("menolak bila invitationId sendiri bukan UUID", () => {
      expect(isNamedPhotoPath("..", `inv/../foto/${FID}`)).toBe(false);
    });
  });
});

describe("isVariantBlob", () => {
  const blob = (type: string, bytes: number) =>
    new File([new Uint8Array(bytes)], "v", { type });

  it("menerima WebP dan JPEG (fallback iOS)", () => {
    expect(isVariantBlob(blob("image/webp", 10), MEDIA_MAX_BYTES.display)).toBe(
      true,
    );
    expect(isVariantBlob(blob("image/jpeg", 10), MEDIA_MAX_BYTES.display)).toBe(
      true,
    );
  });

  it.each([
    ["PNG — berarti kompresi klien tak berjalan", blob("image/png", 10), 1000],
    ["kosong", blob("image/webp", 0), 1000],
    ["melebihi batas", blob("image/webp", 1001), 1000],
    ["bukan Blob", "bukan blob" as unknown, 1000],
    ["null", null as unknown, 1000],
  ])("menolak %s", (_n, value, max) => {
    expect(isVariantBlob(value, max as number)).toBe(false);
  });
});
