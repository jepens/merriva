import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useThemeMotion } from "@/themes/_shared/gsap-motion";

/**
 * Chunk gsap gagal dimuat (impor ditolak: galat jaringan/HTTP) → isi tak boleh
 * tertahan tersembunyi (DECISIONS #112). CSS tema menyembunyikan isi hanya di
 * bawah `.is-motion`, jadi `useThemeMotion` melepas kelas itu dari akar tema —
 * dan galatnya tetap dilaporkan ke penangan galat global (Sentry).
 */
vi.mock("gsap", () => {
  throw new Error("chunk gsap gagal dimuat");
});

describe("useThemeMotion saat chunk gsap gagal dimuat", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("melepas is-motion dari akar tema, melaporkan galat, dan tak memanggil setup", async () => {
    const lapor = vi.fn<(galat: unknown) => void>();
    vi.stubGlobal("reportError", lapor);
    const akar = document.createElement("div");
    akar.className = "tema is-js is-motion";
    const setup = vi.fn();

    renderHook(() => useThemeMotion({ current: akar }, true, setup));

    await waitFor(() =>
      expect(akar.classList.contains("is-motion")).toBe(false),
    );
    expect(akar.classList.contains("is-js")).toBe(true);
    expect(lapor).toHaveBeenCalledTimes(1);
    expect(setup).not.toHaveBeenCalled();
  });
});
