import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  validateVideoFile,
  validateVideoMeta,
  VIDEO_MAX_BYTES,
} from "@/lib/video";
import { hasThemeVideo, ThemeVideo } from "@/themes/_shared/video";
import {
  youtubeEmbedUrl,
  youtubePosterUrl,
  youtubeVideoId,
} from "@/themes/_shared/youtube";

const LABELS = {
  play: "Putar video",
  unmute: "Nyalakan suara",
  mute: "Senyapkan",
};
const VID = "dQw4w9WgXcQ";

describe("youtubeVideoId", () => {
  it("menerima bentuk tautan yang lazim", () => {
    for (const u of [
      `https://www.youtube.com/watch?v=${VID}`,
      `https://youtube.com/watch?v=${VID}&t=10s`,
      `https://m.youtube.com/watch?v=${VID}`,
      `https://youtu.be/${VID}`,
      `https://youtu.be/${VID}?si=abc`,
      `https://www.youtube.com/shorts/${VID}`,
      `https://www.youtube.com/embed/${VID}`,
      `https://www.youtube.com/live/${VID}`,
    ])
      expect(youtubeVideoId(u), u).toBe(VID);
  });

  it("menolak host palsu, protokol non-https, dan id cacat", () => {
    for (const u of [
      `http://www.youtube.com/watch?v=${VID}`, // bukan https
      `https://evil.com/watch?v=${VID}`,
      `https://evil.com/?x=youtube.com&v=${VID}`,
      `https://notyoutu.be/${VID}`,
      "https://www.youtube.com/watch?v=pendek",
      "https://www.youtube.com/watch",
      "bukan url",
      "",
    ])
      expect(youtubeVideoId(u), u).toBeNull();
    expect(youtubeVideoId(null)).toBeNull();
    expect(youtubeVideoId(undefined)).toBeNull();
  });

  it("embed memakai youtube-nocookie dan poster memakai i.ytimg.com", () => {
    expect(youtubeEmbedUrl(VID)).toContain(
      `https://www.youtube-nocookie.com/embed/${VID}`,
    );
    expect(youtubePosterUrl(VID)).toBe(
      `https://i.ytimg.com/vi/${VID}/hqdefault.jpg`,
    );
  });
});

describe("hasThemeVideo", () => {
  const view = {
    url: "https://cdn.example/v.mp4",
    posterUrl: null,
    width: 1920,
    height: 1080,
  };
  it("benar bila ada video unggahan ATAU tautan YouTube valid", () => {
    expect(hasThemeVideo(view, null)).toBe(true);
    expect(hasThemeVideo(null, `https://youtu.be/${VID}`)).toBe(true);
    expect(hasThemeVideo(null, "https://evil.com/v")).toBe(false);
    expect(hasThemeVideo(null, null)).toBe(false);
  });
});

describe("ThemeVideo — YouTube (facade ringan)", () => {
  it("TIDAK membuat iframe sebelum diklik; klik menggantinya dengan embed nocookie", () => {
    const { container } = render(
      <ThemeVideo youtubeUrl={`https://youtu.be/${VID}`} labels={LABELS} />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    const btn = screen.getByRole("button", { name: LABELS.play });
    expect(btn.style.backgroundImage).toContain(`i.ytimg.com/vi/${VID}`);
    fireEvent.click(btn);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toContain(
      `youtube-nocookie.com/embed/${VID}`,
    );
    expect(iframe!.getAttribute("allowfullscreen")).not.toBeNull();
  });

  it("render null bila tak ada sumber valid", () => {
    const { container } = render(
      <ThemeVideo youtubeUrl="https://evil.com/watch?v=x" labels={LABELS} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("ThemeVideo — file unggahan", () => {
  const view = {
    url: "https://cdn.example/v.mp4",
    posterUrl: "https://cdn.example/p.webp",
    width: 1920,
    height: 1080,
  };

  it("file unggahan menang atas tautan YouTube (prioritas terdokumentasi)", () => {
    const { container } = render(
      <ThemeVideo
        video={view}
        youtubeUrl={`https://youtu.be/${VID}`}
        labels={LABELS}
      />,
    );
    const el = container.querySelector("video");
    expect(el).not.toBeNull();
    expect(container.querySelector(".video-lite")).toBeNull();
  });

  it("video senyap + loop + playsinline + poster; tombol suara toggle aria", () => {
    const { container } = render(<ThemeVideo video={view} labels={LABELS} />);
    const el = container.querySelector("video")!;
    expect(el.muted).toBe(true);
    expect(el.loop).toBe(true);
    expect(el.playsInline).toBe(true);
    expect(el.getAttribute("poster")).toBe(view.posterUrl);
    expect(el.getAttribute("preload")).toBe("metadata");

    const btn = screen.getByRole("button", { name: LABELS.unmute });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(el.muted).toBe(false);
    expect(
      screen
        .getByRole("button", { name: LABELS.mute })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("rasio dari metadata, fallback 16/9", () => {
    const { container } = render(<ThemeVideo video={view} labels={LABELS} />);
    expect(
      (container.querySelector(".video-frame") as HTMLElement).style
        .aspectRatio,
    ).toBe("1920 / 1080");
    const { container: c2 } = render(
      <ThemeVideo
        video={{ ...view, width: null, height: null }}
        labels={LABELS}
      />,
    );
    expect(
      (c2.querySelector(".video-frame") as HTMLElement).style.aspectRatio,
    ).toBe("16 / 9");
  });
});

describe("validasi berkas video (editor & aksi server)", () => {
  it("tipe & ukuran", () => {
    expect(validateVideoFile({ type: "video/mp4", size: 1000 })).toBeNull();
    expect(validateVideoFile({ type: "video/webm", size: 1000 })).toBeNull();
    expect(
      validateVideoFile({ type: "video/quicktime", size: 1000 }),
    ).toBeNull();
    expect(validateVideoFile({ type: "video/x-msvideo", size: 1 })).toBe(
      "type",
    );
    expect(validateVideoFile({ type: "image/png", size: 1 })).toBe("type");
    expect(
      validateVideoFile({ type: "video/mp4", size: VIDEO_MAX_BYTES + 1 }),
    ).toBe("size");
    expect(
      validateVideoFile({ type: "video/mp4", size: VIDEO_MAX_BYTES }),
    ).toBeNull();
  });

  it("durasi ≤60 dtk (toleransi metadata +1) dan wajib landscape", () => {
    const ok = { durationSec: 59.8, width: 1920, height: 1080 };
    expect(validateVideoMeta(ok)).toBeNull();
    expect(validateVideoMeta({ ...ok, durationSec: 61 })).toBeNull();
    expect(validateVideoMeta({ ...ok, durationSec: 61.4 })).toBe("duration");
    expect(validateVideoMeta({ ...ok, width: 1080, height: 1920 })).toBe(
      "orientation",
    );
    expect(validateVideoMeta({ ...ok, width: 1080, height: 1080 })).toBe(
      "orientation",
    );
    expect(validateVideoMeta({ ...ok, durationSec: NaN })).toBe("unreadable");
    expect(validateVideoMeta({ ...ok, width: 0 })).toBe("unreadable");
  });
});
