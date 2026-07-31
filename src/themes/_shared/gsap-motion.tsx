"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Util motion untuk tema tier Story/Signature (THEME-PORTING §2b). GSAP + Lenis
 * dimuat via `import()` DINAMIS di sini → tak masuk bundle tema Craft maupun app
 * shell. Semua efek dibungkus `gsap.context(...)` yang di-`revert()` saat unmount
 * (wajib: tema di-mount ulang di preview & editor).
 */

// Tipe-tipe dari modul (query type-only → tanpa import runtime statis).
type Gsap = (typeof import("gsap"))["default"];
type ScrollTriggerT = (typeof import("gsap/ScrollTrigger"))["ScrollTrigger"];

/** Konteks yang diberikan ke fungsi setup koreografi tiap tema. */
export interface ThemeMotionCtx {
  gsap: Gsap;
  ScrollTrigger: ScrollTriggerT;
  /** Akar tema — selektor `gsap.context` sudah ter-scope ke sini. */
  scope: HTMLElement;
}

let cached: Promise<{ gsap: Gsap; ScrollTrigger: ScrollTriggerT }> | null =
  null;

/**
 * Muat gsap + ScrollTrigger sekali (cache modul) & daftarkan plugin. Dipakai
 * cover-gate (timeline entrance/buka) & `useThemeMotion` (koreografi scroll).
 */
export function loadGsap() {
  if (!cached) {
    cached = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([g, st]) => {
        const gsap = g.default;
        gsap.registerPlugin(st.ScrollTrigger);
        return { gsap, ScrollTrigger: st.ScrollTrigger };
      },
    );
  }
  return cached;
}

/**
 * Pola mask-reveal per baris (THEME-PORTING §0.4): state tersembunyi DIMILIKI JS
 * (`gsap.set(visibility:'visible', yPercent:115)` lalu animate ke 0), BUKAN
 * transform CSS — agar elemen tak tersembunyi lagi saat GSAP membersihkan inline
 * style. `.line{overflow:hidden}` mengekliping offset. Menyapu `.line > span`
 * dalam `scope`.
 */
export function maskLines(
  { gsap, scope }: ThemeMotionCtx,
  opts?: { start?: string; stagger?: number },
) {
  const spans = scope.querySelectorAll<HTMLElement>(".line > span");
  spans.forEach((el) => {
    gsap.set(el, { visibility: "visible", yPercent: 115 });
    gsap.to(el, {
      yPercent: 0,
      duration: 1.1,
      ease: "power4.out",
      scrollTrigger: {
        trigger: el.closest("section") ?? el,
        start: opts?.start ?? "top 82%",
      },
    });
  });
}

/**
 * Jalankan koreografi scroll tema di dalam `gsap.context(scope)` + inisialisasi
 * Lenis (smooth scroll), keduanya dibersihkan saat unmount / `active` berubah.
 * `active` menggerbangi START (mis. dinyalakan SETELAH cover dibuka) sehingga
 * Lenis tak mengaktifkan scroll di balik cover.
 */
export function useThemeMotion(
  scopeRef: RefObject<HTMLElement | null>,
  active: boolean,
  setup: (ctx: ThemeMotionCtx) => void,
) {
  // Setup di-ref agar efek hanya bergantung pada `active` (bukan identitas fn).
  const setupRef = useRef(setup);
  useEffect(() => {
    setupRef.current = setup;
  });

  useEffect(() => {
    if (!active) return;
    const scope = scopeRef.current;
    if (!scope) return;

    let cancelled = false;
    let dispose: (() => void) | null = null;

    void (async () => {
      const { gsap, ScrollTrigger } = await loadGsap();
      const { default: Lenis } = await import("lenis");
      if (cancelled || !scopeRef.current) return;

      const lenis = new Lenis({ lerp: 0.11 });
      lenis.on("scroll", () => ScrollTrigger.update());
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const ctx = gsap.context(
        () => setupRef.current({ gsap, ScrollTrigger, scope }),
        scope,
      );
      // Recalc posisi trigger setelah layout stabil (font swap, dsb.).
      const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 60);

      dispose = () => {
        window.clearTimeout(refreshId);
        ctx.revert();
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
      if (cancelled) dispose();
    })();

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [active, scopeRef]);
}
