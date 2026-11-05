import { describe, expect, it } from "vitest";

import { hasThemeVideo } from "@/themes/_shared/video";
import { hasVideoSection } from "@/themes/_shared/video-gate";

/**
 * `hasVideoSection` ada karena `hasThemeVideo` tinggal di modul `"use client"`
 * dan tak bisa dipanggil dari `index.tsx` tema (Server Component). Keduanya
 * harus selalu sepakat — tema yang memakai satu dan komponen yang memakai yang
 * lain tak boleh berbeda pendapat tentang ada-tidaknya video.
 */
describe("hasVideoSection ≡ hasThemeVideo", () => {
  const view = { url: "u", posterUrl: null, width: 1920, height: 1080 };
  it.each([
    [view, null],
    [view, "https://evil.test/x"],
    [null, "https://youtu.be/dQw4w9WgXcQ"],
    [null, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    [null, "https://evil.test/?v=dQw4w9WgXcQ"],
    [null, "http://youtu.be/dQw4w9WgXcQ"],
    [undefined, undefined],
    [null, ""],
  ])("video=%o, youtubeUrl=%s", (video, url) => {
    expect(hasVideoSection(video, url)).toBe(hasThemeVideo(video, url));
  });
});
