"use client";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";

/**
 * Koreografi scroll Barakah (klien, tier Story — TANPA WebGL/partikel). Membaca
 * `useCoverGate()`: gsap dijalankan SETELAH cover dibuka via `useThemeMotion`
 * (gsap.context di-revert saat unmount). Efek islami: mask reveal per baris,
 * blok reveal, strip geometris SVG MENGGAMBAR DIRI saat scroll (strokeDashoffset
 * scrub), progress bab. JANGAN import gsap/lenis statik.
 */
export function BarakahFx() {
  const { opened, motionOn, rootRef } = useCoverGate();

  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.bk-stage).
    q<HTMLElement>(".bk-stage .bk-line > span").forEach((el) => {
      gsap.set(el, { visibility: "visible", yPercent: 115 });
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
    q<HTMLElement>(".bk-stage .bk-reveal").forEach((el) => {
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

    // Strip geometris `.bk-draw` menggambar diri saat masuk viewport (scrub).
    q<SVGPathElement>(".bk-stage .bk-draw path").forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      gsap.to(p, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: p.closest("svg"),
          start: "top 92%",
          end: "top 55%",
          scrub: 0.6,
        },
      });
    });

    // Progress bab.
    const bar = scope.querySelector(".bk-progress");
    if (bar) {
      gsap.to(bar, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".bk-stage",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });
    }
  });

  return null;
}
