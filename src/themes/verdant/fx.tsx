"use client";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";

/**
 * Koreografi scroll Verdant (klien, tier Story — TANPA WebGL/partikel). Membaca
 * `useCoverGate()`: gsap dijalankan SETELAH cover dibuka via `useThemeMotion`
 * (gsap.context di-revert saat unmount). Efek botanikal: mask reveal per baris,
 * blok reveal, SVG ranting/sudut MENGGAMBAR DIRI saat scroll (strokeDashoffset
 * scrub), progress bab.
 */
export function VerdantFx() {
  const { opened, motionOn, rootRef } = useCoverGate();

  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.vd-stage).
    q<HTMLElement>(".vd-stage .vd-line > span").forEach((el) => {
      gsap.set(el, { visibility: "visible", yPercent: 150 });
      gsap.to(el, {
        yPercent: 0,
        duration: 1.05,
        ease: "power4.out",
        scrollTrigger: {
          trigger: el.closest("section") ?? el,
          start: "top 80%",
        },
      });
    });

    // Blok reveal: fade + naik.
    q<HTMLElement>(".vd-stage .vd-reveal").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.95,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 86%" },
        },
      );
    });

    // Semua SVG botani `.vd-draw` menggambar diri saat masuk viewport (scrub).
    q<SVGPathElement>(".vd-stage .vd-draw path").forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      gsap.to(p, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: p.closest("svg"),
          start: "top 90%",
          end: "top 45%",
          scrub: 0.6,
        },
      });
    });

    // Progress bab.
    const bar = scope.querySelector(".vd-progress");
    if (bar) {
      gsap.to(bar, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".vd-stage",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });
    }
  });

  return null;
}
