import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { invitationContentSchema } from "@/lib/validation/content";
import { dwi } from "@/themes/warta/labels";
import { Schedule, VideoSection } from "@/themes/warta/sections";
import type { VideoView } from "@/themes/_shared/video";

/**
 * Info live streaming di bawah video "Di Layar" Warta (DECISIONS #135):
 * isiannya tautan https (→ tombol) ATAU tulisan biasa (→ teks), dengan lencana
 * LIVE berkedip; tak lagi di section acara. Pemilahan & gerbang Premium diuji
 * di invitation-data.test.ts; perakitan `index.tsx` di warta-edisi-akar.
 */

// `Reveal` memakai IntersectionObserver; jsdom tak punya.
beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const VIDEO: VideoView = {
  url: "https://merriva.test/media/video/a/video.mp4",
  posterUrl: null,
  width: 1920,
  height: 1080,
};
const RUBRIK = dwi((d) => d.folio.video);

describe("skema strict: livestreamUrl menerima tautan ATAU tulisan", () => {
  const korporat = (livestreamUrl: unknown) =>
    invitationContentSchema.safeParse({
      category: "corporate",
      eventName: "Annual Summit 2026",
      pic: { name: "Budi", phone: "", email: "" },
      agenda: [],
      livestreamUrl,
    });
  const nilai = (r: ReturnType<typeof korporat>) =>
    r.success ? r.data.livestreamUrl : "GAGAL";

  it("tulisan biasa & tautan https lolos apa adanya (dipangkas)", () => {
    expect(nilai(korporat("  @LADOMAX Mediapro "))).toBe("@LADOMAX Mediapro");
    expect(nilai(korporat("https://youtube.com/live/abc"))).toBe(
      "https://youtube.com/live/abc",
    );
  });

  it("kosong / spasi = tidak diisi", () => {
    expect(nilai(korporat(""))).toBeUndefined();
    expect(nilai(korporat("   "))).toBeUndefined();
    expect(nilai(korporat(undefined))).toBeUndefined();
  });

  it("skema berbahaya tetap ditolak; batas panjang tetap", () => {
    for (const jahat of [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "data:text/html,x",
    ]) {
      expect(korporat(jahat).success, jahat).toBe(false);
    }
    expect(korporat("a".repeat(501)).success).toBe(false);
  });
});

describe("VideoSection — info live di bawah video", () => {
  it("tautan → lencana LIVE + tombol yang membuka tab baru dengan aman", () => {
    const { container } = render(
      <VideoSection
        rubric={RUBRIK}
        video={VIDEO}
        youtubeUrl={undefined}
        live={{ url: "https://youtube.com/live/abc" }}
      />,
    );
    const onair = container.querySelector(".wt-onair")!;
    expect(onair.querySelector(".wt-onair__badge")).toHaveTextContent("Live");
    expect(onair.querySelector(".wt-onair__dot")).toHaveAttribute(
      "aria-hidden",
    );
    const a = onair.querySelector("a")!;
    expect(a).toHaveAttribute("href", "https://youtube.com/live/abc");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    expect(a).toHaveTextContent("Tonton Siaran Langsung");
    expect(onair.querySelector(".wt-onair__text")).toBeNull();
    // Di BAWAH video, bukan di atasnya.
    const video = container.querySelector(".wt-video")!;
    expect(
      video.compareDocumentPosition(onair) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("tulisan biasa → teks apa adanya, tanpa tautan", () => {
    const { container } = render(
      <VideoSection
        rubric={RUBRIK}
        video={VIDEO}
        youtubeUrl={undefined}
        live={{ text: "@LADOMAX Mediapro" }}
      />,
    );
    const onair = container.querySelector(".wt-onair")!;
    expect(onair.querySelector(".wt-onair__text")).toHaveTextContent(
      "@LADOMAX Mediapro",
    );
    expect(onair.querySelector("a")).toBeNull();
  });

  it("tulisan berbentuk markup tetap teks (di-escape React)", () => {
    const { container } = render(
      <VideoSection
        rubric={RUBRIK}
        video={null}
        youtubeUrl={undefined}
        live={{ text: '<img src=x onerror="alert(1)">' }}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".wt-onair__text")?.textContent).toBe(
      '<img src=x onerror="alert(1)">',
    );
  });

  it("tanpa video → judul + info live saja, tanpa bingkai video kosong", () => {
    const { container } = render(
      <VideoSection
        rubric={RUBRIK}
        video={null}
        youtubeUrl="@LADOMAX Mediapro"
        live={{ text: "@LADOMAX Mediapro" }}
      />,
    );
    expect(container.querySelector("h2")).not.toBeNull();
    expect(container.querySelector(".wt-video")).toBeNull();
    expect(container.querySelector(".wt-onair")).not.toBeNull();
  });

  it("tanpa info live → tak ada lencana", () => {
    for (const live of [undefined, null]) {
      const { container, unmount } = render(
        <VideoSection
          rubric={RUBRIK}
          video={VIDEO}
          youtubeUrl={undefined}
          live={live}
        />,
      );
      expect(container.querySelector(".wt-video")).not.toBeNull();
      expect(container.querySelector(".wt-onair")).toBeNull();
      unmount();
    }
  });
});

describe("section acara Warta tak lagi memuat tombol live", () => {
  it("tak ada tombol siaran di Rangkaian Acara", () => {
    const { container } = render(
      <Schedule
        rubric={dwi((d) => d.folio.schedule)}
        events={[
          {
            id: "akad",
            name: "Akad",
            startAt: "2026-12-20T01:00:00Z",
            endAt: null,
            venueName: "Masjid",
            address: null,
            mapsUrl: null,
          },
        ]}
        tz="Asia/Jakarta"
        slug="andi-sinta"
      />,
    );
    expect(container).not.toHaveTextContent("Tonton Siaran Langsung");
    expect(container.querySelector(".wt-onair")).toBeNull();
  });
});

describe("CSS lencana LIVE", () => {
  const css = readFileSync(
    join(process.cwd(), "src", "themes", "warta", "warta.css"),
    "utf8",
  );

  it("titik berkedip HANYA di dalam prefers-reduced-motion: no-preference", () => {
    const i = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(i).toBeGreaterThan(-1);
    const blok = css.slice(i, css.indexOf("}\n}", i) + 3);
    expect(blok).toMatch(/\.wt-onair__dot\s*\{\s*animation:\s*wt-onair/);
    // Gerbang gerak tema yang sama dengan pita berjalan + Gerak "Tenang"
    // (pratinjau Tampilan hanya mengganti `data-motion`).
    expect(blok).toContain(
      '.wt.is-js.is-motion:not([data-motion="calm"]) .wt-onair__dot {',
    );
    // Di luar blok itu, animasi titik tak pernah dinyalakan.
    const luar = css.slice(0, i) + css.slice(i + blok.length);
    expect(luar).not.toMatch(/\.wt-onair__dot[^}]*animation:/);
  });

  it("tulisan panjang (nama kanal tanpa spasi) tak meluber kolom", () => {
    const i = css.indexOf(".wt-onair__text {");
    expect(css.slice(i, css.indexOf("}", i))).toMatch(
      /overflow-wrap:\s*anywhere/,
    );
  });
});
