import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useThemeMotion } from "@/themes/_shared/gsap-motion";

/**
 * Hanya chunk LENIS yang ditolak (gsap berhasil) → isi tetap wajib terbaca dan
 * galat aslinya dilaporkan (DECISIONS #112): impor lenis ikut di dalam
 * penangkap yang sama dengan gsap.
 */
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
vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {
    addEventListener: () => {},
    removeEventListener: () => {},
    refresh: () => {},
    update: () => {},
    maxScroll: () => 1000,
    getAll: () => [],
  },
}));
vi.mock("lenis", () => {
  throw new Error("chunk lenis gagal dimuat");
});

describe("useThemeMotion saat chunk lenis gagal dimuat", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("melepas is-motion dan melaporkan galat aslinya", async () => {
    const lapor = vi.fn<(galat: unknown) => void>();
    vi.stubGlobal("reportError", lapor);
    const akar = document.createElement("div");
    akar.className = "tema is-js is-motion";
    const setup = vi.fn();

    renderHook(() => useThemeMotion({ current: akar }, true, setup));

    await waitFor(() =>
      expect(akar.classList.contains("is-motion")).toBe(false),
    );
    expect(setup).not.toHaveBeenCalled();
    expect(lapor).toHaveBeenCalledTimes(1);
    const galat = lapor.mock.calls[0][0] as Error & { cause?: unknown };
    expect(`${String(galat)} ${String(galat.cause)}`).toContain(
      "chunk lenis gagal dimuat",
    );
  });
});
