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
 * `useThemeMotion` (koreografi scroll).
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
 * Trigger yang start-nya di luar gulir maksimum — blok di dasar halaman
 * (penutup, watermark Basic) dengan "top 86%" — tak pernah tercapai, jadi isinya
 * tak pernah tampil. Start seperti itu dipindah ke gulir maks − 1, persis yang
 * dilakukan `clamp()` ScrollTrigger di sisi bawah, lewat `setPositions` yang
 * sama (metode instans yang belum diketik `.d.ts` gsap). Bukan `clamp()` itu
 * sendiri: ia juga menjepit start negatif ke 0, padahal trigger baru aktif bila
 * progress > 0 — isi di atas lipatan (hero sesudah sampul dibuka, gulir 0) lalu
 * tertahan sampai halaman digulir. Dipanggil sesudah setiap refresh — termasuk
 * refresh saat tinggi isi berubah (RSVP terkirim memendekkan halaman), yang
 * dipicu `useThemeMotion`.
 */
export function jepitTriggerBawah(ScrollTrigger: ScrollTriggerT): void {
  const max = ScrollTrigger.maxScroll(window);
  for (const t of ScrollTrigger.getAll()) {
    if (t.start >= max)
      (
        t as typeof t & { setPositions(start: number, end: number): void }
      ).setPositions(max - 1, t.end);
  }
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
 * Lenis tak mengaktifkan scroll di balik cover. Bila impor chunk gsap/lenis
 * DITOLAK (galat jaringan/HTTP), kelas `is-motion` dilepas dari `scope`: CSS
 * tema menyembunyikan isi hanya di bawah kelas itu, jadi isi tetap terbaca tanpa
 * animasi; galatnya tetap dilaporkan (`reportError` → penangan galat global).
 * Chunk yang macet tak pernah ditolak, jadi tetap menahan isi sampai tiba.
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
      const muat = await Promise.all([loadGsap(), import("lenis")]).catch(
        (galat: unknown) => {
          globalThis.reportError?.(galat);
          return null;
        },
      );
      if (cancelled || !scopeRef.current) return;
      if (!muat) {
        scope.classList.remove("is-motion");
        return;
      }
      const [{ gsap, ScrollTrigger }, { default: Lenis }] = muat;

      const lenis = new Lenis({ lerp: 0.11 });
      lenis.on("scroll", () => ScrollTrigger.update());
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const ctx = gsap.context(
        () => setupRef.current({ gsap, ScrollTrigger, scope }),
        scope,
      );
      const jepit = () => jepitTriggerBawah(ScrollTrigger);
      ScrollTrigger.addEventListener("refresh", jepit);
      // Tinggi isi berubah tanpa resize jendela (RSVP terkirim, galeri) →
      // refresh agar posisi trigger & jepit dasar mengikuti. `true` = aman:
      // ditunda sampai ScrollTrigger menganggap gulir berhenti (>200 ms tanpa
      // event gulir), dan tak tersaring ignoreMobileResize.
      const ro = new ResizeObserver(() => ScrollTrigger.refresh(true));
      ro.observe(scope);
      // Recalc posisi trigger setelah layout stabil (font swap, dsb.).
      const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 60);

      dispose = () => {
        window.clearTimeout(refreshId);
        ro.disconnect();
        ScrollTrigger.removeEventListener("refresh", jepit);
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
