import { describe, expect, it, vi } from "vitest";

import { jepitTriggerBawah } from "@/themes/_shared/gsap-motion";

/**
 * Trigger reveal di dasar halaman (DECISIONS #112): start di luar gulir maksimum
 * tak pernah tercapai — watermark Basic tak pernah tampil. Yang dikunci: hanya
 * start ≥ gulir maks yang dipindah ke maks − 1; start negatif (isi di atas
 * lipatan) dan yang terjangkau tak disentuh.
 */

type ScrollTriggerT = Parameters<typeof jepitTriggerBawah>[0];

function trigger(start: number, end: number) {
  return { start, end, setPositions: vi.fn() };
}

describe("jepitTriggerBawah", () => {
  it("start di luar gulir maksimum dipindah ke maks − 1; yang lain tak disentuh", () => {
    const hero = trigger(-731, 400); // "top 80%" di puncak: aktif di gulir 0
    const tengah = trigger(500, 1200);
    const tepat = trigger(1000, 1300);
    const watermark = trigger(1128, 1500);
    const maxScroll = vi.fn<(target: unknown, horizontal?: boolean) => number>(
      () => 1000,
    );
    const palsu = {
      maxScroll,
      getAll: () => [hero, tengah, tepat, watermark],
    } as unknown as ScrollTriggerT;

    jepitTriggerBawah(palsu);

    expect(maxScroll).toHaveBeenCalledWith(window); // vertikal, bukan horizontal
    expect(hero.setPositions).not.toHaveBeenCalled();
    expect(tengah.setPositions).not.toHaveBeenCalled();
    expect(tepat.setPositions).toHaveBeenCalledWith(999, 1300);
    expect(watermark.setPositions).toHaveBeenCalledWith(999, 1500);
  });

  it("gsap terpasang masih punya setPositions (metode instans yang tak diketik)", async () => {
    // jsdom tak punya matchMedia; ScrollTrigger memanggilnya saat dibuat.
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: false,
      media,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    const { gsap } = await import("gsap");
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    gsap.registerPlugin(ScrollTrigger);
    const t = ScrollTrigger.create({ start: 0, end: 100 });

    expect(typeof (t as unknown as Record<string, unknown>).setPositions).toBe(
      "function",
    );
    t.kill();
    vi.unstubAllGlobals();
  });
});
