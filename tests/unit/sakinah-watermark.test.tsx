import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Footer } from "@/themes/sakinah/sections";

/**
 * Watermark Basic sakinah tak boleh dibungkus `Reveal` (DECISIONS #112): Reveal
 * sependek itu di dasar halaman tak pernah terpicu bila layar ≳940 px tinggi,
 * jadi batas paket tak tampil di tablet & desktop.
 */
describe("Footer sakinah", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("watermark tak berada di dalam .reveal", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );

    const { container } = render(
      <Footer watermark greetingClose="Terima kasih" />,
    );

    const watermark = container.querySelector(".sk-watermark");
    expect(watermark).not.toBeNull();
    expect(watermark?.closest(".reveal")).toBeNull();
  });
});
