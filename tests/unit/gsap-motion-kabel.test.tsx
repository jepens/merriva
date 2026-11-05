import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useThemeMotion } from "@/themes/_shared/gsap-motion";

/**
 * Kabel `useThemeMotion` (DECISIONS #112) dengan gsap/ScrollTrigger/lenis tiruan:
 * jepit dasar terpasang pada event "refresh" (bukan "refreshInit", bukan sekali
 * saat setup) dan membaca gulir maksimum BARU di tiap refresh — RSVP terkirim
 * memendekkan halaman —, setiap perubahan tinggi akar memicu satu refresh AMAN,
 * dan semuanya dilepas saat unmount. Tanpa kabel ini `jepitTriggerBawah` benar
 * tetapi tak pernah jalan.
 */
const st = vi.hoisted(() => ({
  addEventListener: vi.fn<(jenis: string, f: () => void) => void>(),
  removeEventListener: vi.fn<(jenis: string, f: () => void) => void>(),
  refresh: vi.fn<(aman?: boolean) => void>(),
  update: vi.fn<() => void>(),
  maxScroll: vi.fn<(target: unknown) => number>(() => 1000),
  getAll: vi.fn<() => unknown[]>(() => []),
}));

vi.mock("gsap", () => ({
  default: {
    registerPlugin: () => {},
    ticker: { add: () => {}, remove: () => {}, lagSmoothing: () => {} },
    context: (f: () => void) => {
      f();
      return { revert: () => {} };
    },
  },
}));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: st }));
vi.mock("lenis", () => ({
  default: class {
    on() {}
    raf() {}
    destroy() {}
  },
}));

describe("useThemeMotion: kabel jepit dasar & refresh saat tinggi isi berubah", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("jepit tiap refresh dengan maks baru; RO me-refresh aman tiap perubahan; dilepas saat unmount", async () => {
    let ubahUkuran = () => {};
    const diamati: Element[] = [];
    let diputus = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          ubahUkuran = cb;
        }
        observe(el: Element) {
          diamati.push(el);
        }
        disconnect() {
          diputus++;
        }
      },
    );
    const akar = document.createElement("div");
    akar.className = "tema is-js is-motion";

    const { unmount } = renderHook(() =>
      useThemeMotion({ current: akar }, true, () => {}),
    );
    await waitFor(() => expect(st.addEventListener).toHaveBeenCalledTimes(1));
    expect(akar.classList.contains("is-motion")).toBe(true); // chunk berhasil

    const [jenis, jepit] = st.addEventListener.mock.calls[0];
    expect(jenis).toBe("refresh");
    const watermark = { start: 1128, end: 1500, setPositions: vi.fn() };
    st.getAll.mockReturnValue([watermark]);
    jepit();
    expect(watermark.setPositions).toHaveBeenCalledWith(999, 1500);

    // RSVP terkirim: halaman memendek → refresh berikutnya memakai maks baru.
    st.maxScroll.mockReturnValue(800);
    const penutup = { start: 850, end: 900, setPositions: vi.fn() };
    st.getAll.mockReturnValue([penutup]);
    jepit();
    expect(penutup.setPositions).toHaveBeenCalledWith(799, 900);
    expect(st.removeEventListener).not.toHaveBeenCalled();

    // Panggilan awal observe() dan perubahan sesudahnya: masing-masing satu
    // refresh AMAN.
    expect(diamati).toEqual([akar]);
    st.refresh.mockClear();
    ubahUkuran();
    ubahUkuran();
    expect(st.refresh.mock.calls).toEqual([[true], [true]]);

    unmount();
    expect(st.removeEventListener).toHaveBeenCalledWith("refresh", jepit);
    expect(diputus).toBe(1);
  });

  it("unmount sebelum chunk tiba: tak ada pendengar maupun ResizeObserver", async () => {
    let dibuat = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor() {
          dibuat++;
        }
        observe() {}
        disconnect() {}
      },
    );
    const akar = document.createElement("div");

    const { unmount } = renderHook(() =>
      useThemeMotion({ current: akar }, true, () => {}),
    );
    unmount();
    await new Promise((r) => setTimeout(r, 100));

    expect(st.addEventListener).not.toHaveBeenCalled();
    expect(dibuat).toBe(0);
  });
});
