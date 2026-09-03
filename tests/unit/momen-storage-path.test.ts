import { describe, expect, it } from "vitest";

import {
  momenDisplayPath,
  momenObjectPaths,
  momenPrefix,
  momenThumbPath,
} from "@/lib/momen/storage-path";

// Regex yang IDENTIK dengan constraint kolom di migrasi 20260826120000.
const DISPLAY_RE =
  /^momen\/[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\/display\.(webp|jpg)$/;
const THUMB_RE =
  /^momen\/[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\/thumb\.(webp|jpg)$/;

const ALBUM = "11111111-1111-4111-8111-111111111111";
const PHOTO = "22222222-2222-4222-8222-222222222222";

describe("momen storage paths", () => {
  it("prefix menggabungkan album + foto di bawah momen/", () => {
    expect(momenPrefix(ALBUM, PHOTO)).toBe(`momen/${ALBUM}/${PHOTO}`);
  });

  it("path webp cocok dengan constraint DB", () => {
    expect(momenDisplayPath(ALBUM, PHOTO, "webp")).toMatch(DISPLAY_RE);
    expect(momenThumbPath(ALBUM, PHOTO, "webp")).toMatch(THUMB_RE);
  });

  it("format jpeg → ekstensi jpg (fallback iOS), tetap cocok constraint", () => {
    const display = momenDisplayPath(ALBUM, PHOTO, "jpeg");
    const thumb = momenThumbPath(ALBUM, PHOTO, "jpeg");
    expect(display).toBe(`momen/${ALBUM}/${PHOTO}/display.jpg`);
    expect(display).toMatch(DISPLAY_RE);
    expect(thumb).toMatch(THUMB_RE);
  });

  it("momenObjectPaths mengembalikan display lalu thumb", () => {
    const [display, thumb] = momenObjectPaths(ALBUM, PHOTO, "webp");
    expect(display).toBe(momenDisplayPath(ALBUM, PHOTO, "webp"));
    expect(thumb).toBe(momenThumbPath(ALBUM, PHOTO, "webp"));
  });
});
