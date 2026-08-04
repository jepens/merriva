import { describe, expect, it } from "vitest";

import { AUDIO_MAX_BYTES, AUDIO_MIME_EXT, songObjectPath } from "@/lib/audio";

describe("songObjectPath", () => {
  it("content-addressed: isi identik → path identik (unggah idempoten)", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(songObjectPath(a, "mp3")).toBe(songObjectPath(b, "mp3"));
  });

  it("isi berbeda → path berbeda; format path songs/<hash>.<ext>", () => {
    const p1 = songObjectPath(new Uint8Array([1]), "mp3");
    const p2 = songObjectPath(new Uint8Array([2]), "mp3");
    expect(p1).not.toBe(p2);
    expect(p1).toMatch(/^songs\/[0-9a-f]{32}\.mp3$/);
  });
});

describe("AUDIO_MIME_EXT / AUDIO_MAX_BYTES", () => {
  it("memetakan MIME audio umum & menolak non-audio", () => {
    expect(AUDIO_MIME_EXT["audio/mpeg"]).toBe("mp3");
    expect(AUDIO_MIME_EXT["audio/ogg"]).toBe("ogg");
    expect(AUDIO_MIME_EXT["image/png"]).toBeUndefined();
  });

  it("batas ukuran = 8 MB", () => {
    expect(AUDIO_MAX_BYTES).toBe(8 * 1024 * 1024);
  });
});
